import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isActiveMember } from "@/lib/groups";
import { approveMessage } from "@/lib/chat";

// Approves the author's own draft so its NVC translation is shared with the
// group. Until this is called, no one else can see the message.
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

  const approved = approveMessage(id, messageId, user.id);
  if (!approved) {
    return NextResponse.json({ error: "That message can no longer be approved." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
