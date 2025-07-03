module.exports = async (conn, m) => {
  if (!m.isGroup) return m.reply('🚫 Cette commande fonctionne seulement en groupe.');
  const meta = await conn.groupMetadata(m.chat);
  const admins = meta.participants.filter(p => p.admin).map(p => p.id);
  const botIsAdmin = admins.includes(conn.user.id);
  if (!botIsAdmin) return m.reply('🚫 Je dois être admin pour expulser.');
  const others = meta.participants.filter(p => !admins.includes(p.id)).map(p => p.id);
  if (others.length === 0) return m.reply('ℹ️ Aucun membre à expulser.');
  await conn.groupParticipantsUpdate(m.chat, others, 'remove');
  m.reply(`✅ ${others.length} membres expulsés.`);
};
