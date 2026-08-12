import { db } from "./db";
import { newId } from "./crypto";

/**
 * Email delivery. In this self-contained build every message is written to the
 * `outbox` table (and logged), so 2FA codes, verification codes, and invites
 * are all previewable at /dev/outbox. To go live, implement `deliver()` with a
 * real provider (e.g. Resend) — nothing else in the app changes.
 */
export type OutgoingEmail = {
  to: string;
  subject: string;
  body: string;
};

async function deliver(email: OutgoingEmail): Promise<void> {
  // Placeholder for a real provider. Example:
  //   await resend.emails.send({ from, to: email.to, subject, text: body });
  if (process.env.RESEND_API_KEY) {
    // Intentionally not wired yet — surfaces clearly if a key is set early.
    console.warn("[email] RESEND_API_KEY is set but no provider is wired yet.");
  }
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  db.prepare(
    "INSERT INTO outbox (id, to_email, subject, body, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(newId(), email.to.toLowerCase(), email.subject, email.body, new Date().toISOString());

  console.log(`[email] to=${email.to} subject="${email.subject}"`);
  await deliver(email);
}
