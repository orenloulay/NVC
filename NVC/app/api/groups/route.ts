import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createGroup, listGroupsForUser, listPendingInvitesForEmail } from "@/lib/groups";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({
    groups: await listGroupsForUser(user.id),
    invites: await listPendingInvitesForEmail(user.email),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { name } = await req.json().catch(() => ({}));
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (trimmed.length < 2) {
    return NextResponse.json({ error: "Give the topic a name (2+ characters)." }, { status: 400 });
  }
  if (trimmed.length > 80) {
    return NextResponse.json({ error: "Topic name is too long." }, { status: 400 });
  }

  const id = await createGroup(user.id, trimmed);
  return NextResponse.json({ ok: true, id });
}
