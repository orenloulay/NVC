import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isActiveMember, listMembers, getGroupForMember } from "@/lib/groups";
import { endSession } from "@/lib/chat";
import { buildSessionPdf } from "@/lib/pdf";
import { sendEmail } from "@/lib/email";

// Ends the conversation: builds a PDF (group name + date + the NVC exchange),
// emails it to every active member, and clears the in-memory session.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  if (!isActiveMember(id, user.id)) {
    return NextResponse.json({ error: "You are not in this group." }, { status: 403 });
  }

  const group = getGroupForMember(id, user.id);
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const ended = endSession(id);
  const now = new Date();

  const pdf = await buildSessionPdf({
    groupName: group.name,
    date: now,
    messages: (ended?.messages ?? []).map((m) => ({
      senderEmail: m.senderEmail,
      nvc: m.nvc,
      createdAt: m.createdAt,
    })),
  });

  const dateLabel = now.toISOString().slice(0, 10);
  const filename = `nvc-${group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${dateLabel}.pdf`;

  const members = listMembers(id);
  for (const m of members) {
    await sendEmail({
      to: m.email,
      subject: `NVC session record — ${group.name}`,
      body:
        `Attached is the record of your NVC session for "${group.name}" on ${dateLabel}.\n\n` +
        `It contains the messages translated into Nonviolent Communication. ` +
        `The live conversation itself was not saved.`,
      attachments: [{ filename, content: pdf }],
    });
  }

  return NextResponse.json({ ok: true, emailedTo: members.length });
}
