import { db } from "./db";
import { newId, generateCode, hashCode, verifyCode } from "./crypto";
import { sendEmail } from "./email";

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

type Purpose = "verify" | "login";

const subjects: Record<Purpose, string> = {
  verify: "Verify your NVC account",
  login: "Your NVC sign-in code",
};

export async function issueCode(email: string, purpose: Purpose): Promise<void> {
  // Invalidate any outstanding codes of the same purpose for this email.
  db.prepare(
    "UPDATE auth_codes SET consumed = 1 WHERE email = ? AND purpose = ? AND consumed = 0",
  ).run(email, purpose);

  const code = generateCode();
  const expires = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();
  db.prepare(
    `INSERT INTO auth_codes (id, email, code_hash, purpose, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(newId(), email, hashCode(code), purpose, expires, new Date().toISOString());

  await sendEmail({
    to: email,
    subject: subjects[purpose],
    body:
      `Your ${CODE_TTL_MIN}-minute code is: ${code}\n\n` +
      `Enter it in the app to ${purpose === "verify" ? "verify your account" : "finish signing in"}.\n` +
      `If you didn't request this, you can ignore this email.`,
  });
}

type CheckResult = { ok: true } | { ok: false; error: string };

export function checkCode(email: string, purpose: Purpose, code: string): CheckResult {
  const row = db
    .prepare(
      `SELECT * FROM auth_codes
       WHERE email = ? AND purpose = ? AND consumed = 0
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(email, purpose) as
    | { id: string; code_hash: string; expires_at: string; attempts: number }
    | undefined;

  if (!row) return { ok: false, error: "No active code. Request a new one." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("UPDATE auth_codes SET consumed = 1 WHERE id = ?").run(row.id);
    return { ok: false, error: "Code expired. Request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    db.prepare("UPDATE auth_codes SET consumed = 1 WHERE id = ?").run(row.id);
    return { ok: false, error: "Too many attempts. Request a new one." };
  }

  if (!verifyCode(code, row.code_hash)) {
    db.prepare("UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return { ok: false, error: "Incorrect code." };
  }

  db.prepare("UPDATE auth_codes SET consumed = 1 WHERE id = ?").run(row.id);
  return { ok: true };
}
