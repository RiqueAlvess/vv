CREATE TABLE IF NOT EXISTS core.articles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  slug       text        NOT NULL UNIQUE,
  content    text        NOT NULL DEFAULT '',
  cover_url  text,
  pinned     boolean     NOT NULL DEFAULT false,
  published  boolean     NOT NULL DEFAULT true,
  author_id  uuid        NOT NULL REFERENCES core.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_pinned ON core.articles(pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_published ON core.articles(published);
