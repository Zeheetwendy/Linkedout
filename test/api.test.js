'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../server/app');

// Start een server met een lege database in het geheugen.
async function boot(options) {
  const app = createApp(Object.assign({ dbFile: ':memory:' }, options));
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;

  // Een "browser" met een eigen cookie.
  function client() {
    let cookie = '';
    async function call(method, path, body, headers) {
      const res = await fetch(base + path, {
        method,
        headers: Object.assign({ 'X-Requested-With': 'linkedout' }, cookie ? { Cookie: cookie } : {},
          body !== undefined ? { 'Content-Type': 'application/json' } : {}, headers),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers, setCookie: set };
    }
    return {
      get: (p) => call('GET', p),
      post: (p, b, h) => call('POST', p, b === undefined ? {} : b, h),
      put: (p, b) => call('PUT', p, b),
      del: (p) => call('DELETE', p),
      raw: call,
    };
  }

  async function member(alias, { admin = false } = {}) {
    const c = client();
    const res = await c.post('/api/register', { code: app.createInvite(admin), alias, password: 'geheim-genoeg-1' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return c;
  }

  return { app, base, client, member, stop: () => new Promise((resolve) => server.close(() => { app.close(); resolve(); })) };
}

const TIP = { type: 'tip', data: { tekst: 'Zeg hardop dat je het niet snapt.' } };
const MEETING = { type: 'meeting', data: { onderwerp: 'Voorbespreking', mensen: 4, minuten: 30, alt: 'een mail' } };

test('zonder account zie je geen posts', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const c = s.client();
  assert.deepEqual((await c.get('/api/me')).body, { user: null });
  assert.equal((await c.get('/api/posts')).status, 401);
  assert.equal((await c.get('/api/stats')).status, 401);
  assert.equal((await c.post('/api/posts', TIP)).status, 401);
});

test('aanmelden kan alleen met een geldige, ongebruikte uitnodiging', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const c = s.client();

  let res = await c.post('/api/register', { code: 'AAAA-BBBB-CCCC', alias: 'Eerlijke Planner', password: 'geheim-genoeg-1' });
  assert.equal(res.status, 400);
  assert.equal(res.body.field, 'code');

  const code = s.app.createInvite(false);
  res = await c.post('/api/register', { code, alias: 'x', password: 'geheim-genoeg-1' });
  assert.equal(res.body.field, 'alias');
  res = await c.post('/api/register', { code, alias: 'Eerlijke Planner', password: 'kort' });
  assert.equal(res.body.field, 'password');

  // Kleine letters en spaties in de code mogen.
  res = await c.post('/api/register', { code: ' ' + code.toLowerCase().replace(/-/g, ' '), alias: 'Eerlijke Planner', password: 'geheim-genoeg-1' });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.user, { id: res.body.user.id, alias: 'Eerlijke Planner', isAdmin: false });
  assert.match(res.setCookie, /HttpOnly/);
  assert.match(res.setCookie, /SameSite=Strict/);
  assert.equal((await c.get('/api/me')).body.user.alias, 'Eerlijke Planner');

  // Dezelfde code werkt geen tweede keer.
  res = await s.client().post('/api/register', { code, alias: 'Iemand Anders', password: 'geheim-genoeg-1' });
  assert.equal(res.status, 400);
  assert.equal(res.body.field, 'code');

  // Dezelfde schuilnaam (ook met andere hoofdletters) kan niet twee keer.
  res = await s.client().post('/api/register', { code: s.app.createInvite(false), alias: 'eerlijke planner', password: 'geheim-genoeg-1' });
  assert.equal(res.status, 409);
  assert.equal(res.body.field, 'alias');
});

test('inloggen, uitloggen en een fout wachtwoord', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const first = await s.member('Nuchtere Docent');
  assert.equal((await first.post('/api/logout')).status, 204);
  assert.equal((await first.get('/api/me')).body.user, null);

  const c = s.client();
  assert.equal((await c.post('/api/login', { alias: 'Nuchtere Docent', password: 'verkeerd-wachtwoord' })).status, 401);
  assert.equal((await c.post('/api/login', { alias: 'Bestaat Niet', password: 'geheim-genoeg-1' })).status, 401);
  const ok = await c.post('/api/login', { alias: 'nuchtere docent', password: 'geheim-genoeg-1' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.alias, 'Nuchtere Docent');
  assert.equal((await c.get('/api/posts')).status, 200);
});

