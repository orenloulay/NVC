import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/validation";
import { issueCode } from "@/lib/authcodes";
import { readChallenge } from "@/lib/session";

// Re-send the code for whichever flow the user is in.
export async function POST(req: Request) {
  const { email: rawEmail, purpose } = await req.json().catch(() => ({}));

  if (purpose === "login") {
    const email = await readChallenge();
    if (!email) return NextResponse.json({ error: "Sign-in session expired." }, { status: 400 });
    await issueCode(email, "login");
    return NextResponse.json({ ok: true });
  }

  // verify
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  const user = db.prepare("SELECT email_verified FROM users WHERE email = ?").get(email) as
    | { email_verified: number }
    | undefined;
  if (user && !user.email_verified) await issueCode(email, "verify");
  // Uniform ok regardless, to avoid leaking account existence.
  return NextResponse.json({ ok: true });
}
