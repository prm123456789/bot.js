const fs = require('fs');
const path = require('path');

module.exports = async (conn, m, store) => {
  const prefix = '!'; // Commande WhatsApp avec !

  if (!m.text.startsWith(prefix)) return;

  const args = m.text.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  switch (command) {
    case 'menu':
      await require('./WhatsApp/menu')(conn, m);
      break;
    case 'ping':
      await require('./WhatsApp/ping')(conn, m);
      break;
    case 'botinfo':
      await require('./WhatsApp/botinfo')(conn, m);
      break;
    case 'kickall':
      await require('./WhatsApp/kickall')(conn, m);
      break;
    case 'kick':
      await require('./WhatsApp/kick')(conn, m, args);
      break;
    default:
      await m.reply('❓ Commande inconnue.');
  }
};
