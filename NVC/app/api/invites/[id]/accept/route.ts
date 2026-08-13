import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { acceptInvite } from "@/lib/groups";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const result = await acceptInvite(id, user.id, user.email);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
