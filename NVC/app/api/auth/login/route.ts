import { NextResponse } from "next/server";
import { dbGet } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { normalizeEmail } from "@/lib/validation";
import { issueCode } from "@/lib/authcodes";
import { createChallenge } from "@/lib/session";

// Step 1 of login: check the password, then email a 2FA code.
export async function POST(req: Request) {
  const { email: rawEmail, password } = await req.json().catch(() => ({}));
  const email = normalizeEmail(rawEmail);
  if (!email || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await dbGet<{ id: string; password_hash: string; email_verified: number }>(
    "SELECT id, password_hash, email_verified FROM users WHERE email = ?",
    [email],
  );

  // Uniform response whether or not the account exists, to avoid leaking which
  // emails are registered.
  const invalid = NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  if (!user) return invalid;
  if (!verifyPassword(password, user.password_hash)) return invalid;

  if (!user.email_verified) {
    await issueCode(email, "verify");
    return NextResponse.json({ ok: true, needsVerification: true, email });
  }

  await issueCode(email, "login");
  await createChallenge(email);
  return NextResponse.json({ ok: true, needs2fa: true, email });
}
