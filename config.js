const path = require('path');

module.exports = {
  telegramToken: 'TON_TELEGRAM_TOKEN_ICI',   // remplace par ton vrai token
  ownerId: 'TON_ID_TELEGRAM_ICI',            // remplace par ton vrai id
  prefix: '!',
  sessionDir: path.join(__dirname, 'session'),
  mediaDir: path.join(__dirname, 'media'),
  reconnectDelay: 5000,
};
