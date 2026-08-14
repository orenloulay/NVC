"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Msg = {
  id: string;
  senderEmail: string;
  mine: boolean;
  text: string;
  nvc?: string;
  approved: boolean;
  engine: "claude" | "fallback";
  createdAt: string;
};

type Lang = "en" | "he";

export default function ChatView({ groupId, groupName }: { groupId: string; groupName: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/chat`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    }
  }, [groupId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/groups/${groupId}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body, lang }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not send.");
      return;
    }
    setText("");
    load();
  }

  async function approve(id: string) {
    setError(null);
    const res = await fetch(`/api/groups/${groupId}/chat/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not approve.");
    }
    load();
  }

  async function discard(id: string) {
    setError(null);
    const res = await fetch(`/api/groups/${groupId}/chat/discard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not discard.");
    }
    load();
  }

  async function endSession() {
    if (!confirm("End this session? A PDF record will be emailed to the group and the chat will be cleared.")) return;
    setEnding(true);
    const res = await fetch(`/api/groups/${groupId}/chat/end`, { method: "POST" });
    setEnding(false);
    if (res.ok) {
      const data = await res.json();
      alert(`Session ended. A PDF was emailed to ${data.emailedTo} member(s).`);
      router.push(`/app/g/${groupId}`);
      router.refresh();
    }
  }

  const dir = lang === "he" ? "rtl" : "ltr";

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col px-4 py-4">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <Link href={`/app/g/${groupId}`} className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400">
          ← {groupName}
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang((l) => (l === "en" ? "he" : "en"))}
            className="rounded-full border border-teal-200 px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300"
          >
            {lang === "en" ? "עברית" : "English"}
          </button>
          <button
            onClick={endSession}
            disabled={ending}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {ending ? "Ending…" : "End session"}
          </button>
        </div>
      </header>

      <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800 dark:bg-teal-950/30 dark:text-teal-200">
        Write what you honestly feel. You’ll first see the Nonviolent Communication translation the
        others would receive, and nothing is shared until you approve it. Nothing here is saved; a
        PDF record of the approved messages is emailed when the session ends.
      </p>

      <div ref={scrollRef} className="mt-3 flex flex-1 flex-col gap-3 overflow-y-auto py-2">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-neutral-400">No messages yet. Say what’s on your heart.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
            <span className="px-1 text-xs text-neutral-400">
              {m.mine ? "You" : m.senderEmail}
            </span>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                m.mine
                  ? m.approved
                    ? "bg-teal-600 text-white"
                    : "border border-dashed border-teal-400 bg-teal-50 text-neutral-800 dark:bg-teal-950/20 dark:text-neutral-100"
                  : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
              }`}
            >
              {m.text}
            </div>

            {/* Author reviewing their own not-yet-approved draft. */}
            {m.mine && !m.approved && (
              <div className="mt-1 flex max-w-[85%] flex-col items-end gap-1.5 rounded-2xl border border-teal-200 bg-white px-3.5 py-2.5 text-sm dark:border-teal-800 dark:bg-neutral-900">
                <span className="self-start text-[11px] font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                  They’ll see
                </span>
                <p className="self-start text-left text-neutral-800 dark:text-neutral-100">
                  {m.nvc}
                </p>
                {m.engine === "fallback" && (
                  <span className="self-start text-[10px] text-amber-500">draft translation</span>
                )}
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => discard(m.id)}
                    className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => approve(m.id)}
                    className="rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    Approve &amp; send
                  </button>
                </div>
              </div>
            )}

            {m.mine && !m.approved && (
              <span className="px-1 text-[10px] text-neutral-400">
                Not shared yet — awaiting your approval
              </span>
            )}
            {!m.mine && m.engine === "fallback" && (
              <span className="px-1 text-[10px] text-amber-500">draft translation</span>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={send} dir={dir} className="mt-2 flex items-end gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          rows={2}
          placeholder={lang === "he" ? "כתבו מה אתם מרגישים…" : "Write what you feel…"}
          className="flex-1 resize-none rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </main>
  );
}
