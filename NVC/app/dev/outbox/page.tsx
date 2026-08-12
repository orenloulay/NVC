import { db } from "@/lib/db";
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
export default function OutboxPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const mails = db
    .prepare("SELECT * FROM outbox ORDER BY created_at DESC LIMIT 50")
    .all() as Mail[];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Dev outbox</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every outgoing email lands here until a real provider is wired in. Newest first.
      </p>
      <div className="mt-6 flex flex-col gap-4">
        {mails.length === 0 && (
          <p className="text-sm text-neutral-500">No emails yet.</p>
        )}
        {mails.map((m) => (
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
          </div>
        ))}
      </div>
    </main>
  );
}