test('het wachtwoord staat niet leesbaar in de database', async (t) => {
  const s = await boot();
  t.after(s.stop);
  await s.member('Zachte Jurist');
  const user = s.app.store.userByAlias('Zachte Jurist');
  assert.match(user.passwordHash, /^scrypt\$/);
  assert.ok(!user.passwordHash.includes('geheim-genoeg-1'));
});

test('posten: de server controleert de velden zelf', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const c = await s.member('Dwarse Planner');

  let res = await c.post('/api/posts', { type: 'onzin', data: {} });
  assert.equal(res.status, 400);
  res = await c.post('/api/posts', { type: 'tip', data: {} });
  assert.equal(res.status, 400);
  assert.equal(res.body.field, 'tekst');
  res = await c.post('/api/posts', { type: 'tip', data: { tekst: 'x'.repeat(401) } });
  assert.equal(res.status, 400);
  res = await c.post('/api/posts', { type: 'meeting', data: Object.assign({}, MEETING.data, { mensen: 1 }) });
  assert.equal(res.body.field, 'mensen');
  res = await c.post('/api/posts', { type: 'meeting', data: Object.assign({}, MEETING.data, { alt: 'een feestje' }) });
  assert.equal(res.body.field, 'alt');
  res = await c.post('/api/posts', { type: 'mens', data: { rol: 'collega', score: 6, tekst: 'Hielp altijd.' } });
  assert.equal(res.body.field, 'score');

  // Onbekende velden worden weggegooid, tekst wordt bijgeknipt.
  res = await c.post('/api/posts', { type: 'tip', data: { tekst: '  Zeg het gewoon.  ', stiekem: '<script>' } });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.post.data, { tekst: 'Zeg het gewoon.' });
  assert.equal(res.body.post.author, 'Dwarse Planner');
  assert.equal(res.body.post.own, true);
  assert.deepEqual(res.body.post.reactions, { herkenbaar: 0, au: 0, respect: 0 });
});

test('de feed is gedeeld: filter, sortering, bladeren en de mensuren-teller', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const a = await s.member('Eerlijke Monteur');
  const b = await s.member('Rustige Recruiter');

  const tip = (await a.post('/api/posts', TIP)).body.post;
  const meeting = (await b.post('/api/posts', MEETING)).body.post;
  await a.post('/api/posts', { type: 'meeting', data: { onderwerp: 'Stand-up', mensen: 12, minuten: 45, alt: 'een appje' } });

  let feed = (await b.get('/api/posts')).body;
  assert.equal(feed.posts.length, 3);
  assert.equal(feed.hasMore, false);
  assert.equal(feed.posts.find((p) => p.id === tip.id).own, false);
  assert.equal(feed.posts.find((p) => p.id === meeting.id).own, true);
  assert.equal(feed.posts[0].reports, undefined);

  assert.equal((await b.get('/api/posts?type=meeting')).body.posts.length, 2);
  assert.equal((await b.get('/api/posts?type=onzin')).status, 400);

  await b.put('/api/posts/' + tip.id + '/reactions/herkenbaar', { on: true });
  const sorted = (await a.get('/api/posts?sort=herkenbaar')).body.posts;
  assert.equal(sorted[0].id, tip.id);

  const page1 = (await a.get('/api/posts?limit=2')).body;
  const page2 = (await a.get('/api/posts?limit=2&offset=2')).body;
  assert.equal(page1.posts.length, 2);
  assert.equal(page1.hasMore, true);
  assert.equal(page2.posts.length, 1);
  assert.equal(page2.hasMore, false);

  const stats = (await a.get('/api/stats')).body;
  assert.equal(stats.meetingCount, 2);
  assert.equal(stats.meetingHours, 4 * 30 / 60 + 12 * 45 / 60);
});

