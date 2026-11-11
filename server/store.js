'use strict';

// Alle SQL staat in dit bestand. Wie later naar een andere database wil (bijv. Postgres),
// hoeft alleen dit bestand en db.js te vervangen; de rest van de server kent geen SQL.

const REACTION_KINDS = ['herkenbaar', 'au', 'respect'];

function createStore(db) {
  const cache = new Map();
  const q = (sql) => {
    let stmt = cache.get(sql);
    if (!stmt) { stmt = db.prepare(sql); cache.set(sql, stmt); }
    return stmt;
  };

  function tx(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  const POST_COLUMNS = `
    p.id, p.type, p.data, p.created_at AS createdAt, p.user_id AS userId, u.alias AS author,
    ${REACTION_KINDS.map((k) => `(SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id AND r.kind = '${k}') AS ${k}`).join(',\n    ')},
    (SELECT group_concat(r.kind) FROM reactions r WHERE r.post_id = p.id AND r.user_id = ?) AS mine,
    (SELECT COUNT(*) FROM reports x WHERE x.post_id = p.id AND x.user_id = ?) AS reportedByMe,
    (SELECT COUNT(*) FROM reports x WHERE x.post_id = p.id) AS reports`;

  return {
    REACTION_KINDS,
    tx,

    // ----- gebruikers -----
    countUsers: () => q('SELECT COUNT(*) AS n FROM users').get().n,
    userById: (id) => q('SELECT id, alias, password_hash AS passwordHash, is_admin AS isAdmin FROM users WHERE id = ?').get(id),
    userByAlias: (alias) => q('SELECT id, alias, password_hash AS passwordHash, is_admin AS isAdmin FROM users WHERE alias = ?').get(alias),
    createUser: (alias, passwordHash, isAdmin, now) =>
      Number(q('INSERT INTO users (alias, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?)').run(alias, passwordHash, isAdmin ? 1 : 0, now).lastInsertRowid),
    deleteUser: (id) => q('DELETE FROM users WHERE id = ?').run(id),
    setPassword: (id, passwordHash) => q('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id),
    setAdmin: (id, isAdmin) => q('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, id),

    // ----- uitnodigingen -----
    createInvite: (code, createdBy, makesAdmin, now, expiresAt) =>
      q('INSERT INTO invites (code, makes_admin, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(code, makesAdmin ? 1 : 0, createdBy, now, expiresAt),
    openInvite: (code, now) =>
      q('SELECT code, makes_admin AS makesAdmin, expires_at AS expiresAt FROM invites WHERE code = ? AND used_at IS NULL AND expires_at > ?').get(code, now),
    openInvites: (now) =>
      q('SELECT code, makes_admin AS makesAdmin, expires_at AS expiresAt FROM invites WHERE used_at IS NULL AND expires_at > ? ORDER BY created_at DESC').all(now),
    useInvite: (code, userId, now) => q('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?').run(userId, now, code),

    // ----- sessies -----
    createSession: (tokenHash, userId, now, expiresAt) =>
      q('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(tokenHash, userId, now, expiresAt),
    sessionUser: (tokenHash, now) =>
      q(`SELECT u.id, u.alias, u.password_hash AS passwordHash, u.is_admin AS isAdmin
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`).get(tokenHash, now),
    deleteSession: (tokenHash) => q('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash),
    deleteSessionsForUser: (userId) => q('DELETE FROM sessions WHERE user_id = ?').run(userId),
    deleteExpiredSessions: (now) => q('DELETE FROM sessions WHERE expires_at <= ?').run(now),

    // ----- posts -----
    createPost: (userId, type, data, now) =>
      Number(q('INSERT INTO posts (user_id, type, data, created_at) VALUES (?, ?, ?, ?)').run(userId, type, JSON.stringify(data), now).lastInsertRowid),
    postOwner: (id) => q('SELECT id, user_id AS userId FROM posts WHERE id = ?').get(id),
    getPost: (id, viewerId) =>
      q(`SELECT ${POST_COLUMNS} FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`).get(viewerId, viewerId, id),
    listPosts: ({ viewerId, type, sort, reportedOnly, limit, offset }) => {
      const where = [];
      const args = [viewerId, viewerId];
      if (type) { where.push('p.type = ?'); args.push(type); }
      if (reportedOnly) where.push('EXISTS (SELECT 1 FROM reports x WHERE x.post_id = p.id)');
      const order = sort === 'herkenbaar' ? 'herkenbaar DESC, p.created_at DESC, p.id DESC' : 'p.created_at DESC, p.id DESC';
      args.push(limit, offset);
      return q(`SELECT ${POST_COLUMNS} FROM posts p JOIN users u ON u.id = p.user_id
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args);
    },
    deletePost: (id) => q('DELETE FROM posts WHERE id = ?').run(id),

    // ----- reacties en meldingen -----
    setReaction: (postId, userId, kind, on, now) => {
      if (on) q('INSERT OR IGNORE INTO reactions (post_id, user_id, kind, created_at) VALUES (?, ?, ?, ?)').run(postId, userId, kind, now);
      else q('DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND kind = ?').run(postId, userId, kind);
    },
    addReport: (postId, userId, now) =>
      q('INSERT OR IGNORE INTO reports (post_id, user_id, created_at) VALUES (?, ?, ?)').run(postId, userId, now),
    clearReports: (postId) => q('DELETE FROM reports WHERE post_id = ?').run(postId),

    // ----- cijfers -----
    meetingStats: () =>
      q(`SELECT COUNT(*) AS meetingCount,
                COALESCE(SUM(json_extract(data, '$.mensen') * json_extract(data, '$.minuten')), 0) / 60.0 AS meetingHours
         FROM posts WHERE type = 'meeting'`).get(),
  };
}

module.exports = { createStore, REACTION_KINDS };
