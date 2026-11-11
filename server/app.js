'use strict';

const fs = require('node:fs');
const path = require('node:path');
const schema = require('../public/schema.js');
const auth = require('./auth');
const { openDb } = require('./db');
const { createStore, REACTION_KINDS } = require('./store');

const COOKIE = 'lo_session';
const SESSION_MS = 30 * 24 * 3600 * 1000;
const INVITE_MS = 14 * 24 * 3600 * 1000;
const MAX_BODY = 20000;
const MAX_OPEN_INVITES = 50;
const PAGE_MAX = 50;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

function createLimiter(now) {
  const hits = new Map();
  return function allow(key, max, windowMs) {
    const t = now();
    if (hits.size > 5000) {
      for (const [k, list] of hits) if (!list.length || t - list[list.length - 1] > 3600 * 1000) hits.delete(k);
    }
    const list = (hits.get(key) || []).filter((x) => t - x < windowMs);
    const ok = list.length < max;
    if (ok) list.push(t);
    hits.set(key, list);
    return ok;
  };
}

function createApp(options = {}) {
  const cfg = {
    dbFile: options.dbFile || ':memory:',
    publicDir: options.publicDir || path.join(__dirname, '..', 'public'),
    trustProxy: !!options.trustProxy,
    cookieSecure: options.cookieSecure, // true, false of undefined (= volgt de verbinding)
    sameSite: options.sameSite || 'Strict',
    allowFraming: !!options.allowFraming,
    now: options.now || Date.now,
    limits: Object.assign({ authPer15Min: 30, postsPerHour: 30, reportsPerHour: 30 }, options.limits),
  };

  const db = openDb(cfg.dbFile);
  const store = createStore(db);
  const allow = createLimiter(cfg.now);

  // ---------- hulpjes ----------

  function clientIp(req) {
    if (cfg.trustProxy) {
      const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (fwd) return fwd;
    }
    return req.socket.remoteAddress || 'onbekend';
  }

  function isSecure(req) {
    if (typeof cfg.cookieSecure === 'boolean') return cfg.cookieSecure;
    if (cfg.trustProxy && req.headers['x-forwarded-proto'] === 'https') return true;
    return !!req.socket.encrypted;
  }

  function baseHeaders() {
    const csp = ["default-src 'self'", "img-src 'self' data:", "base-uri 'none'", "form-action 'self'", "object-src 'none'"];
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };
    if (!cfg.allowFraming) {
      csp.push("frame-ancestors 'none'");
      headers['X-Frame-Options'] = 'DENY';
    }
    headers['Content-Security-Policy'] = csp.join('; ');
    return headers;
  }

  function sendJson(res, status, body, extra) {
    const text = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, Object.assign(baseHeaders(), {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    }, extra));
    res.end(text);
  }

  function readCookie(req) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
    }
    return null;
  }

  function sessionCookie(req, token, maxAgeSeconds) {
    return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=${cfg.sameSite}; Max-Age=${maxAgeSeconds}` + (isSecure(req) ? '; Secure' : '');
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (chunk) => {
        size += chunk.length;
        // Te groot: niets meer bewaren, wel uitlezen zodat het antwoord nog aankomt.
        if (size <= MAX_BODY) chunks.push(chunk);
      });
      req.on('error', reject);
      req.on('end', () => {
        if (size > MAX_BODY) return reject(new HttpError(413, 'Dit is te veel tekst in één keer.'));
        if (!size) return resolve({});
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('geen object');
          resolve(parsed);
        } catch (err) {
          reject(new HttpError(400, 'De server begreep dit verzoek niet.'));
        }
      });
    });
  }

  function publicUser(user) {
    return { id: user.id, alias: user.alias, isAdmin: !!user.isAdmin };
  }

  function publicPost(row, viewer) {
    const post = {
      id: row.id,
      type: row.type,
      author: row.author,
      createdAt: row.createdAt,
      data: JSON.parse(row.data),
      reactions: {},
      mine: row.mine ? row.mine.split(',') : [],
      own: row.userId === viewer.id,
      reported: !!row.reportedByMe,
    };
    for (const kind of REACTION_KINDS) post.reactions[kind] = row[kind];
    if (viewer.isAdmin) post.reports = row.reports;
    return post;
  }

  function startSession(req, userId) {
    const token = auth.newToken();
    const now = cfg.now();
    store.deleteExpiredSessions(now);
    store.createSession(auth.hashToken(token), userId, now, now + SESSION_MS);
    return { 'Set-Cookie': sessionCookie(req, token, Math.floor(SESSION_MS / 1000)) };
  }

  function limitAuth(req) {
    if (!allow('auth:' + clientIp(req), cfg.limits.authPer15Min, 15 * 60 * 1000)) {
      throw new HttpError(429, 'Te veel pogingen. Wacht een kwartier en probeer het opnieuw.');
    }
  }

  function existingPost(id) {
    const post = store.postOwner(Number(id));
    if (!post) throw new HttpError(404, 'Deze post bestaat niet meer.');
    return post;
  }

  // ---------- routes ----------

  const handlers = {
    me: (ctx) => ({ user: ctx.user ? publicUser(ctx.user) : null }),

    async register(ctx) {
      limitAuth(ctx.req);
      const code = auth.normalizeInviteCode(ctx.body.code);
      const alias = schema.validateAlias(ctx.body.alias);
      const password = schema.validatePassword(ctx.body.password);
      const badCode = new HttpError(400, 'Deze uitnodigingscode klopt niet, is verlopen of is al gebruikt.', 'code');
      if (!code || !store.openInvite(code, cfg.now())) throw badCode;
      if (alias.error) throw new HttpError(400, alias.error, 'alias');
      if (password.error) throw new HttpError(400, password.error, 'password');
      const taken = new HttpError(409, 'Deze schuilnaam is al bezet. Kies een andere.', 'alias');
      if (store.userByAlias(alias.value)) throw taken;

      const hash = await auth.hashPassword(password.value);
      const userId = store.tx(() => {
        const now = cfg.now();
        const invite = store.openInvite(code, now);
        if (!invite) throw badCode;
        if (store.userByAlias(alias.value)) throw taken;
        const id = store.createUser(alias.value, hash, invite.makesAdmin, now);
        store.useInvite(code, id, now);
        return id;
      });
      return { status: 201, body: { user: publicUser(store.userById(userId)) }, headers: startSession(ctx.req, userId) };
    },

    async login(ctx) {
      limitAuth(ctx.req);
      const alias = typeof ctx.body.alias === 'string' ? ctx.body.alias.trim().replace(/\s+/g, ' ') : '';
      const password = typeof ctx.body.password === 'string' ? ctx.body.password.slice(0, 200) : '';
      const user = alias ? store.userByAlias(alias) : null;
      // Ook bij een onbekende schuilnaam wordt er gerekend, zodat de wachttijd niet verraadt wie bestaat.
      const ok = user ? await auth.verifyPassword(password, user.passwordHash) : (await auth.hashPassword(password), false);
      if (!ok) throw new HttpError(401, 'Schuilnaam of wachtwoord klopt niet.');
      return { body: { user: publicUser(user) }, headers: startSession(ctx.req, user.id) };
    },

    logout(ctx) {
      const token = readCookie(ctx.req);
      if (token) store.deleteSession(auth.hashToken(token));
      return { status: 204, headers: { 'Set-Cookie': sessionCookie(ctx.req, '', 0) } };
    },

    async deleteMe(ctx) {
      const password = typeof ctx.body.password === 'string' ? ctx.body.password.slice(0, 200) : '';
      if (!(await auth.verifyPassword(password, ctx.user.passwordHash))) {
        throw new HttpError(403, 'Dit wachtwoord klopt niet.', 'password');
      }
      store.deleteUser(ctx.user.id); // posts, reacties, meldingen en sessies gaan mee
      return { status: 204, headers: { 'Set-Cookie': sessionCookie(ctx.req, '', 0) } };
    },

    listPosts(ctx) {
      const p = ctx.url.searchParams;
      const type = p.get('type');
      if (type && !Object.prototype.hasOwnProperty.call(schema.TYPES, type)) throw new HttpError(400, 'Onbekende soort post.');
      const reportedOnly = p.get('reported') === '1';
      if (reportedOnly && !ctx.user.isAdmin) throw new HttpError(403, 'Alleen de beheerder ziet meldingen.');
      const limit = Math.min(PAGE_MAX, Math.max(1, Number(p.get('limit')) || 20));
      const offset = Math.min(100000, Math.max(0, Number(p.get('offset')) || 0));
      const rows = store.listPosts({
        viewerId: ctx.user.id, type, reportedOnly,
        sort: p.get('sort') === 'herkenbaar' ? 'herkenbaar' : 'nieuw',
        limit: limit + 1, offset,
      });
      return { posts: rows.slice(0, limit).map((r) => publicPost(r, ctx.user)), hasMore: rows.length > limit };
    },

    createPost(ctx) {
      const result = schema.validatePost(ctx.body.type, ctx.body.data);
      if (result.errors) {
        const field = Object.keys(result.errors)[0];
        throw new HttpError(400, result.errors[field], field);
      }
      if (!allow('post:' + ctx.user.id, cfg.limits.postsPerHour, 3600 * 1000)) {
        throw new HttpError(429, 'Je hebt dit uur al veel geplaatst. Probeer het later opnieuw.');
      }
      const id = store.createPost(ctx.user.id, ctx.body.type, result.data, cfg.now());
      return { status: 201, body: { post: publicPost(store.getPost(id, ctx.user.id), ctx.user) } };
    },

    deletePost(ctx) {
      const post = existingPost(ctx.params[0]);
      if (post.userId !== ctx.user.id && !ctx.user.isAdmin) throw new HttpError(403, 'Je kunt alleen je eigen posts verwijderen.');
      store.deletePost(post.id);
      return { status: 204 };
    },

    setReaction(ctx) {
      const post = existingPost(ctx.params[0]);
      const kind = ctx.params[1];
      if (!REACTION_KINDS.includes(kind)) throw new HttpError(400, 'Onbekende reactie.');
      store.setReaction(post.id, ctx.user.id, kind, ctx.body.on !== false, cfg.now());
      const fresh = publicPost(store.getPost(post.id, ctx.user.id), ctx.user);
      return { reactions: fresh.reactions, mine: fresh.mine };
    },

    reportPost(ctx) {
      const post = existingPost(ctx.params[0]);
      if (post.userId === ctx.user.id) throw new HttpError(400, 'Je eigen post kun je gewoon verwijderen.');
      if (!allow('report:' + ctx.user.id, cfg.limits.reportsPerHour, 3600 * 1000)) {
        throw new HttpError(429, 'Je hebt dit uur al veel gemeld. Probeer het later opnieuw.');
      }
      store.addReport(post.id, ctx.user.id, cfg.now());
      return { status: 204 };
    },

    clearReports(ctx) {
      store.clearReports(existingPost(ctx.params[0]).id);
      return { status: 204 };
    },

    stats: () => store.meetingStats(),

    listInvites: () => ({ invites: store.openInvites(cfg.now()).map((i) => ({ code: i.code, expiresAt: i.expiresAt, makesAdmin: !!i.makesAdmin })) }),

    createInvite(ctx) {
      const now = cfg.now();
      if (store.openInvites(now).length >= MAX_OPEN_INVITES) {
        throw new HttpError(400, 'Er staan al ' + MAX_OPEN_INVITES + ' uitnodigingen open. Wacht tot er een paar gebruikt of verlopen zijn.');
      }
      const code = auth.newInviteCode();
      store.createInvite(code, ctx.user.id, false, now, now + INVITE_MS);
      return { status: 201, body: { invite: { code, expiresAt: now + INVITE_MS, makesAdmin: false } } };
    },
  };

  const routes = [
    ['GET', /^\/api\/me$/, handlers.me, 'open'],
    ['POST', /^\/api\/register$/, handlers.register, 'open'],
    ['POST', /^\/api\/login$/, handlers.login, 'open'],
    ['POST', /^\/api\/logout$/, handlers.logout, 'open'],
    ['POST', /^\/api\/me\/delete$/, handlers.deleteMe, 'member'],
    ['GET', /^\/api\/posts$/, handlers.listPosts, 'member'],
    ['POST', /^\/api\/posts$/, handlers.createPost, 'member'],
    ['DELETE', /^\/api\/posts\/(\d{1,15})$/, handlers.deletePost, 'member'],
    ['PUT', /^\/api\/posts\/(\d{1,15})\/reactions\/([a-z]{1,20})$/, handlers.setReaction, 'member'],
    ['POST', /^\/api\/posts\/(\d{1,15})\/report$/, handlers.reportPost, 'member'],
    ['DELETE', /^\/api\/posts\/(\d{1,15})\/reports$/, handlers.clearReports, 'admin'],
    ['GET', /^\/api\/stats$/, handlers.stats, 'member'],
    ['GET', /^\/api\/invites$/, handlers.listInvites, 'admin'],
    ['POST', /^\/api\/invites$/, handlers.createInvite, 'admin'],
  ];

  async function handleApi(req, res, url) {
    let matched = null;
    let pathKnown = false;
    for (const route of routes) {
      const m = route[1].exec(url.pathname);
      if (!m) continue;
      pathKnown = true;
      if (route[0] === req.method) { matched = { handler: route[2], access: route[3], params: m.slice(1) }; break; }
    }
    if (!matched) throw new HttpError(pathKnown ? 405 : 404, pathKnown ? 'Dit kan hier niet.' : 'Niet gevonden.');

    // Verzoeken die iets wijzigen moeten van onze eigen pagina komen. Een andere website kan
    // deze kop niet meesturen zonder toestemming van de server, en die geven we niet.
    if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'linkedout') {
      throw new HttpError(403, 'Dit verzoek kwam niet van LinkedOut zelf.');
    }

    const token = readCookie(req);
    const user = token ? store.sessionUser(auth.hashToken(token), cfg.now()) : null;
    if (matched.access !== 'open' && !user) throw new HttpError(401, 'Log eerst in.');
    if (matched.access === 'admin' && !user.isAdmin) throw new HttpError(403, 'Dit kan alleen de beheerder.');

    const body = req.method === 'GET' ? {} : await readBody(req);
    const out = await matched.handler({ req, url, params: matched.params, user: user || null, body });
    // Een handler geeft de gegevens zelf terug (status 200), of { status, body, headers }.
    if (out && (typeof out.status === 'number' || out.headers)) {
      const status = out.status || 200;
      return sendJson(res, status, status === 204 ? undefined : out.body, out.headers);
    }
    return sendJson(res, 200, out);
  }

  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Dit kan hier niet.');
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch (err) { throw new HttpError(400, 'Ongeldig adres.'); }
    if (rel.includes('\0')) throw new HttpError(400, 'Ongeldig adres.');
    if (rel === '/') rel = '/index.html';
    const file = path.join(cfg.publicDir, path.normalize(rel));
    const type = MIME[path.extname(file).toLowerCase()];
    if (!file.startsWith(cfg.publicDir + path.sep) || !type) throw new HttpError(404, 'Niet gevonden.');
    let data;
    try { data = fs.readFileSync(file); } catch (err) { throw new HttpError(404, 'Niet gevonden.'); }
    res.writeHead(200, Object.assign(baseHeaders(), {
      'Content-Type': type,
      'Content-Length': data.length,
      'Cache-Control': file.includes(path.sep + 'fonts' + path.sep) ? 'public, max-age=31536000, immutable' : 'no-cache',
    }));
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  async function handle(req, res) {
    try {
      const url = new URL(req.url, 'http://linkedout.local');
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else serveStatic(req, res, url);
    } catch (err) {
      if (res.headersSent) { res.end(); return; }
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, field: err.field });
      } else {
        console.error(err);
        sendJson(res, 500, { error: 'Er ging iets mis op de server. Probeer het opnieuw.' });
      }
    }
  }

  // ---------- beheer buiten de website om (opstarten, cli) ----------

  function createInvite(makesAdmin) {
    const now = cfg.now();
    const code = auth.newInviteCode();
    store.createInvite(code, null, !!makesAdmin, now, now + INVITE_MS);
    return code;
  }

  // Eerste keer opstarten: nog niemand heeft een account. Geeft een beheerderscode terug.
  function bootstrapInvite() {
    if (store.countUsers() > 0) return null;
    const open = store.openInvites(cfg.now()).find((i) => i.makesAdmin);
    return open ? open.code : createInvite(true);
  }

  return { handle, store, createInvite, bootstrapInvite, close: () => db.close() };
}

module.exports = { createApp };
