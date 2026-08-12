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

// Returns what a given viewer is allowed to see: their own original text, and
// the NVC translation of everyone else's messages.
export type ViewerMessage = {
  id: string;
  senderEmail: string;
  mine: boolean;
  text: string;
  engine: "claude" | "fallback";
  createdAt: string;
};

export function messagesForViewer(groupId: string, viewerId: string): ViewerMessage[] {
  const session = sessions.get(groupId);
  if (!session) return [];
  return session.messages.map((m) => ({
    id: m.id,
    senderEmail: m.senderEmail,
    mine: m.senderId === viewerId,
    text: m.senderId === viewerId ? m.original : m.nvc,
    engine: m.engine,
    createdAt: m.createdAt,
  }));
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
