-- Run manually against the Neon database (no migration tool for a schema this small):
--   psql "$DATABASE_URL" -f src/lib/db/schema.sql

-- Auth.js core tables (shape required by @auth/pg-adapter)
CREATE TABLE IF NOT EXISTS users (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT,
  email          TEXT UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image          TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                VARCHAR(255) NOT NULL,
  provider            VARCHAR(255) NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  token_type          VARCHAR(255),
  scope               VARCHAR(255),
  id_token            TEXT,
  session_state       VARCHAR(255),
  UNIQUE(provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS sessions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires        TIMESTAMPTZ NOT NULL,
  "sessionToken" VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  token      TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- App-specific table: one row per app-user's linked SnapTrade identity.
-- SnapTrade's userSecret is required on every subsequent API call for this
-- user, so it's stored (encrypted) rather than re-derived. Never select
-- user_secret_encrypted outside a server-only route handler.
CREATE TABLE IF NOT EXISTS brokerage_connections (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snaptrade_user_id      TEXT NOT NULL,
  user_secret_encrypted  TEXT NOT NULL, -- AES-256-GCM, see src/lib/db/connections.ts
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("userId")
);

-- Invite/approval gate for sign-in, checked by src/auth.ts's signIn callback
-- in addition to the OWNER_EMAILS allowlist. Populated via the /admin page
-- (src/app/api/admin/approve/route.ts), which promotes a waitlist signup
-- (src/lib/waitlist.ts) into real access.
CREATE TABLE IF NOT EXISTS approved_emails (
  email      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personal-podcast episodes (kept out of git — see src/lib/storage.ts).
CREATE TABLE IF NOT EXISTS personal_episodes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  script            TEXT,
  audio_url         TEXT,
  duration_seconds  INTEGER,
  word_count        INTEGER,
  article_count     INTEGER,
  generated_at      TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("userId", date)
);
