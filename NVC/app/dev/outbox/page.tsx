import { dbAll } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Mail = {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  created_at: string;
};

// Dev-only preview of the email outbox. Not available in production builds.
export default async function OutboxPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const mails = await dbAll<Mail>(
    "SELECT * FROM outbox ORDER BY created_at DESC LIMIT 50",
  );

  const withAttachments = await Promise.all(
    mails.map(async (m) => ({
      mail: m,
      attachments: await dbAll<{ id: string; filename: string }>(
        "SELECT id, filename FROM outbox_attachments WHERE outbox_id = ?",
        [m.id],
      ),
    })),
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Dev outbox</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every outgoing email lands here until a real provider is wired in. Newest first.
      </p>
      <div className="mt-6 flex flex-col gap-4">
        {withAttachments.length === 0 && (
          <p className="text-sm text-neutral-500">No emails yet.</p>
        )}
        {withAttachments.map(({ mail: m, attachments }) => (
          <div
            key={m.id}
            className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{m.subject}</span>
              <span className="shrink-0 text-xs text-neutral-400">
                {new Date(m.created_at).toLocaleString()}
              </span>
            </div>
            <div className="mt-1 text-xs text-teal-700 dark:text-teal-300">to {m.to_email}</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">
              {m.body}
            </pre>
            {attachments.map((a) => (
              <a
                key={a.id}
                href={`/dev/outbox/attachment/${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300"
              >
                📎 {a.filename}
              </a>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
