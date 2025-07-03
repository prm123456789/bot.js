module.exports = async (conn, m, args) => {
  if (!m.isGroup) return m.reply('🚫 Cette commande fonctionne seulement en groupe.');
  const admin = await conn.groupMetadata(m.chat).then(meta => meta.participants.find(p => p.id === conn.user.id && p.admin));
  if (!admin) return m.reply('🚫 Je dois être admin pour expulser.');
  const number = args[0];
  if (!number || !/^\d+$/.test(number)) return m.reply('⚠️ Format : !kick 234XXXXXXXXX');
  const jid = `${number}@s.whatsapp.net`;
  await conn.groupParticipantsUpdate(m.chat, [jid], 'remove');
  m.reply(`✅ Utilisateur ${number} expulsé.`);
};
