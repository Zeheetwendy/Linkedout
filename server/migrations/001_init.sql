-- Eerste versie: accounts op uitnodiging, posts, reacties en meldingen.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  alias         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE invites (
  code        TEXT    PRIMARY KEY,
  makes_admin INTEGER NOT NULL DEFAULT 0,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  used_at     INTEGER
);

CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE posts (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,
  data       TEXT    NOT NULL, -- JSON met de velden van dit soort post
  created_at INTEGER NOT NULL
);

CREATE INDEX posts_created ON posts(created_at DESC, id DESC);
CREATE INDEX posts_type ON posts(type, created_at DESC);
CREATE INDEX posts_user ON posts(user_id);

CREATE TABLE reactions (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id, kind)
);

CREATE INDEX reactions_user ON reactions(user_id);

CREATE TABLE reports (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX reports_user ON reports(user_id);
