const fs = require('fs');
const path = require('path');
const pino = require('pino');
const NodeCache = require('node-cache');
const { Boom } = require('@hapi/boom');
const { parsePhoneNumber } = require('libphonenumber-js');
const TelegramBot = require('node-telegram-bot-api');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  jidDecode,
  downloadContentFromMessage,
  getContentType,
  Browsers
} = require('@whiskeysockets/baileys');

const config = require('./config');
const handler = require('./handler');
const bot = new TelegramBot(config.telegramToken, { polling: true });
const activeSessions = new Map();
const msgRetryCounterCache = new NodeCache();

// ==================== Store ====================
const store = {
  messages: new Map(),
  contacts: new Map(),
  loadMessage: async (jid, id) => store.messages.get(`${jid}:${id}`) || null,
  bind: (ev) => {
    ev.on('messages.upsert', ({ messages }) => {
      messages.forEach(msg => store.messages.set(`${msg.key.remoteJid}:${msg.key.id}`, msg));
    });
  },
};

// ==================== Pairing ====================
async function startSession(phoneNumber, telegramChatId) {
  const sessionPath = path.join(config.sessionDir, `session_${phoneNumber}`);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const conn = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.windows('Edge'),
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: "fatal" })) },
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
    getMessage: async (key) => store.loadMessage(key.remoteJid, key.id),
  });

  activeSessions.set(phoneNumber, { conn, telegramChatId });
  store.bind(conn.ev);

  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      await saveCreds();
      if (telegramChatId) bot.sendMessage(telegramChatId, `✅ WhatsApp connecté avec succès : ${phoneNumber}`);
    }
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if ([DisconnectReason.connectionClosed, DisconnectReason.connectionLost, DisconnectReason.timedOut].includes(reason)) {
        setTimeout(() => startSession(phoneNumber, telegramChatId), config.reconnectDelay);
      } else if ([DisconnectReason.loggedOut, DisconnectReason.badSession].includes(reason)) {
        if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true });
        if (telegramChatId) bot.sendMessage(telegramChatId, `❌ Session supprimée pour ${phoneNumber}`);
        activeSessions.delete(phoneNumber);
      }
    }
  });

  conn.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const mek = messages[0];
      if (!mek.message) return;
      mek.message = mek.message?.ephemeralMessage?.message || mek.message;
      if (mek.key.remoteJid === 'status@broadcast') return;
      const m = await serializeMessage(conn, mek, store);
      handler(conn, m, store);
    } catch (err) {
      console.error('Message error:', err);
    }
  });

  conn.ev.on('creds.update', saveCreds);

  if (!conn.authState.creds.registered && telegramChatId) {
    const code = await conn.requestPairingCode(phoneNumber);
    bot.sendMessage(telegramChatId, `🔑 Code de pairage pour ${phoneNumber} :\n\n${code}`);
  }
}

async function serializeMessage(conn, m, store) {
  if (!m) return m;
  const type = getContentType(m.message);
  const msg = m.message[type];
  const sender = m.key.fromMe ? conn.user.id : (m.key.participant || m.key.remoteJid);
  return {
    id: m.key.id,
    isGroup: m.key.remoteJid.endsWith('@g.us'),
    chat: m.key.remoteJid,
    fromMe: m.key.fromMe,
    sender,
    type,
    text: msg?.conversation || msg?.text || msg?.caption || '',
    mentionedJid: msg?.contextInfo?.mentionedJid || [],
    quoted: msg?.contextInfo?.quotedMessage || null,
    reply: (text) => conn.sendMessage(m.key.remoteJid, { text }, { quoted: m }),
    download: () => downloadContentFromMessage(msg, type),
  };
}

// ==================== Telegram Commands ====================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `
━━━➤ 🤖 INCONNU XD V2
⌛ /pair
⌛ /delpair 
⌛ /listpair
━━━━━━━━━━━━━━━━━`, {
    reply_markup: { inline_keyboard: [[{ text: "Chaîne", url: "https://t.me/inconnuboytech" }]] }
  });
});

bot.onText(/\/pair\s+(\d+)/, async (msg, match) => {
  const number = match[1], chatId = msg.chat.id;
  if (activeSessions.has(number)) return bot.sendMessage(chatId, `⚠️ ${number} est déjà connecté.`);
  bot.sendMessage(chatId, `🔄 Connexion en cours pour ${number}...`);
  startSession(number, chatId).catch(e => {
    console.error(e);
    bot.sendMessage(chatId, `❌ Erreur lors de la connexion : ${e.message}`);
  });
});

bot.onText(/\/delpair\s+(\d+)/, (msg, match) => {
  const number = match[1], chatId = msg.chat.id;
  if (activeSessions.has(number)) {
    activeSessions.get(number).conn.ws.close();
    activeSessions.delete(number);
    fs.rmSync(path.join(config.sessionDir, `session_${number}`), { recursive: true, force: true });
    bot.sendMessage(chatId, `✅ Session supprimée pour ${number}`);
  } else bot.sendMessage(chatId, `❌ Aucune session active pour ${number}`);
});

bot.onText(/\/listpair/, (msg) => {
  if (msg.from.id.toString() !== config.ownerId) return bot.sendMessage(msg.chat.id, '🚫 Commande réservée au propriétaire');
  const list = [...activeSessions.keys()].map(n => `- ${n}`).join('\n');
  bot.sendMessage(msg.chat.id, list || 'Aucune session active');
});

// ==================== Init ====================
(async () => {
  if (!fs.existsSync(config.sessionDir)) fs.mkdirSync(config.sessionDir, { recursive: true });
  console.log('🚀 INCONNU XD V2 prêt');
})();

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
