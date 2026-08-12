import { db } from "./db";
import { newId } from "./crypto";
import { sendEmail } from "./email";

export const MAX_MEMBERS = 10;

export type GroupSummary = {
  id: string;
  name: string;
  role: "owner" | "member";
  memberCount: number;
  createdAt: string;
};

export type PendingInvite = {
  id: string;
  groupId: string;
  groupName: string;
  invitedByEmail: string;
  createdAt: string;
};

export type Member = {
  userId: string;
  email: string;
  role: "owner" | "member";
};

export function activeMemberCount(groupId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM memberships WHERE group_id = ? AND status = 'active'")
    .get(groupId) as { n: number };
  return row.n;
}

export function isActiveMember(groupId: string, userId: string): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM memberships WHERE group_id = ? AND user_id = ? AND status = 'active'",
    )
    .get(groupId, userId);
  return !!row;
}

export function listGroupsForUser(userId: string): GroupSummary[] {
  const rows = db
    .prepare(
      `SELECT g.id, g.name, g.created_at AS createdAt, m.role AS role
       FROM memberships m
       JOIN groups g ON g.id = m.group_id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY g.created_at DESC`,
    )
    .all(userId) as Omit<GroupSummary, "memberCount">[];
  return rows.map((r) => ({ ...r, memberCount: activeMemberCount(r.id) }));
}

export function listMembers(groupId: string): Member[] {
  return db
    .prepare(
      `SELECT m.user_id AS userId, u.email AS email, m.role AS role
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ? AND m.status = 'active'
       ORDER BY m.role = 'owner' DESC, u.email`,
    )
    .all(groupId) as Member[];
}

export function createGroup(userId: string, name: string): string {
  const groupId = newId();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO groups (id, name, created_by, created_at) VALUES (?, ?, ?, ?)").run(
      groupId,
      name,
      userId,
      now,
    );
    db.prepare(
      `INSERT INTO memberships (id, group_id, user_id, role, status, joined_at)
       VALUES (?, ?, ?, 'owner', 'active', ?)`,
    ).run(newId(), groupId, userId, now);
  });
  tx();
  return groupId;
}

type Result = { ok: true } | { ok: false; error: string };

export async function inviteToGroup(
  groupId: string,
  inviterId: string,
  inviteeEmail: string,
): Promise<Result> {
  if (!isActiveMember(groupId, inviterId)) return { ok: false, error: "You are not in this group." };
  if (activeMemberCount(groupId) >= MAX_MEMBERS) {
    return { ok: false, error: `Groups are limited to ${MAX_MEMBERS} people.` };
  }

  const group = db.prepare("SELECT name FROM groups WHERE id = ?").get(groupId) as
    | { name: string }
    | undefined;
  if (!group) return { ok: false, error: "Group not found." };

  // Already an active member?
  const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(inviteeEmail) as
    | { id: string }
    | undefined;
  if (existingUser && isActiveMember(groupId, existingUser.id)) {
    return { ok: false, error: "That person is already in the group." };
  }

  // Existing pending invite?
  const dup = db
    .prepare("SELECT 1 FROM invites WHERE group_id = ? AND email = ? AND status = 'pending'")
    .get(groupId, inviteeEmail);
  if (dup) return { ok: false, error: "There's already a pending invite for that email." };

  const inviter = db.prepare("SELECT email FROM users WHERE id = ?").get(inviterId) as {
    email: string;
  };

  db.prepare(
    `INSERT INTO invites (id, group_id, email, invited_by, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  ).run(newId(), groupId, inviteeEmail, inviterId, new Date().toISOString());

  await sendEmail({
    to: inviteeEmail,
    subject: `${inviter.email} invited you to a topic on NVC`,
    body:
      `${inviter.email} invited you to join the topic "${group.name}" on NVC.\n\n` +
      `Sign in (or create an account with this email) to accept:\n` +
      `${process.env.APP_URL ?? "http://localhost:3000"}/app`,
  });

  return { ok: true };
}

export function listPendingInvitesForEmail(email: string): PendingInvite[] {
  return db
    .prepare(
      `SELECT i.id, i.group_id AS groupId, g.name AS groupName,
              u.email AS invitedByEmail, i.created_at AS createdAt
       FROM invites i
       JOIN groups g ON g.id = i.group_id
       JOIN users u ON u.id = i.invited_by
       WHERE i.email = ? AND i.status = 'pending'
       ORDER BY i.created_at DESC`,
    )
    .all(email) as PendingInvite[];
}

export function acceptInvite(inviteId: string, userId: string, userEmail: string): Result {
  const invite = db
    .prepare("SELECT group_id, email, status FROM invites WHERE id = ?")
    .get(inviteId) as { group_id: string; email: string; status: string } | undefined;
  if (!invite || invite.status !== "pending") return { ok: false, error: "Invite is no longer valid." };
  if (invite.email !== userEmail) return { ok: false, error: "This invite is for a different email." };

  if (activeMemberCount(invite.group_id) >= MAX_MEMBERS) {
    return { ok: false, error: `That group is full (${MAX_MEMBERS} people).` };
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("UPDATE invites SET status = 'accepted' WHERE id = ?").run(inviteId);
    // Reactivate a prior membership (e.g. they had left) or create a new one.
    const existing = db
      .prepare("SELECT id FROM memberships WHERE group_id = ? AND user_id = ?")
      .get(invite.group_id, userId) as { id: string } | undefined;
    if (existing) {
      db.prepare("UPDATE memberships SET status = 'active', joined_at = ? WHERE id = ?").run(
        now,
        existing.id,
      );
    } else {
      db.prepare(
        `INSERT INTO memberships (id, group_id, user_id, role, status, joined_at)
         VALUES (?, ?, ?, 'member', 'active', ?)`,
      ).run(newId(), invite.group_id, userId, now);
    }
  });
  tx();
  return { ok: true };
}

export function declineInvite(inviteId: string, userEmail: string): Result {
  const invite = db
    .prepare("SELECT email, status FROM invites WHERE id = ?")
    .get(inviteId) as { email: string; status: string } | undefined;
  if (!invite || invite.status !== "pending") return { ok: false, error: "Invite is no longer valid." };
  if (invite.email !== userEmail) return { ok: false, error: "This invite is for a different email." };
  db.prepare("UPDATE invites SET status = 'declined' WHERE id = ?").run(inviteId);
  return { ok: true };
}

// Leaving sets the membership to 'left'. Rejoining requires a fresh invite,
// which reactivates the same membership row on accept.
export function leaveGroup(groupId: string, userId: string): Result {
  const m = db
    .prepare("SELECT id FROM memberships WHERE group_id = ? AND user_id = ? AND status = 'active'")
    .get(groupId, userId) as { id: string } | undefined;
  if (!m) return { ok: false, error: "You are not in this group." };
  db.prepare("UPDATE memberships SET status = 'left' WHERE id = ?").run(m.id);
  return { ok: true };
}

export function getGroupForMember(groupId: string, userId: string) {
  if (!isActiveMember(groupId, userId)) return null;
  return db.prepare("SELECT id, name, created_by AS createdBy, created_at AS createdAt FROM groups WHERE id = ?").get(
    groupId,
  ) as { id: string; name: string; createdBy: string; createdAt: string } | undefined;
}
