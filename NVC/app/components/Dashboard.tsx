"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Group = {
  id: string;
  name: string;
  role: "owner" | "member";
  memberCount: number;
};
type Invite = {
  id: string;
  groupId: string;
  groupName: string;
  invitedByEmail: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/groups");
    if (res.ok) {
      const data = await res.json();
      setGroups(data.groups ?? []);
      setInvites(data.invites ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not create the topic.");
      return;
    }
    setName("");
    router.push(`/app/g/${data.id}`);
  }

  async function respondInvite(id: string, action: "accept" | "decline") {
    await fetch(`/api/invites/${id}/${action}`, { method: "POST" });
    await load();
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      {invites.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Invitations
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{inv.groupName}</p>
                  <p className="truncate text-sm text-neutral-500">
                    invited by {inv.invitedByEmail}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => respondInvite(inv.id, "accept")}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respondInvite(inv.id, "decline")}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          New topic
        </h2>
        <form onSubmit={createGroup} className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What would you like to talk about?"
            className="flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-neutral-700"
          />
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Create
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Your topics
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No topics yet. Create one above, or accept an invitation.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {groups.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => router.push(`/app/g/${g.id}`)}
                  className="flex w-full items-center justify-between rounded-xl border border-neutral-200 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/50 dark:border-neutral-800 dark:hover:border-teal-800 dark:hover:bg-neutral-800/50"
                >
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-sm text-neutral-500">
                      {g.memberCount} {g.memberCount === 1 ? "person" : "people"}
                      {g.role === "owner" ? " · you created this" : ""}
                    </p>
                  </div>
                  <span className="text-neutral-400">→</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
