const path = require('path');

module.exports = {
  telegramToken: '7214172448:AAHGqSgaw-zGVPZWvl8msDOVDhln-9kExas',   // remplace par ton vrai token
  ownerId: '7454528355',            // remplace par ton vrai id
  prefix: '!',
  sessionDir: path.join(__dirname, 'session'),
  mediaDir: path.join(__dirname, 'media'),
  reconnectDelay: 5000,
};
