import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { normalizeEmail } from "@/lib/validation";
import { inviteToGroup } from "@/lib/groups";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const { email: rawEmail, resend } = await req.json().catch(() => ({}));
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (email === user.email) {
    return NextResponse.json({ error: "You're already in this group." }, { status: 400 });
  }

  const result = await inviteToGroup(id, user.id, email, { resend: resend === true });
  if (!result.ok) {
    // A pending invite already exists — let the client offer to send it again.
    if ("alreadyInvited" in result) {
      return NextResponse.json(
        { error: result.error, alreadyInvited: true },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
