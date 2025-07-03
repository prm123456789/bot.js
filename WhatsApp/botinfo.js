module.exports = async (conn, m) => {
  const user = conn.user;
  await m.reply(`
🤖 *INCONNU XD V2*
━ ID : ${user.id.split(':')[0]}
━ Nom : ${user.name}
━ Version : Baileys ${conn.version?.join('.') || 'Unknown'}
`);
};
