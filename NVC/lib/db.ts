import { createClient, type Client, type InArgs, type Row } from "@libsql/client/web";
import { randomBytes } from "node:crypto";

// Hosted libSQL / Turso database. The whole backend runs against one remote
// SQLite-compatible database, so state persists on serverless platforms
// (e.g. Vercel) where the local filesystem is ephemeral and read-only.
//
// Set these in your environment (locally in .env.local, on Vercel in the
// project's Environment Variables):
//   TURSO_DATABASE_URL   libsql://<your-db>.turso.io
//   TURSO_AUTH_TOKEN     the database auth token
// The client is created lazily on first use (not at import time) so that
// `next build`, which imports every route module, doesn't require the database
// env vars to be present at build time — only at request time.
const g = globalThis as unknown as { __nvcClient?: Client };
export function getClient(): Client {
  if (g.__nvcClient) return g.__nvcClient;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Create a free database at https://turso.tech, " +
        "then set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your environment.",
    );
  }
  // Reuse one client across hot reloads (dev) and warm invocations (serverless).
  g.__nvcClient = createClient({ url, authToken });
  return g.__nvcClient;
}

// The SQL is unchanged from the original SQLite schema — libSQL is SQLite.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);

-- One-time 6-digit codes: email verification at signup and 2FA at login.
CREATE TABLE IF NOT EXISTS auth_codes (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  consumed   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email, purpose);

CREATE TABLE IF NOT EXISTS groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id        TEXT PRIMARY KEY,
  group_id  TEXT NOT NULL REFERENCES groups(id),
  user_id   TEXT NOT NULL REFERENCES users(id),
  role      TEXT NOT NULL DEFAULT 'member',
  status    TEXT NOT NULL DEFAULT 'active',
  joined_at TEXT NOT NULL,
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id),
  email      TEXT NOT NULL,
  invited_by TEXT NOT NULL REFERENCES users(id),
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email, status);

-- Outbox: every outgoing email is recorded here (previewable at /dev/outbox in
-- development). Delivery to a real provider happens in lib/email.ts.
CREATE TABLE IF NOT EXISTS outbox (
  id         TEXT PRIMARY KEY,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_attachments (
  id         TEXT PRIMARY KEY,
  outbox_id  TEXT NOT NULL REFERENCES outbox(id),
  filename   TEXT NOT NULL,
  content    BLOB NOT NULL,
  created_at TEXT NOT NULL
);
`;

// Ensure the schema exists and a session-signing secret is seeded — exactly
// once per process. Every query helper awaits this first (it resolves instantly
// after the first call), so a cold start self-initialises the database.
let schemaReady: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = getClient();
      await client.executeMultiple(SCHEMA);
      const res = await client.execute(
        "SELECT value FROM meta WHERE key = 'session_secret'",
      );
      if (res.rows.length === 0) {
        await client.execute({
          sql: "INSERT INTO meta (key, value) VALUES ('session_secret', ?)",
          args: [randomBytes(48).toString("hex")],
        });
      }
    })().catch((err) => {
      // Reset so a later request can retry after a transient failure.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// libSQL rows carry both named and positional access; normalise to a plain
// object keyed by column name so call sites can spread/serialise them safely.
function toObject<T>(row: Row, columns: string[]): T {
  const o: Record<string, unknown> = {};
  for (const c of columns) o[c] = row[c];
  return o as T;
}

export async function dbGet<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
  await ensureSchema();
  const res = await getClient().execute({ sql, args });
  const row = res.rows[0];
  return row ? toObject<T>(row, res.columns) : undefined;
}

export async function dbAll<T>(sql: string, args: InArgs = []): Promise<T[]> {
  await ensureSchema();
  const res = await getClient().execute({ sql, args });
  return res.rows.map((r) => toObject<T>(r, res.columns));
}

export async function dbRun(sql: string, args: InArgs = []): Promise<void> {
  await ensureSchema();
  await getClient().execute({ sql, args });
}

// Session-signing secret. Prefer an explicit SESSION_SECRET env var (stable
// across redeploys); otherwise fall back to the one persisted in the database.
let cachedSecret: Uint8Array | null = null;
export async function sessionSecret(): Promise<Uint8Array> {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) {
    cachedSecret = new TextEncoder().encode(fromEnv);
    return cachedSecret;
  }
  const row = await dbGet<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'session_secret'",
  );
  if (!row) throw new Error("Session secret is missing from the database.");
  cachedSecret = new TextEncoder().encode(row.value);
  return cachedSecret;
}
