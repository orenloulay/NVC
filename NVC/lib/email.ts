import { dbRun } from "./db";
import { newId } from "./crypto";

/**
 * Email delivery.
 *
 * Every outgoing message is first recorded in the `outbox` table (previewable
 * at /dev/outbox in development). Then `deliver()` sends it for real:
 *
 *   - If RESEND_API_KEY is set, it sends via the Resend API (https://resend.com)
 *     using a plain fetch — no extra dependency. Set RESEND_FROM to the verified
 *     sender address (defaults to Resend's shared onboarding@resend.dev sandbox,
 *     which can only deliver to your own Resend account email).
 *   - Otherwise it just logs (development / preview via the outbox).
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] no RESEND_API_KEY set — not delivered (recorded in outbox only).`);
    return;
  }

  const from = process.env.RESEND_FROM ?? "NVC <onboarding@resend.dev>";
  const payload: Record<string, unknown> = {
    from,
    to: [email.to],
    subject: email.subject,
    text: email.body,
  };
  if (email.attachments?.length) {
    payload.attachments = email.attachments.map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.content).toString("base64"),
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[email] Resend delivery failed (${res.status}): ${detail}`);
    throw new Error("Email delivery failed.");
  }
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const outboxId = newId();
  const now = new Date().toISOString();
  await dbRun(
    "INSERT INTO outbox (id, to_email, subject, body, created_at) VALUES (?, ?, ?, ?, ?)",
    [outboxId, email.to.toLowerCase(), email.subject, email.body, now],
  );

  for (const att of email.attachments ?? []) {
    await dbRun(
      "INSERT INTO outbox_attachments (id, outbox_id, filename, content, created_at) VALUES (?, ?, ?, ?, ?)",
      [newId(), outboxId, att.filename, att.content, now],
    );
  }

  console.log(`[email] to=${email.to} subject="${email.subject}"`);
  await deliver(email);
}