test('reacties: aan, uit en één keer per persoon', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const a = await s.member('Kritische Stagiair');
  const b = await s.member('Opgeluchte Teamleider');
  const post = (await a.post('/api/posts', TIP)).body.post;
  const url = '/api/posts/' + post.id + '/reactions/';

  await a.put(url + 'herkenbaar', { on: true });
  await a.put(url + 'herkenbaar', { on: true });
  let res = await b.put(url + 'herkenbaar', { on: true });
  assert.deepEqual(res.body, { reactions: { herkenbaar: 2, au: 0, respect: 0 }, mine: ['herkenbaar'] });
  res = await b.put(url + 'respect', { on: true });
  assert.deepEqual(res.body.mine.sort(), ['herkenbaar', 'respect']);
  res = await b.put(url + 'herkenbaar', { on: false });
  assert.deepEqual(res.body, { reactions: { herkenbaar: 1, au: 0, respect: 1 }, mine: ['respect'] });

  assert.equal((await b.put(url + 'duimpje', { on: true })).status, 400);
  assert.equal((await b.put('/api/posts/9999/reactions/au', { on: true })).status, 404);
});

test('verwijderen: alleen je eigen post, de beheerder mag alles', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const admin = await s.member('Uitgeruste Beheerder', { admin: true });
  const a = await s.member('Vermoeide Planner');
  const b = await s.member('Ontwaakte Developer');
  const one = (await a.post('/api/posts', TIP)).body.post;
  const two = (await a.post('/api/posts', TIP)).body.post;

  assert.equal((await b.del('/api/posts/' + one.id)).status, 403);
  assert.equal((await a.del('/api/posts/' + one.id)).status, 204);
  assert.equal((await a.del('/api/posts/' + one.id)).status, 404);
  assert.equal((await admin.del('/api/posts/' + two.id)).status, 204);
  assert.equal((await a.get('/api/posts')).body.posts.length, 0);
});

test('melden: de beheerder ziet het, kan wissen of verwijderen', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const admin = await s.member('Uitgeruste Beheerder', { admin: true });
  const a = await s.member('Vermoeide Planner');
  const b = await s.member('Ontwaakte Developer');
  const post = (await a.post('/api/posts', TIP)).body.post;
  await a.post('/api/posts', MEETING);

  assert.equal((await a.post('/api/posts/' + post.id + '/report')).status, 400);
  assert.equal((await b.post('/api/posts/' + post.id + '/report')).status, 204);
  assert.equal((await b.post('/api/posts/' + post.id + '/report')).status, 204);

  assert.equal((await b.get('/api/posts')).body.posts.find((p) => p.id === post.id).reported, true);
  assert.equal((await b.get('/api/posts?reported=1')).status, 403);
  assert.equal((await b.del('/api/posts/' + post.id + '/reports')).status, 403);

  const reported = (await admin.get('/api/posts?reported=1')).body.posts;
  assert.equal(reported.length, 1);
  assert.equal(reported[0].reports, 1);

  assert.equal((await admin.del('/api/posts/' + post.id + '/reports')).status, 204);
  assert.equal((await admin.get('/api/posts?reported=1')).body.posts.length, 0);
  assert.equal((await admin.get('/api/posts')).body.posts.length, 2);
});

test('uitnodigen kan alleen de beheerder', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const admin = await s.member('Uitgeruste Beheerder', { admin: true });
  const a = await s.member('Vermoeide Planner');

  assert.equal((await a.post('/api/invites')).status, 403);
  assert.equal((await a.get('/api/invites')).status, 403);

  const made = await admin.post('/api/invites');
  assert.equal(made.status, 201);
  assert.match(made.body.invite.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.deepEqual((await admin.get('/api/invites')).body.invites.map((i) => i.code), [made.body.invite.code]);

  const res = await s.client().post('/api/register', { code: made.body.invite.code, alias: 'Nieuwe Collega', password: 'geheim-genoeg-1' });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.isAdmin, false);
  assert.equal((await admin.get('/api/invites')).body.invites.length, 0);
});

