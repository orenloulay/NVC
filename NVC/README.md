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

## How it's built

- **Next.js 16** (App Router) + React 19 + Tailwind CSS v4
- **Database** — hosted **libSQL / Turso** (SQLite-compatible) via
  `@libsql/client`, in `lib/db.ts`. Runs anywhere, including serverless
  platforms (Vercel) where the local filesystem is ephemeral.
- **Auth** — scrypt password hashing, signed-cookie sessions (`jose`), email
  verification at signup and an emailed 6-digit **two-factor code** at login.
- **Email** — every message is recorded in an `outbox` table (previewable at
  `/dev/outbox` in development) and delivered for real via **Resend** when
  `RESEND_API_KEY` is set (`lib/email.ts`).
- **NVC engine** — `lib/nvc.ts`, powered by Claude. Without a key it uses a
  clearly-labeled heuristic that still preserves the privacy model.
- **PDF** — `pdf-lib`, generated at session end and emailed to members.

## Environment variables

Copy `.env.example` to `.env.local` and fill it in.

| Variable | Required | Purpose |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | **Yes** | libSQL/Turso database URL (`libsql://…`). |
| `TURSO_AUTH_TOKEN` | **Yes** | Auth token for the Turso database. |
| `RESEND_API_KEY` | Yes in prod | Delivers verification/2FA/invite emails. Without it, codes are recorded but never sent — so no one can sign in on a deployed site. |
| `RESEND_FROM` | Optional | Verified sender address. Defaults to Resend's shared sandbox (`onboarding@resend.dev`), which only delivers to your own Resend account email. |
| `ANTHROPIC_API_KEY` | Optional | Enables real Claude NVC translation (otherwise a labeled fallback is used). |
| `NVC_MODEL` | Optional | Claude model id for translation. Defaults to `claude-opus-5`. |
| `APP_URL` | Optional | Base URL used in invitation emails. Set to your deployment URL in production. |
| `SESSION_SECRET` | Optional | Stable session-signing secret. If unset, one is generated and stored in the database. |

## Deploy to Vercel

This Next.js app lives in the `NVC/` subdirectory of the repository, so a couple
of settings matter.

1. **Provision a database.** Create a free Turso database and grab its URL +
   token (https://turso.tech):
   ```bash
   turso db create nvc
   turso db show nvc --url        # -> TURSO_DATABASE_URL
   turso db tokens create nvc     # -> TURSO_AUTH_TOKEN
   ```
   The schema is created automatically on first request — no migration step.

2. **Set up email** so login codes can be delivered. Create a Resend account,
   add an API key, and (for real recipients) verify a sending domain
   (https://resend.com). Set `RESEND_API_KEY` and `RESEND_FROM`.

3. **Import the repo into Vercel** (https://vercel.com/new). In the project
   settings, set **Root Directory** to `NVC`. Vercel auto-detects Next.js — no
   other build configuration is needed.

4. **Add the environment variables** from the table above in the Vercel project
   (at minimum `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `RESEND_API_KEY`).
   Set `APP_URL` to your deployment URL.

5. **Deploy.** After the first deploy, open the site and create an account —
   your 2FA/verification code arrives by email.
