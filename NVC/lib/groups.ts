import { getClient, dbGet, dbAll, dbRun, ensureSchema } from "./db";
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

export async function activeMemberCount(groupId: string): Promise<number> {
  const row = await dbGet<{ n: number }>(
    "SELECT COUNT(*) AS n FROM memberships WHERE group_id = ? AND status = 'active'",
    [groupId],
  );
  return row?.n ?? 0;
}

export async function isActiveMember(groupId: string, userId: string): Promise<boolean> {
  const row = await dbGet(
    "SELECT 1 AS one FROM memberships WHERE group_id = ? AND user_id = ? AND status = 'active'",
    [groupId, userId],
  );
  return !!row;
}

export async function listGroupsForUser(userId: string): Promise<GroupSummary[]> {
  const rows = await dbAll<Omit<GroupSummary, "memberCount">>(
    `SELECT g.id, g.name, g.created_at AS createdAt, m.role AS role
     FROM memberships m
     JOIN groups g ON g.id = m.group_id
     WHERE m.user_id = ? AND m.status = 'active'
     ORDER BY g.created_at DESC`,
    [userId],
  );
  return Promise.all(
    rows.map(async (r) => ({ ...r, memberCount: await activeMemberCount(r.id) })),
  );
}

export async function listMembers(groupId: string): Promise<Member[]> {
  return dbAll<Member>(
    `SELECT m.user_id AS userId, u.email AS email, m.role AS role
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = ? AND m.status = 'active'
     ORDER BY m.role = 'owner' DESC, u.email`,
    [groupId],
  );
}

export async function createGroup(userId: string, name: string): Promise<string> {
  const groupId = newId();
  const now = new Date().toISOString();
  await ensureSchema();
  await getClient().batch(
    [
      {
        sql: "INSERT INTO groups (id, name, created_by, created_at) VALUES (?, ?, ?, ?)",
        args: [groupId, name, userId, now],
      },
      {
        sql: `INSERT INTO memberships (id, group_id, user_id, role, status, joined_at)
              VALUES (?, ?, ?, 'owner', 'active', ?)`,
        args: [newId(), groupId, userId, now],
      },
    ],
    "write",
  );
  return groupId;
}

type Result = { ok: true } | { ok: false; error: string };

// A pending invite already exists. The caller can offer to send it again and
// then retry with `resend: true`.
type InviteResult = Result | { ok: false; alreadyInvited: true; error: string };

