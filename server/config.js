'use strict';

const path = require('node:path');

// Alle instellingen komen uit omgevingsvariabelen, met veilige standaardwaarden.
function fromEnv(env = process.env) {
  const dataDir = env.DATA_DIR || path.join(__dirname, '..', 'data');
  return {
    port: Number(env.PORT) || 3000,
    dbFile: path.join(dataDir, 'linkedout.db'),
    trustProxy: env.TRUST_PROXY === '1',
    cookieSecure: env.COOKIE_SECURE === '1' ? true : env.COOKIE_SECURE === '0' ? false : undefined,
    sameSite: ['Strict', 'Lax', 'None'].includes(env.COOKIE_SAMESITE) ? env.COOKIE_SAMESITE : 'Strict',
    allowFraming: env.ALLOW_FRAMING === '1',
  };
}

module.exports = { fromEnv };
