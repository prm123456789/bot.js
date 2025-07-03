module.exports = async (conn, m) => {
  const start = Date.now();
  await m.reply('🏓 Ping...');
  const end = Date.now();
  await m.reply(`⏱️ Latence : ${end - start} ms`);
};
