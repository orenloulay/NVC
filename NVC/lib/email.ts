import { db } from "./db";
import { newId } from "./crypto";

/**
 * Email delivery. In this self-contained build every message is written to the
 * `outbox` table (and logged), so 2FA codes, verification codes, and invites
 * are all previewable at /dev/outbox. To go live, implement `deliver()` with a
 * real provider (e.g. Resend) — nothing else in the app changes.
 */
export type Attachment = {
  filename: string;
  content: Uint8Array;
};

export type OutgoingEmail = {
  to: string;
  subject: string;
  body: string;
  attachments?: Attachment[];
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
  const outboxId = newId();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO outbox (id, to_email, subject, body, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(outboxId, email.to.toLowerCase(), email.subject, email.body, now);

  for (const att of email.attachments ?? []) {
    db.prepare(
      "INSERT INTO outbox_attachments (id, outbox_id, filename, content, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(newId(), outboxId, att.filename, Buffer.from(att.content), now);
  }

  console.log(`[email] to=${email.to} subject="${email.subject}"`);
  await deliver(email);
}
