CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL,
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 40),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL,
  ip_hash TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS comments_paper_created_idx ON comments (paper_id, created_at DESC);
