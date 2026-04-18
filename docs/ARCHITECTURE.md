# Architecture Overview

CultivatED is a full-stack web application built on Firebase + Next.js. This document covers the high-level design, request flow, and key subsystems.

---

## System diagram

```
┌────────────────────────────────────────────────────────────────┐
│  Browser / React Native app                                    │
│  Next.js 15 (App Router)                                      │
│  Tailwind CSS + Radix UI                                      │
└──────────┬─────────────────────────────────────────────────────┘
           │  Firebase JS SDK (Firestore, Auth, Storage)
           │  HTTPS (API routes → Functions)
           ▼
┌────────────────────────────────────────────────────────────────┐
│  Firebase Platform                                             │
│  ├── Authentication   (email/password; custom claims)         │
│  ├── Firestore        (primary NoSQL store)                   │
│  ├── Storage          (images, audio recordings)              │
│  ├── Cloud Functions  (server-side logic, triggers, email)    │
│  └── Hosting          (static Next.js export)                 │
└──────────┬─────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────┐  ┌──────────────────────────┐
│  Google Gemini Live API          │  │  AssemblyAI API           │
│  (AI voice tutor sessions)       │  │  (speech-to-text)         │
└──────────────────────────────────┘  └──────────────────────────┘
```

---

## Frontend — Next.js App Router

### Routing overview

| Route group | Description |
|---|---|
| `src/app/(landing)/` | Public marketing pages, blog |
| `src/app/login/`, `/signup/`, `/onboarding/` | Auth and first-time setup |
| `src/app/dashboard/` | Main user hub — mastery charts, session history |
| `src/app/practice/` | Practice session engine |
| `src/app/scores/` | Detailed performance analytics |
| `src/app/leaderboard/` | Global and school leaderboards |
| `src/app/friends/` | Friend system |
| `src/app/settings/` | User preferences, account management |
| `src/app/schooladmin/` | School admin portal (teachers, students, assignments) |
| `src/app/admin/` | Platform admin (users, email, blog, schools) |
| `src/app/api/` | Next.js API routes that proxy to Firebase Functions / external APIs |

### Key API routes

These server-side routes proxy sensitive API calls so credentials never reach the browser:

| Route | Purpose |
|---|---|
| `POST /api/gemini/live-token` | Mints an ephemeral Gemini Live token |
| `POST /api/assemblyai/upload` | Uploads audio to AssemblyAI |
| `GET /api/assemblyai/transcript/[id]` | Polls for a transcript |
| `POST /api/gemini/generate` | One-shot Gemini text generation |

### State management

- **Practice session** — `src/lib/context/PracticeSessionContext.tsx` (React Context, in-memory during the session; written to Firestore on completion).
- **User profile** — `src/lib/context/UserContext.tsx` (Firestore `users/{uid}` document, kept in sync via `onSnapshot`).
- No global state library (Redux etc.) — Context is sufficient for the current scale.

---

## Adaptive learning engine

Located in `src/lib/adaptive-learning/`:

```
adaptive-service.ts   High-level API (fetchUser, scoreAnswer, getNextQuestion)
scoring-engine.ts     Score delta calculation (correct/incorrect, time, streaks)
skill-mapping.ts      Static mapping: skill name → domain ID → subdomainId
```

### Scoring loop

1. User answers a question.
2. `scoreAnswer(userId, question, answer, timeSpent)` is called.
3. `ScoringEngine.calculateDelta` computes a signed delta based on difficulty, time, and streak.
4. The delta is applied to `users/{uid}.adaptiveLearning.subdomainScores[subdomainId]`.
5. A daily mastery snapshot is written/updated in `users/{uid}.adaptiveLearning.masteryHistory`.
6. `getNextQuestion` uses subdomain scores + recency to select the optimal next question from Firestore.

See [`docs/ADAPTIVE_LEARNING.md`](./ADAPTIVE_LEARNING.md) for the full algorithm.

---

## Firebase Cloud Functions

Located in `functions/src/`:

| File | What's in it |
|---|---|
| `index.ts` | Callable functions (admin ops, school invites, referrals, …) |
| `triggers.ts` | Firestore document triggers (mirror public profile, score aggregation) |
| `email.ts` | Nodemailer transactional email (reads GMAIL_USER/PASS secrets) |
| `templates.ts` | HTML email templates |
| `config.ts` | Runtime config helpers (reads env vars, returns safe defaults) |
| `forumBots.ts` | Scheduled forum-activity bots |
| `chatTutor.ts` | Text-based AI tutor callable |
| `tutorContextApi.ts` | Builds per-question context for the AI tutor |

---

## Auth and access control

Firebase Auth custom claims gate access at two levels:

| Claim | Granted by | Effect |
|---|---|---|
| `admin: true` | `setAdminClaim` callable (admin only) | Full Firestore read/write, all admin routes |
| `role: "teacher"` or `"schoolAdmin"` + `schoolId` | `acceptTeacherInvite` callable | Read students in own school, school dashboard |

Firestore rules enforce these claims server-side (see `firestore.rules`). The Next.js admin routes additionally check claims on the client; this is defense-in-depth only — the real gate is the rules.

---

## Deployment model

The Next.js app is built as a **static export** (`output: "export"` in `next.config.ts`) and deployed to **Firebase Hosting**. Dynamic data is fetched client-side from Firestore. Server-only logic lives entirely in Cloud Functions.

The deploy flow is:
1. `npm run build` → static HTML/CSS/JS in `out/`
2. `firebase deploy --only hosting` → uploads `out/` to Firebase CDN
3. `firebase deploy --only functions` → deploys Cloud Functions separately

See [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) for the full deploy walkthrough.
