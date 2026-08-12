"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { userId: string; email: string; role: "owner" | "member" };

export default function GroupView({
  groupId,
  groupName,
  members,
  currentUserId,
  maxMembers,
}: {
  groupId: string;
  groupName: string;
  members: Member[];
  currentUserId: string;
  maxMembers: number;
}) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const full = members.length >= maxMembers;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/groups/${groupId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: data.error ?? "Could not send the invite." });
      return;
    }
    setMsg({ kind: "ok", text: `Invitation sent to ${inviteEmail}.` });
    setInviteEmail("");
  }

  async function leave() {
    if (!confirm("Leave this group? You'll need a new invitation to rejoin.")) return;
    await fetch(`/api/groups/${groupId}/leave`, { method: "POST" });
    router.push("/app");
    router.refresh();
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{groupName}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {members.length} of {maxMembers} people
          </p>
        </div>
        <button
          onClick={leave}
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Leave
        </button>
      </div>

      <button
        onClick={() => router.push(`/app/g/${groupId}/chat`)}
        className="rounded-xl bg-teal-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-teal-700"
      >
        Start / continue the conversation
      </button>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">People</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-2.5 text-sm dark:border-neutral-800"
            >
              <span>
                {m.email}
                {m.userId === currentUserId ? " (you)" : ""}
              </span>
              {m.role === "owner" && (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                  creator
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Invite someone
        </h2>
        {full ? (
          <p className="mt-3 text-sm text-neutral-500">
            This group is full ({maxMembers} people).
          </p>
        ) : (
          <form onSubmit={invite} className="mt-3 flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="their@email.com"
              className="flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-neutral-700"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              Invite
            </button>
          </form>
        )}
        {msg && (
          <p
            className={`mt-2 text-sm ${
              msg.kind === "ok" ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {msg.text}
          </p>
        )}
      </section>
    </div>
  );
}
