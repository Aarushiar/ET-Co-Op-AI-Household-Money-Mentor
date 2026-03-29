# ET Co-Op AI Household Money Mentor
Live Demo: https://et-co-op.vercel.app

Architecture Document: ./ARCHITECTURE.md

Impact Model: ./IMPACT_MODEL.md

ET Co-Op is a Next.js application for two-partner household financial planning. It combines deterministic tax optimization with an AI mentor layer, HR email draft generation, and an execution workflow for sending email actions.

## About project

1. Auth flow with register, sign in, session check, and logout.
2. One-click `Try Live Demo` is also there if someone just want to check how platform works without doing any login
3. Household optimization engine for tax leakage, regime recommendations, and ranked tax-saving actions.
4. Advanced planning modules:
   1. FIRE readiness projection.
   2. Financial health score.
   3. Life-event simulator (input-driven).
   4. Mutual fund X-Ray.
5. AI mentor output with plain-language explanation and HR email drafts.

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

### 2. Configure environment variables

Copy the template and edit values:

```bash
copy .env.local.example .env.local
```

Optional for full features:

1. `OPENAI_API_KEY` for AI responses.
2. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for email sending.
3. `DEMO_EMAIL_TO` or `PARTNER_A_EMAIL` and `PARTNER_B_EMAIL` for recipients.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.



## Automated CI/CD

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



```



