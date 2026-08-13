import { NextResponse } from "next/server";
import { dbGet, dbRun } from "@/lib/db";
import { newId, hashPassword } from "@/lib/crypto";
import { normalizeEmail, passwordProblem } from "@/lib/validation";
import { issueCode } from "@/lib/authcodes";

export async function POST(req: Request) {
  const { email: rawEmail, password } = await req.json().catch(() => ({}));
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const pwProblem = passwordProblem(password);
  if (pwProblem) return NextResponse.json({ error: pwProblem }, { status: 400 });

  const existing = await dbGet<{ id: string; email_verified: number }>(
    "SELECT id, email_verified FROM users WHERE email = ?",
    [email],
  );

  if (existing?.email_verified) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  if (existing) {
    // Unverified account — let them restart with a fresh password + code.
    await dbRun("UPDATE users SET password_hash = ? WHERE id = ?", [
      hashPassword(password),
      existing.id,
    ]);
  } else {
    await dbRun(
      "INSERT INTO users (id, email, password_hash, email_verified, created_at) VALUES (?, ?, ?, 0, ?)",
      [newId(), email, hashPassword(password), new Date().toISOString()],
    );
  }

  await issueCode(email, "verify");
  return NextResponse.json({ ok: true, needsVerification: true, email });
}
