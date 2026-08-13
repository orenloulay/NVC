import { NextResponse } from "next/server";
import { dbGet, dbRun } from "@/lib/db";
import { normalizeEmail } from "@/lib/validation";
import { checkCode } from "@/lib/authcodes";
import { createSession } from "@/lib/session";

// Confirms the signup code, activates the account, and signs the user in.
export async function POST(req: Request) {
  const { email: rawEmail, code } = await req.json().catch(() => ({}));
  const email = normalizeEmail(rawEmail);
  if (!email || typeof code !== "string") {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }

  const result = await checkCode(email, "verify", code.trim());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const user = await dbGet<{ id: string }>("SELECT id FROM users WHERE email = ?", [email]);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  await dbRun("UPDATE users SET email_verified = 1 WHERE id = ?", [user.id]);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
