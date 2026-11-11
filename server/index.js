'use strict';

const http = require('node:http');
const { createApp } = require('./app');
const { fromEnv } = require('./config');

const cfg = fromEnv();
const app = createApp(cfg);
const server = http.createServer(app.handle);

server.listen(cfg.port, () => {
  console.log('LinkedOut draait op http://localhost:' + cfg.port);
  const code = app.bootstrapInvite();
  if (code) {
    console.log('Er is nog geen account. Maak het beheerdersaccount met deze uitnodigingscode:');
    console.log('  ' + code);
  }
});

function stop() {
  server.close(() => {
    app.close();
    process.exit(0);
  });
}

process.on('SIGTERM', stop);
process.on('SIGINT', stop);
