import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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

  const result = checkCode(email, "verify", code.trim());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: string }
    | undefined;
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(user.id);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