export async function inviteToGroup(
  groupId: string,
  inviterId: string,
  inviteeEmail: string,
  opts: { resend?: boolean } = {},
): Promise<InviteResult> {
  if (!(await isActiveMember(groupId, inviterId)))
    return { ok: false, error: "You are not in this group." };
  if ((await activeMemberCount(groupId)) >= MAX_MEMBERS) {
    return { ok: false, error: `Groups are limited to ${MAX_MEMBERS} people.` };
  }

  const group = await dbGet<{ name: string }>("SELECT name FROM groups WHERE id = ?", [
    groupId,
  ]);
  if (!group) return { ok: false, error: "Group not found." };

  // Already an active member?
  const existingUser = await dbGet<{ id: string }>(
    "SELECT id FROM users WHERE email = ?",
    [inviteeEmail],
  );
  if (existingUser && (await isActiveMember(groupId, existingUser.id))) {
    return { ok: false, error: "That person is already in the group." };
  }

  // Existing pending invite? Unless the caller explicitly asked to resend,
  // surface this so they can choose to send a fresh invite.
  const dup = await dbGet<{ id: string }>(
    "SELECT id FROM invites WHERE group_id = ? AND email = ? AND status = 'pending'",
    [groupId, inviteeEmail],
  );
  if (dup && !opts.resend) {
    return {
      ok: false,
      alreadyInvited: true,
      error: "An invite was already sent to that email and hasn't been accepted yet.",
    };
  }

  const inviter = await dbGet<{ email: string }>("SELECT email FROM users WHERE id = ?", [
    inviterId,
  ]);
  const now = new Date().toISOString();

  if (dup) {
    // Refresh the existing pending invite's timestamp rather than creating a
    // duplicate row, then send the email again.
    await dbRun("UPDATE invites SET created_at = ? WHERE id = ?", [now, dup.id]);
  } else {
    await dbRun(
      `INSERT INTO invites (id, group_id, email, invited_by, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [newId(), groupId, inviteeEmail, inviterId, now],
    );
  }

  await sendEmail({
    to: inviteeEmail,
    subject: `${inviter?.email ?? "Someone"} invited you to a topic on NVC`,
    body:
      `${inviter?.email ?? "Someone"} invited you to join the topic "${group.name}" on NVC.\n\n` +
      `Sign in (or create an account with this email) to accept:\n` +
      `${process.env.APP_URL ?? "http://localhost:3000"}/app`,
  });

  return { ok: true };
}

export async function listPendingInvitesForEmail(email: string): Promise<PendingInvite[]> {
  return dbAll<PendingInvite>(
    `SELECT i.id, i.group_id AS groupId, g.name AS groupName,
            u.email AS invitedByEmail, i.created_at AS createdAt
     FROM invites i
     JOIN groups g ON g.id = i.group_id
     JOIN users u ON u.id = i.invited_by
     WHERE i.email = ? AND i.status = 'pending'
     ORDER BY i.created_at DESC`,
    [email],
  );
}

export async function acceptInvite(
  inviteId: string,
  userId: string,
  userEmail: string,
): Promise<Result> {
  const invite = await dbGet<{ group_id: string; email: string; status: string }>(
    "SELECT group_id, email, status FROM invites WHERE id = ?",
    [inviteId],
  );
  if (!invite || invite.status !== "pending")
    return { ok: false, error: "Invite is no longer valid." };
  if (invite.email !== userEmail)
    return { ok: false, error: "This invite is for a different email." };

  if ((await activeMemberCount(invite.group_id)) >= MAX_MEMBERS) {
    return { ok: false, error: `That group is full (${MAX_MEMBERS} people).` };
  }

  const now = new Date().toISOString();
  await ensureSchema();
  const tx = await getClient().transaction("write");
  try {
    await tx.execute({
      sql: "UPDATE invites SET status = 'accepted' WHERE id = ?",
      args: [inviteId],
    });
    // Reactivate a prior membership (e.g. they had left) or create a new one.
    const existing = await tx.execute({
      sql: "SELECT id FROM memberships WHERE group_id = ? AND user_id = ?",
      args: [invite.group_id, userId],
    });
    if (existing.rows.length > 0) {
      await tx.execute({
        sql: "UPDATE memberships SET status = 'active', joined_at = ? WHERE id = ?",
        args: [now, existing.rows[0].id as string],
      });
    } else {
      await tx.execute({
        sql: `INSERT INTO memberships (id, group_id, user_id, role, status, joined_at)
              VALUES (?, ?, ?, 'member', 'active', ?)`,
        args: [newId(), invite.group_id, userId, now],
      });
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
  return { ok: true };
}

export async function declineInvite(inviteId: string, userEmail: string): Promise<Result> {
  const invite = await dbGet<{ email: string; status: string }>(
    "SELECT email, status FROM invites WHERE id = ?",
    [inviteId],
  );
  if (!invite || invite.status !== "pending")
    return { ok: false, error: "Invite is no longer valid." };
  if (invite.email !== userEmail)
    return { ok: false, error: "This invite is for a different email." };
  await dbRun("UPDATE invites SET status = 'declined' WHERE id = ?", [inviteId]);
  return { ok: true };
}

// Leaving sets the membership to 'left'. Rejoining requires a fresh invite,
// which reactivates the same membership row on accept.
export async function leaveGroup(groupId: string, userId: string): Promise<Result> {
  const m = await dbGet<{ id: string }>(
    "SELECT id FROM memberships WHERE group_id = ? AND user_id = ? AND status = 'active'",
    [groupId, userId],
  );
  if (!m) return { ok: false, error: "You are not in this group." };
  await dbRun("UPDATE memberships SET status = 'left' WHERE id = ?", [m.id]);
  return { ok: true };
}

export async function getGroupForMember(groupId: string, userId: string) {
  if (!(await isActiveMember(groupId, userId))) return null;
  return dbGet<{ id: string; name: string; createdBy: string; createdAt: string }>(
    "SELECT id, name, created_by AS createdBy, created_at AS createdAt FROM groups WHERE id = ?",
    [groupId],
  );
}
