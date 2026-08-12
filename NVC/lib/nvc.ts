import Anthropic from "@anthropic-ai/sdk";

export type Lang = "en" | "he";
export type TranslationEngine = "claude" | "fallback";

// Condensed from the NVC methodology (Rosenberg's OFNR model + the CNVC
// feelings/needs inventories). This is the instruction set the translator follows.
const SYSTEM_PROMPT = `You are a skilled Nonviolent Communication (NVC) practitioner in the tradition of Marshall Rosenberg. Your job: take one person's raw, emotionally charged message and rewrite it into honest NVC, so the other person can receive it without defensiveness.

Rewrite using the four OFNR components, woven into natural, warm, human language (NOT a rigid "When you… I feel… because I need… would you…" template every time):
1. OBSERVATION — the specific behavior or event, stripped of judgment, labels, and absolutes ("always/never"). Camera-neutral. Do not invent specifics the message doesn't contain; keep it general if none are given.
2. FEELING — a genuine feeling (sad, hurt, anxious, lonely, frustrated, tender, discouraged…). Never a faux-feeling that smuggles blame ("ignored", "disrespected", "attacked", "manipulated", "abandoned"): convert those into a real feeling. Own it as the speaker's own feeling — never "you make me feel".
3. NEED — a universal human need behind the feeling (connection, consideration, respect, ease, reliability, autonomy, to matter, understanding, support…). Never reference the other person or a specific action in the need.
4. REQUEST — a positive, specific, doable request phrased so a "no" would be genuinely acceptable — never a demand, threat, or guilt trip. A connection request ("Would you tell me how that lands for you?") is often best.

Rules:
- Preserve the speaker's real emotional truth and meaning. Do not sanitize the feeling away, and do not invent needs they don't hold.
- First person, from the speaker's point of view.
- Keep it proportionate and natural — usually 1–3 sentences. No therapy-speak, no preamble, no explanation of what you did.
- Never output blame, moralistic judgment, "always/never", faux-feelings, "you make me feel", vague/abstract requests, or disguised demands.
- Output ONLY the rewritten NVC message — no labels, no quotes, no commentary.`;

function langInstruction(lang: Lang): string {
  return lang === "he"
    ? "Write the NVC message in natural Hebrew."
    : "Write the NVC message in natural English.";
}

const MODEL = process.env.NVC_MODEL ?? "claude-opus-5";

async function translateWithClaude(text: string, lang: Lang): Promise<string> {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: `${langInstruction(lang)}\n\nRaw message to rewrite into NVC:\n"""${text}"""`,
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming);

  const out = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return out || fallbackTranslate(text, lang);
}

// ---- Privacy-preserving heuristic used when no ANTHROPIC_API_KEY is set. ----
// It never echoes the raw text back to the other person; it produces a gentle,
// generic NVC-framed message so the flow is testable without a key.

const FEELING_HINTS: { rx: RegExp; en: string; he: string; needEn: string; needHe: string }[] = [
  { rx: /ignore|listen|phone|attention|alone|lonely/i, en: "lonely and unseen", he: "בודד/ה ולא נראה/ית", needEn: "connection and to matter", needHe: "חיבור ותחושת שייכות" },
  { rx: /late|wait|time|slow/i, en: "anxious and frustrated", he: "חרד/ה ומתוסכל/ת", needEn: "consideration and ease", needHe: "התחשבות ורוגע" },
  { rx: /help|chore|clean|share|fair|always me|never help/i, en: "tired and unsupported", he: "עייף/ה וללא תמיכה", needEn: "cooperation and support", needHe: "שיתוף פעולה ותמיכה" },
  { rx: /stupid|idiot|dumb|wrong|blame|fault/i, en: "hurt and defensive", he: "פגוע/ה ונחשב/ת", needEn: "respect and understanding", needHe: "כבוד והבנה" },
  { rx: /money|spend|budget|afford/i, en: "tense and worried", he: "מתוח/ה ומודאג/ת", needEn: "ease and shared trust", needHe: "רוגע ואמון משותף" },
];

function fallbackTranslate(text: string, lang: Lang): string {
  const hint = FEELING_HINTS.find((h) => h.rx.test(text));
  const feeling = hint ? (lang === "he" ? hint.he : hint.en) : lang === "he" ? "לא רגוע/ה" : "unsettled";
  const need = hint ? (lang === "he" ? hint.needHe : hint.needEn) : lang === "he" ? "הבנה" : "understanding";
  const note = lang === "he" ? "[טיוטה — הגדירו ANTHROPIC_API_KEY לתרגום מלא] " : "[Draft — set ANTHROPIC_API_KEY for full translation] ";
  const body =
    lang === "he"
      ? `כשאני חושב/ת על מה שקורה בינינו, אני מרגיש/ה ${feeling}, כי חשוב לי ${need}. האם תהיה/י מוכן/ה לדבר על זה יחד?`
      : `When I think about what's happening between us, I feel ${feeling}, because I value ${need}. Would you be willing to talk it through together?`;
  return note + body;
}

export async function translateToNVC(
  text: string,
  lang: Lang,
): Promise<{ nvc: string; engine: TranslationEngine }> {
  const clean = text.trim();
  if (!clean) return { nvc: "", engine: "fallback" };

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return { nvc: await translateWithClaude(clean, lang), engine: "claude" };
    } catch (err) {
      console.error("[nvc] Claude translation failed, using fallback:", err);
    }
  }
  return { nvc: fallbackTranslate(clean, lang), engine: "fallback" };
}
