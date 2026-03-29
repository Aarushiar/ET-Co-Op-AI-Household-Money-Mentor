# ET Co-Op AI Household Money Mentor
Live Demo: https://et-co-op.vercel.app
Architecture Document: ./ARCHITECTURE.md

ET Co-Op is a Next.js application for two-partner household financial planning. It combines deterministic tax optimization with an AI mentor layer, HR email draft generation, and an execution workflow for sending email actions.

## What This Project Does

1. Auth flow with register, sign in, session check, and logout.
2. Household optimization engine for tax leakage, regime recommendations, and ranked tax-saving actions.
3. Advanced planning modules:
   1. FIRE readiness projection.
   2. Financial health score.
   3. Life-event simulator (input-driven).
   4. Mutual fund X-Ray.
4. AI mentor output with plain-language explanation and HR email drafts.
5. Execute Fixes flow to send emails via Resend, with safe draft-only fallback when email is not configured.

## Tech Stack

1. Next.js 16 (App Router, Turbopack)
2. TypeScript
3. React 19
4. Tailwind CSS 4
5. Zod (API payload validation)
6. Vitest (unit and API route tests)
7. OpenAI SDK (optional AI generation)
8. Resend SDK (optional email sending)

## Prerequisites

1. Node.js 20 or newer
2. npm 10 or newer
3. Git

## Setup

### 1. Clone and install

```bash
git clone <YOUR_REPO_URL>
cd et-co-op
npm ci
```

Windows note: if PowerShell blocks npm scripts, run commands via `cmd /c npm ...`.

### 2. Configure environment variables

Copy the template and edit values:

```bash
copy .env.local.example .env.local
```

Required minimum for local app access:

1. `AUTH_SESSION_SECRET` must be set to a strong random value.

Optional for full features:

1. `OPENAI_API_KEY` for AI responses.
2. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for email sending.
3. `DEMO_EMAIL_TO` or `PARTNER_A_EMAIL` and `PARTNER_B_EMAIL` for recipients.

If Resend is not configured, Execute Fixes will remain in draft-only fallback mode by design.

## Demo Mode vs Full Mode

1. Demo mode (safe fallback):
   1. Without `OPENAI_API_KEY`, AI Mentor still works using deterministic fallback guidance.
   2. Without `RESEND_API_KEY`, Execute Fixes remains in draft-only mode and does not send emails.
2. Full mode (live providers):
   1. Set `OPENAI_API_KEY` to enable live OpenAI-generated mentor output.
   2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to enable live email delivery.
3. Judge verification tip:
   1. In the app, check the "Demo Mode vs Full Mode" panel under AI Mentor Layer.
   2. It explicitly shows whether AI and email are running in fallback or full provider mode.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Quality Checks

Run all checks before pushing:

```bash
npm run lint
npm run test
npm run build
```

## Automated CI

GitHub Actions workflow is defined in `.github/workflows/ci.yml`.

On push and pull request, CI runs:

1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `npm run build`

## API Endpoints

1. `POST /api/auth/register`
2. `POST /api/auth/login`
3. `GET /api/auth/session`
4. `POST /api/auth/logout`
5. `POST /api/optimize`
6. `POST /api/ai-mentor`
7. `POST /api/execute-fixes`

All non-auth business endpoints are protected by session auth and rate limiting.

## Testing Coverage

Current test suites include:

1. Optimization engine deterministic behavior.
2. API route tests for optimize, ai-mentor, and execute-fixes.
3. Validation tests for invalid life-event payloads.
4. Unauthorized and rate-limit behavior for API routes.

## Repository Hygiene and Security Notes

1. `.env*` is ignored. Do not commit `.env.local`.
2. `.data/` is ignored. Do not commit local runtime user data.
3. Keep API keys and secrets only in local or deployment environment settings.

## Suggested Commit Convention

To keep build process traceable in history, use grouped commits:

1. `feat:` application features.
2. `test:` test additions.
3. `ci:` workflow or automation updates.
4. `docs:` README and setup guidance.

## Troubleshooting

### npm ci fails with lockfile error

Run from project root where `package-lock.json` exists:

```bash
cd et-co-op
npm ci
```

### npm.ps1 blocked on Windows PowerShell

Use cmd form:

```bash
cmd /c npm ci
cmd /c npm run test
```

### Runtime overlay says MetaMask extension not found

This is from a browser extension, not this app. Test in a clean browser profile or disable wallet extensions.
