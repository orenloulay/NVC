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
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Set to the email that already has a pending invite, so we can offer to
  // send a fresh one instead of silently blocking.
  const [resendFor, setResendFor] = useState<string | null>(null);

  const full = members.length >= maxMembers;

  async function sendInvite(email: string, resend: boolean) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/groups/${groupId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, resend }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      // Already invited: this is not a failure — offer to send a fresh invite.
      if (data.alreadyInvited) {
        setResendFor(email);
        setMsg(null);
        return;
      }
      setResendFor(null);
      setMsg({ kind: "err", text: data.error ?? "Could not send the invite." });
      return;
    }
    setResendFor(null);
    setMsg({
      kind: "ok",
      text: resend ? `A new invite was sent to ${email}.` : `Invitation sent to ${email}.`,
    });
    setInviteEmail("");
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    await sendInvite(inviteEmail, false);
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
              msg.kind === "ok"
                ? "text-teal-600 dark:text-teal-400"
                : msg.kind === "info"
                  ? "text-neutral-600 dark:text-neutral-300"
                  : "text-red-600 dark:text-red-400"
            }`}
          >
            {msg.text}
          </p>
        )}
        {resendFor && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-amber-800 dark:text-amber-200">
              You already invited <span className="font-medium">{resendFor}</span>, but they
              haven’t accepted yet. Send the invite again?
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => sendInvite(resendFor, true)}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send new invite"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setResendFor(null);
                  setMsg(null);
                }}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
