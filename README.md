# StudyHub AI

A study tool that turns a topic — or a PDF of your own notes — into material you can work
through: a guided study chat, flashcard decks, graded quizzes, and practice question sets.
Every generation is metered against a credit balance so the app can be tried without an account
and run without an open-ended API bill.

## The four modes

| Mode | Route | What it does |
|---|---|---|
| Study Mode | `/study-mode` | A chat about a topic, with the answer context fixed up front (normal, exam revision, or interview). |
| Flashcards & Quiz | `/flash-quiz` | Generates a deck or a quiz from a topic or an uploaded PDF. Cards can be flipped and marked mastered; quizzes are graded and reviewed. |
| Question Generator | `/question-generator` | Builds a practice set at a chosen format, experience level, and length, and keeps past sets. |
| Home | `/` | Introduces the three modes. |

## Stack

- **Next.js 16** (App Router, Turbopack) with **React 19**
- **Prisma 7** on **Postgres**, via `@prisma/adapter-pg`
- **Clerk** for authentication, plus a cookie-based guest tier
- **Vercel AI SDK** with the OpenAI provider
- **Tailwind CSS v4** and Base UI primitives
- **Vitest** for tests

## Getting started

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env        # then fill in the values
pnpm prisma migrate deploy  # or `migrate dev` while iterating on the schema
pnpm dev
```

`.env.example` documents every variable the app reads. The three that must be real before the app
is usable are `DATABASE_URL`, `OPENAI_API_KEY`, and the two Clerk keys. `GUEST_COOKIE_SECRET` is
required in production — without it the app refuses to mint or trust a guest cookie rather than
falling back to a value that is public in this repository.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm lint` | ESLint |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm prisma migrate dev` | Create and apply a migration |

## How it works

### Identity and the guest tier

Every route resolves a `Viewer` through `requireViewer()` (`lib/api-guard.ts`) rather than
trusting an id from the URL or body, so one account can never read another's chats, decks, or
quizzes.

Signed-in users get 50 AI calls; guests get 20. Credits never refill — the balance is a launch
promotion, not a subscription. Guest identity is a random id in an httpOnly cookie, HMAC-signed
with `GUEST_COOKIE_SECRET` (`lib/guest-cookie.ts`) so a client cannot present an id it invented,
and issuance is capped per IP (`RATE_LIMITS.guestIssue` in `lib/rate-limit.ts`) so clearing the
cookie does not mint an unlimited supply of fresh balances.

### Credits and the ledger

`CreditLedger` is an append-only audit trail: one row per spend, and a compensating row with
`cost: -1` for every refund. `SUM(cost)` therefore equals credits actually consumed, and the
history shows both the charge and its reversal.

The balance and its ledger row are written in one transaction (`lib/credits.ts`), and the
decrement is guarded by a `credits >= 1` condition inside a single `UPDATE`, which is what makes
two concurrent requests for the last credit safe.

Routes charge **before** calling the model — deliberately, because the streaming chat route
cannot send a 402 once the response has started. If the work then fails, `refundOnFailure()`
hands the credit back: a model outage should not cost the user anything. Every refund is gated on
a `charged` flag set only after a successful charge, so a request rejected for being malformed or
throttled never refunds a credit it never spent.

### Rate limiting

Fixed-window counters in the `ratelimit` table (`lib/rate-limit.ts`), incremented by a single
atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` so two concurrent requests cannot both
read a count under the limit. Postgres rather than Redis or an in-process `Map`: the app already
has a pooled connection, and a `Map` would only count within one serverless instance.

Limits are checked before the credit charge, so a throttled request is never billed. The PDF
extraction route is keyed by IP rather than viewer, since a caller rotating guest identities
should not get a fresh allowance with each one.

### Prompts

Prompts are TypeScript modules under `lib/prompts/`, not `.txt` files. The previous filesystem
loader built its path with `path.join(process.cwd(), ...)`, which Next's build-time file tracing
cannot follow — so the files were stripped from the serverless bundle and the LLM routes died
with `ENOENT` in production. As modules they are simply imported and always bundled. Each carries
`import "server-only"` so prompt text cannot be pulled into a client bundle.

### Quiz answers

Answers never reach the client before the user commits to a choice. `PUBLIC_QUESTION_SELECT`
(`lib/quiz.ts`) is the projection used by both the generation response and the library listing,
and it omits `correctAnswer` and `explanation`; `POST /api/flash-quiz-mode/check` is the only
route that reads them, and it does so one question at a time, scoped to the caller's own quiz.

## Tests

```bash
pnpm test
```

No database is required: `lib/prisma` is mocked throughout, and Next route handlers are plain
exported functions, so tests call `POST`/`GET` with a `Request` directly. Coverage focuses on the
parts where a mistake is silent — grading, credit accounting and refunds, rate-limit arithmetic,
cookie signing, answer leakage into responses, and input validation.

## Deploying

Set every variable from `.env.example` on the host, including `GUEST_COOKIE_SECRET` — the app
throws on the first guest cookie without it in production.

`app/api/cron/cleanup/route.ts` deletes guest accounts that have been inactive for 30 days and
their data along with them (the relations cascade). It is guarded by `CRON_SECRET` and returns
503 while that is unset, so it is inert until you wire up a scheduler:

```jsonc
// vercel.json
{ "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 4 * * *" }] }
```