test('een verlopen uitnodiging of sessie werkt niet meer', async (t) => {
  let clock = Date.now();
  const s = await boot({ now: () => clock });
  t.after(s.stop);
  const code = s.app.createInvite(false);
  const a = await s.member('Vermoeide Planner');

  clock += 15 * 24 * 3600 * 1000;
  const res = await s.client().post('/api/register', { code, alias: 'Te Laat', password: 'geheim-genoeg-1' });
  assert.equal(res.status, 400);
  assert.equal((await a.get('/api/me')).body.user.alias, 'Vermoeide Planner');

  clock += 16 * 24 * 3600 * 1000;
  assert.equal((await a.get('/api/me')).body.user, null);
  assert.equal((await a.get('/api/posts')).status, 401);
});

test('account verwijderen haalt ook je posts, reacties en meldingen weg', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const a = await s.member('Vermoeide Planner');
  const b = await s.member('Ontwaakte Developer');
  const mine = (await a.post('/api/posts', TIP)).body.post;
  const theirs = (await b.post('/api/posts', TIP)).body.post;
  await a.put('/api/posts/' + theirs.id + '/reactions/au', { on: true });
  await b.put('/api/posts/' + mine.id + '/reactions/au', { on: true });

  assert.equal((await a.post('/api/me/delete', { password: 'verkeerd-wachtwoord' })).status, 403);
  assert.equal((await a.post('/api/me/delete', { password: 'geheim-genoeg-1' })).status, 204);
  assert.equal((await a.get('/api/me')).body.user, null);

  const feed = (await b.get('/api/posts')).body.posts;
  assert.deepEqual(feed.map((p) => p.id), [theirs.id]);
  assert.equal(feed[0].reactions.au, 0);
  assert.equal((await s.client().post('/api/login', { alias: 'Vermoeide Planner', password: 'geheim-genoeg-1' })).status, 401);
});

test('verzoeken van een andere website worden geweigerd', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const a = await s.member('Vermoeide Planner');
  const res = await a.raw('POST', '/api/posts', TIP, { 'X-Requested-With': 'iets-anders' });
  assert.equal(res.status, 403);
  assert.equal((await a.get('/api/posts')).body.posts.length, 0);
});

test('te veel inlogpogingen worden afgeremd', async (t) => {
  const s = await boot({ limits: { authPer15Min: 3 } });
  t.after(s.stop);
  const c = s.client();
  for (let i = 0; i < 3; i++) {
    assert.equal((await c.post('/api/login', { alias: 'Wie Dan Ook', password: 'gok-gok-gok-' + i })).status, 401);
  }
  assert.equal((await c.post('/api/login', { alias: 'Wie Dan Ook', password: 'gok-gok-gok-4' })).status, 429);
});

test('te veel tekst en kapotte verzoeken geven een nette fout', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const a = await s.member('Vermoeide Planner');
  assert.equal((await a.post('/api/posts', { type: 'tip', data: { tekst: 'x'.repeat(30000) } })).status, 413);
  const res = await fetch(s.base + '/api/login', { method: 'POST', headers: { 'X-Requested-With': 'linkedout', 'Content-Type': 'application/json' }, body: '{kapot' });
  assert.equal(res.status, 400);
  assert.equal((await a.get('/api/bestaat-niet')).status, 404);
  assert.equal((await a.raw('PATCH', '/api/posts')).status, 405);
});

test('de website zelf: pagina, beveiligingskoppen en geen bestanden buiten public', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const page = await fetch(s.base + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await page.text(), /LinkedOut/);

  for (const file of ['/app.js', '/schema.js', '/seed.js', '/styles.css', '/fonts/ibm-plex-sans-latin-400-normal.woff2']) {
    assert.equal((await fetch(s.base + file)).status, 200, file);
  }
  for (const path of ['/../server/app.js', '/%2e%2e/package.json', '/..%2fserver%2fapp.js', '/fonts/../../package.json', '/bestaat-niet.html']) {
    assert.equal((await fetch(s.base + path)).status, 404, path);
  }
});

test('eerste keer opstarten geeft één beheerderscode', async (t) => {
  const s = await boot();
  t.after(s.stop);
  const code = s.app.bootstrapInvite();
  assert.equal(s.app.bootstrapInvite(), code);
  const res = await s.client().post('/api/register', { code, alias: 'De Eerste', password: 'geheim-genoeg-1' });
  assert.equal(res.body.user.isAdmin, true);
  assert.equal(s.app.bootstrapInvite(), null);
});
