import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PdfMessage = {
  senderEmail: string;
  nvc: string;
  createdAt: string;
};

// Builds the end-of-session PDF: group name, date, and the NVC-translated
// exchange (the only record — the live chat itself is never stored).
export async function buildSessionPdf(opts: {
  groupName: string;
  date: Date;
  messages: PdfMessage[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const teal = rgb(0.05, 0.55, 0.5);
  const ink = rgb(0.1, 0.1, 0.1);
  const grey = rgb(0.45, 0.45, 0.45);

  const margin = 56;
  const pageW = 595.28; // A4
  const pageH = 841.89;
  const maxW = pageW - margin * 2;

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const wrap = (text: string, size: number, f = font): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const draw = (text: string, size: number, f = font, color = ink, gap = 4) => {
    for (const line of wrap(text, size, f)) {
      if (y < margin + size) {
        page = doc.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(line, { x: margin, y, size, font: f, color });
      y -= size + gap;
    }
  };

  draw("NVC — Session record", 22, bold, teal, 8);
  draw(opts.groupName, 15, bold, ink, 4);
  draw(
    opts.date.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" }),
    11,
    font,
    grey,
    16,
  );

  if (opts.messages.length === 0) {
    draw("No messages were exchanged in this session.", 11, font, grey);
  }

  for (const m of opts.messages) {
    const when = new Date(m.createdAt).toLocaleTimeString("en-GB", { timeStyle: "short" });
    draw(`${m.senderEmail} · ${when}`, 9, bold, teal, 3);
    draw(m.nvc, 11, font, ink, 12);
  }

  y -= 8;
  draw(
    "Shared in Nonviolent Communication. The live conversation itself was not saved.",
    9,
    font,
    grey,
  );

  return doc.save();
}
