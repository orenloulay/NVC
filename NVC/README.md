# NVC — Nonviolent Communication

A space where 1–10 people work through a topic together. Each person writes
what they honestly feel; the others never see the raw words — the app translates
each message into Nonviolent Communication (OFNR: Observations, Feelings, Needs,
Requests) so it can be received without defensiveness. Chats are never saved; at
the end of a session a PDF record (group name, date, and the NVC exchange) is
emailed to the group. English and Hebrew are supported.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on the login page. Create an account,
then check the **dev outbox** at http://localhost:3000/dev/outbox to read the
verification/2FA codes and invitations (until a real email provider is wired in).

## How it's built (self-contained)

- **Next.js 16** (App Router) + React 19 + Tailwind CSS v4
- **SQLite** (`better-sqlite3`) — the whole backend runs from one file in `.data/`
  (gitignored). Swap `lib/db.ts` for a hosted database later.
- **Auth** — scrypt password hashing, signed-cookie sessions (`jose`), email
  verification at signup and an emailed 6-digit **two-factor code** at login.
- **Email** — every message lands in a dev outbox table (`lib/email.ts`); wire a
  provider in `deliver()` to go live.
- **NVC engine** — `lib/nvc.ts`, powered by Claude. Without a key it uses a
  clearly-labeled heuristic that still preserves the privacy model.
- **PDF** — `pdf-lib`, generated at session end and emailed to members.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Enables real Claude NVC translation (otherwise a labeled draft/fallback is used). |
| `NVC_MODEL` | Optional. Claude model id for translation. Defaults to `claude-opus-5`. |
| `APP_URL` | Optional. Base URL used in invitation emails. Defaults to `http://localhost:3000`. |

Create a `.env.local` (gitignored) to set these:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```
