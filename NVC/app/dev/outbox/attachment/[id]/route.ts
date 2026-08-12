import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Dev-only: stream an outbox attachment (e.g. the session PDF).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const { id } = await params;
  const row = db
    .prepare("SELECT filename, content FROM outbox_attachments WHERE id = ?")
    .get(id) as { filename: string; content: Buffer } | undefined;
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return new NextResponse(new Uint8Array(row.content), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${row.filename}"`,
    },
  });
}
