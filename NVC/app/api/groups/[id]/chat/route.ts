import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isActiveMember } from "@/lib/groups";
import { messagesForViewer } from "@/lib/chat";

// Poll endpoint: each viewer sees their own original messages and the NVC
// translation of everyone else's.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  if (!(await isActiveMember(id, user.id))) {
    return NextResponse.json({ error: "You are not in this group." }, { status: 403 });
  }

  return NextResponse.json({ messages: messagesForViewer(id, user.id) });
}
