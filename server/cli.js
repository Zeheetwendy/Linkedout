'use strict';

// Beheer vanaf de opdrachtregel, voor wat (nog) niet in de website zit.
//   node server/cli.js invite [--admin]   maak een uitnodigingscode
//   node server/cli.js reset <schuilnaam> geef iemand een tijdelijk wachtwoord
//   node server/cli.js admin <schuilnaam> maak iemand beheerder

const auth = require('./auth');
const { createApp } = require('./app');
const { fromEnv } = require('./config');

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const app = createApp(fromEnv());
  try {
    if (command === 'invite') {
      console.log(app.createInvite(rest.includes('--admin')));
      return;
    }
    const alias = rest.join(' ').trim();
    const user = alias ? app.store.userByAlias(alias) : null;
    if ((command === 'reset' || command === 'admin') && !user) {
      console.error('Geen account gevonden met de schuilnaam "' + alias + '".');
      process.exitCode = 1;
      return;
    }
    if (command === 'reset') {
      const password = auth.newTempPassword();
      app.store.setPassword(user.id, await auth.hashPassword(password));
      app.store.deleteSessionsForUser(user.id);
      console.log('Tijdelijk wachtwoord voor ' + user.alias + ': ' + password);
      return;
    }
    if (command === 'admin') {
      app.store.setAdmin(user.id, true);
      console.log(user.alias + ' is nu beheerder.');
      return;
    }
    console.error('Gebruik: node server/cli.js invite [--admin] | reset <schuilnaam> | admin <schuilnaam>');
    process.exitCode = 1;
  } finally {
    app.close();
  }
}

main();
