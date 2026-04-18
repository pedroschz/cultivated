# Setup Guide

This guide walks you through creating a Firebase project from scratch, configuring environment variables, and running CultivatED locally.

## Prerequisites

- **Node.js 20+** and **npm 10+**
- **Firebase CLI**: `npm install -g firebase-tools`
- A Google account for Firebase and Gemini API access
- (Optional) An [AssemblyAI](https://www.assemblyai.com/) account for voice transcription

---

## 1 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/) → **Add project**.
2. Give it a name (e.g. `my-sat-app`). Disable Google Analytics if you don't need it.
3. Once created, note your **project ID** (shown in the URL and project settings).

### Enable Firebase services

In the Firebase console, activate each of these:

| Service | Where |
|---|---|
| **Authentication** | Build → Authentication → Get started → Enable **Email/Password** |
| **Firestore** | Build → Firestore → Create database → Start in **production mode** |
| **Storage** | Build → Storage → Get started → accept the default rules |
| **Functions** | Build → Functions → Get started (requires Blaze pay-as-you-go plan) |
| **Hosting** | Build → Hosting → Get started |

### Deploy Firestore indexes and security rules

```bash
firebase login               # authenticate once
firebase use --add           # select your project; alias it "default"
firebase deploy --only firestore:rules,firestore:indexes,storage
```

---

## 2 — Get your Firebase config values

In the Firebase console → **Project settings** (gear icon) → **General** → scroll to **Your apps**.

If there's no web app yet, click **Add app** → Web → register it.

Copy the `firebaseConfig` object — those values map directly to the `NEXT_PUBLIC_FIREBASE_*` env vars.

### Generate a service account key (for Admin SDK / scripts)

Project settings → **Service accounts** → **Generate new private key** → download the JSON.

Open it and copy the fields to your `.env.local`:

```
FIREBASE_PROJECT_ID       ← project_id
FIREBASE_CLIENT_EMAIL     ← client_email
FIREBASE_PRIVATE_KEY      ← private_key  (keep the \n escapes, wrap in quotes)
```

---

## 3 — Get API keys

### Google Gemini (AI tutor)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Create a key → copy it to `GEMINI_API_KEY`.

### AssemblyAI (voice transcription — optional)

1. Sign up at [assemblyai.com](https://www.assemblyai.com/).
2. Dashboard → API key → copy to `ASSEMBLYAI_API_KEY`.
3. If you skip this, voice transcription will be disabled but the rest of the app works fine.

### Desmos calculator (optional)

Register at [desmos.com/api](https://www.desmos.com/api) and set `NEXT_PUBLIC_DESMOS_API_KEY`. The calculator widget degrades gracefully when the key is absent.

---

## 4 — Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the values. At minimum you need:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

GEMINI_API_KEY=...
NEXT_PUBLIC_WEB_BASE_URL=http://localhost:3000
```

---

## 5 — Set up Firebase Functions secrets

Cloud Functions read sensitive values from Firebase Secrets (not from `.env.local`). Set them once:

```bash
firebase functions:secrets:set GMAIL_USER   # e.g. notifications@gmail.com
firebase functions:secrets:set GMAIL_PASS   # Gmail App Password
firebase functions:secrets:set EMAIL_FROM   # e.g. "CultivatED <notifications@gmail.com>"
```

To verify: `firebase functions:secrets:access GMAIL_USER`

---

## 6 — Run locally

```bash
npm install
npm run dev        # Next.js dev server at http://localhost:3000
```

### Seed demo data (optional)

Creates one admin user + five sample questions + one demo school so the app is functional out of the box:

```bash
npm run seed:demo
```

### Import your question bank

See [`docs/QUESTIONS.md`](./QUESTIONS.md) for the question format and:

```bash
npm run import:questions -- --file=path/to/questions.json
```

---

## 7 — Deploy Functions

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

---

## 8 — Make the first user an admin

After signing up with your account, run this once to grant admin access:

```bash
# Find your uid in Firebase Auth console, then:
TS_NODE_TRANSPILE_ONLY=1 ts-node scripts/set-admin-claim.ts <uid>
```

Or in the Firebase console → Authentication → find your user → copy UID → Functions → run `setAdminClaim` callable with `{ uid }`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing FIREBASE_*` errors at startup | Check `.env.local` is filled in and the server was restarted |
| Firestore permission denied | Run `firebase deploy --only firestore:rules` |
| Functions fail to deploy | Ensure you're on the Blaze billing plan |
| Fonts appear as Inter | That's the OSS fallback — see README "Brand fonts" section |
