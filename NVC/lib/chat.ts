import { newId } from "./crypto";

// Live conversation state is held ONLY in memory and never written to the
// database — chats are not saved. A session is dropped when it ends (a PDF is
// emailed at that point) or when the process restarts.

export type ChatMessage = {
  id: string;
  senderId: string;
  senderEmail: string;
  original: string; // shown only to the author
  nvc: string; // shown to everyone else
  engine: "claude" | "fallback";
  // A message is first created as a private draft: only the author can see it,
  // together with the NVC translation the others would receive. Nothing is
  // shared until the author approves it.
  approved: boolean;
  createdAt: string;
};

type Session = {
  groupId: string;
  messages: ChatMessage[];
  startedAt: string;
};

const g = globalThis as unknown as { __nvcChats?: Map<string, Session> };
const sessions: Map<string, Session> = g.__nvcChats ?? new Map();
if (process.env.NODE_ENV !== "production") g.__nvcChats = sessions;

function ensure(groupId: string): Session {
  let s = sessions.get(groupId);
  if (!s) {
    s = { groupId, messages: [], startedAt: new Date().toISOString() };
    sessions.set(groupId, s);
  }
  return s;
}

export function addMessage(
  groupId: string,
  msg: Omit<ChatMessage, "id" | "createdAt">,
): ChatMessage {
  const session = ensure(groupId);
  const full: ChatMessage = { ...msg, id: newId(), createdAt: new Date().toISOString() };
  session.messages.push(full);
  return full;
}

// Approve a draft so its NVC translation becomes visible to the group. Only the
// author may approve their own message. Returns the message, or null if it
// isn't found / isn't the viewer's.
export function approveMessage(
  groupId: string,
  messageId: string,
  viewerId: string,
): ChatMessage | null {
  const session = sessions.get(groupId);
  if (!session) return null;
  const m = session.messages.find((x) => x.id === messageId && x.senderId === viewerId);
  if (!m) return null;
  m.approved = true;
  return m;
}

// Discard a not-yet-approved draft. Only the author may discard their own
// draft. Returns true if a draft was removed.
export function discardMessage(
  groupId: string,
  messageId: string,
  viewerId: string,
): boolean {
  const session = sessions.get(groupId);
  if (!session) return false;
  const idx = session.messages.findIndex(
    (x) => x.id === messageId && x.senderId === viewerId && !x.approved,
  );
  if (idx === -1) return false;
  session.messages.splice(idx, 1);
  return true;
}

// Returns what a given viewer is allowed to see. The author sees their own
// messages (draft or approved) along with the NVC translation others would
// receive, so they can review and approve. Everyone else sees only the NVC
// translation of messages that have been approved.
export type ViewerMessage = {
  id: string;
  senderEmail: string;
  mine: boolean;
  text: string; // author: their original words; others: the NVC translation
  nvc?: string; // the NVC translation others see — included only for the author
  approved: boolean;
  engine: "claude" | "fallback";
  createdAt: string;
};

export function messagesForViewer(groupId: string, viewerId: string): ViewerMessage[] {
  const session = sessions.get(groupId);
  if (!session) return [];
  return session.messages
    .filter((m) => m.senderId === viewerId || m.approved)
    .map((m) => {
      const mine = m.senderId === viewerId;
      return {
        id: m.id,
        senderEmail: m.senderEmail,
        mine,
        text: mine ? m.original : m.nvc,
        nvc: mine ? m.nvc : undefined,
        approved: m.approved,
        engine: m.engine,
        createdAt: m.createdAt,
      };
    });
}

export function hasSession(groupId: string): boolean {
  return (sessions.get(groupId)?.messages.length ?? 0) > 0;
}

// Ends the session: returns the full transcript (NVC view) for the PDF, then
// clears it from memory.
export function endSession(groupId: string): { startedAt: string; messages: ChatMessage[] } | null {
  const session = sessions.get(groupId);
  if (!session) return null;
  sessions.delete(groupId);
  return { startedAt: session.startedAt, messages: session.messages };
}
