import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId, hashPassword } from "@/lib/crypto";
import { normalizeEmail, passwordProblem } from "@/lib/validation";
import { issueCode } from "@/lib/authcodes";

export async function POST(req: Request) {
  const { email: rawEmail, password } = await req.json().catch(() => ({}));
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const pwProblem = passwordProblem(password);
  if (pwProblem) return NextResponse.json({ error: pwProblem }, { status: 400 });

  const existing = db.prepare("SELECT id, email_verified FROM users WHERE email = ?").get(email) as
    | { id: string; email_verified: number }
    | undefined;

  if (existing?.email_verified) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  if (existing) {
    // Unverified account — let them restart with a fresh password + code.
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), existing.id);
  } else {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, email_verified, created_at) VALUES (?, ?, ?, 0, ?)",
    ).run(newId(), email, hashPassword(password), new Date().toISOString());
  }

  await issueCode(email, "verify");
  return NextResponse.json({ ok: true, needsVerification: true, email });
}
