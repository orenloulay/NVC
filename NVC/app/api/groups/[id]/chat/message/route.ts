import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isActiveMember } from "@/lib/groups";
import { translateToNVC, type Lang } from "@/lib/nvc";
import { addMessage } from "@/lib/chat";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  if (!(await isActiveMember(id, user.id))) {
    return NextResponse.json({ error: "You are not in this group." }, { status: 403 });
  }

  const { text, lang } = await req.json().catch(() => ({}));
  const clean = typeof text === "string" ? text.trim() : "";
  if (!clean) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (clean.length > 4000) return NextResponse.json({ error: "That message is too long." }, { status: 400 });

  const language: Lang = lang === "he" ? "he" : "en";
  const { nvc, engine } = await translateToNVC(clean, language);

  // Stored as a private draft — not shared with the group until the author
  // reviews the NVC translation and approves it.
  const stored = addMessage(id, {
    senderId: user.id,
    senderEmail: user.email,
    original: clean,
    nvc,
    engine,
    approved: false,
  });

  // The author gets back their original text and the NVC translation the
  // others would see, so they can approve it before it is shared.
  return NextResponse.json({
    ok: true,
    message: {
      id: stored.id,
      senderEmail: user.email,
      mine: true,
      text: clean,
      nvc,
      approved: false,
      engine,
      createdAt: stored.createdAt,
    },
  });
}
