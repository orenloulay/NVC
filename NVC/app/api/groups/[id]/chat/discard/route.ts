import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isActiveMember } from "@/lib/groups";
import { discardMessage } from "@/lib/chat";

// Discards the author's own not-yet-approved draft so they can rewrite it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  if (!(await isActiveMember(id, user.id))) {
    return NextResponse.json({ error: "You are not in this group." }, { status: 403 });
  }

  const { messageId } = await req.json().catch(() => ({}));
  if (typeof messageId !== "string" || !messageId) {
    return NextResponse.json({ error: "Missing message." }, { status: 400 });
  }

  const removed = discardMessage(id, messageId, user.id);
  if (!removed) {
    return NextResponse.json({ error: "That draft is no longer available." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
