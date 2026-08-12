import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCode } from "@/lib/authcodes";
import { readChallenge, clearChallenge, createSession } from "@/lib/session";

// Step 2 of login: check the emailed 2FA code against the pending challenge.
export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({}));
  const email = await readChallenge();
  if (!email) {
    return NextResponse.json({ error: "Your sign-in session expired. Start again." }, { status: 400 });
  }
  if (typeof code !== "string") {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }

  const result = checkCode(email, "login", code.trim());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: string }
    | undefined;
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  await clearChallenge();
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
