import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// Self-contained SQLite store. The whole backend runs from one file on disk;
// swap this out for a hosted database later without touching call sites.
const DATA_DIR = join(process.cwd(), ".data");
const DB_PATH = join(DATA_DIR, "nvc.db");

function init(): Database.Database {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
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
      purpose    TEXT NOT NULL,            -- 'verify' | 'login'
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
      role      TEXT NOT NULL DEFAULT 'member',   -- 'owner' | 'member'
      status    TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'left'
      joined_at TEXT NOT NULL,
      UNIQUE(group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invites (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL REFERENCES groups(id),
      email      TEXT NOT NULL,
      invited_by TEXT NOT NULL REFERENCES users(id),
      status     TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'declined' | 'revoked'
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email, status);

    -- Dev "outbox": every outgoing email lands here so codes and invites are
    -- previewable until a real email provider is wired in.
    CREATE TABLE IF NOT EXISTS outbox (
      id         TEXT PRIMARY KEY,
      to_email   TEXT NOT NULL,
      subject    TEXT NOT NULL,
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Persist a session-signing secret so cookies survive restarts in dev.
  const existing = db
    .prepare("SELECT value FROM meta WHERE key = 'session_secret'")
    .get() as { value: string } | undefined;
  if (!existing) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('session_secret', ?)").run(
      randomBytes(48).toString("hex"),
    );
  }

  return db;
}

// Reuse one connection across hot reloads.
const g = globalThis as unknown as { __nvcDb?: Database.Database };
export const db: Database.Database = g.__nvcDb ?? init();
if (process.env.NODE_ENV !== "production") g.__nvcDb = db;

export function sessionSecret(): Uint8Array {
  const row = db
    .prepare("SELECT value FROM meta WHERE key = 'session_secret'")
    .get() as { value: string };
  return new TextEncoder().encode(row.value);
}
