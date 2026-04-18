# CultivatED — Adaptive SAT® Practice Platform

> **An open-source adaptive learning platform for standardized-test prep.** Personalized question selection, AI voice tutoring, and detailed mastery analytics — built with Next.js 15, Firebase, and Google Gemini.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

> **Trademark disclaimer:** SAT® is a registered trademark of the College Board, which does not endorse and is not affiliated with this project. References to "SAT" in this codebase are nominative fair use to describe the standardized test that this software helps users prepare for.

---

## ✨ What's inside

- **Adaptive learning engine** — picks the next question based on per-skill mastery scores, recency, difficulty, and confidence.
- **Voice AI tutor** — real-time conversational tutor powered by Google Gemini Live + AssemblyAI transcription.
- **Mastery analytics** — historical mastery snapshots per domain with charts, streak tracking, and improvement insights.
- **Schools mode** — teacher and school-admin dashboards, assignments, student progress, leaderboards.
- **Onboarding & gamification** — first-time user flow, friend system, referral rewards, streaks.
- **Firebase end-to-end** — Auth, Firestore, Storage, Functions, Hosting; deployable as a single project.

A companion **mobile app** (Expo / React Native) lives under [`apps/mobile/`](./apps/mobile/).

---

## 🚀 Quickstart

```bash
git clone https://github.com/<your-fork>/cultivated.git
cd cultivated
npm install
cp .env.example .env.local        # then fill in the values
npm run dev                       # http://localhost:3000
```

You'll need a Firebase project and API keys for Gemini, AssemblyAI, and (optionally) Desmos. See [**`docs/SETUP.md`**](./docs/SETUP.md) for the full walkthrough.

---

## 📚 Documentation

| Doc | What's in it |
|---|---|
| [`docs/SETUP.md`](./docs/SETUP.md) | Step-by-step Firebase project setup, env vars, local dev. |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | High-level system design and folder layout. |
| [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) | Firestore collections, document shapes, indexes. |
| [`docs/QUESTIONS.md`](./docs/QUESTIONS.md) | Question bank format and how to import your own. |
| [`docs/ADAPTIVE_LEARNING.md`](./docs/ADAPTIVE_LEARNING.md) | Scoring algorithm and skill mapping. |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Deploy to Firebase Hosting + Functions. |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Branch naming, PR checklist, code style. |
| [`SECURITY.md`](./SECURITY.md) | How to report security vulnerabilities. |

---

## 🧰 Tech stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS** + **Radix UI**
- **Firebase**: Authentication, Firestore, Storage, Cloud Functions, Hosting
- **Google Gemini Live** for voice AI; **AssemblyAI** for transcription
- **Recharts** + **KaTeX** for analytics & math rendering
- **Expo** (React Native) for the mobile app

See [`package.json`](./package.json) and [`functions/package.json`](./functions/package.json) for the full dependency list.

---

## 🗂️ Project structure (high level)

<details>
<summary>Click to expand</summary>

```
cultivated/
├── src/app/                Next.js App Router pages & API routes
├── src/components/         UI components (ui/, layout/, voice/, dashboard/, …)
├── src/lib/                Adaptive learning, Firebase clients, hooks, utilities
│   ├── config.ts           Centralized env-var-driven config
│   └── adaptive-learning/  Scoring engine, skill mapping, question selection
├── functions/              Firebase Cloud Functions (TypeScript)
├── apps/mobile/            Expo (React Native) companion app
├── scripts/                Admin/dev scripts (audits, imports, seed data)
├── public/                 Static assets (logos, PDFs, audio previews)
├── docs/                   Long-form documentation
├── private-assets/         Local-only assets (gitignored — see "Brand fonts")
├── firebase.json           Firebase project config
├── firestore.rules         Firestore security rules
└── storage.rules           Firebase Storage security rules
```

</details>

---

## 🔤 Brand fonts

The deployed site uses two commercial fonts — **DIN Round Pro** and **Brasley** — that are **not** included in this repository for licensing reasons. The default OSS build falls back to **Inter** (Google Fonts) and looks clean.

If you have valid licenses for those fonts:

1. Place the `.otf` files under `private-assets/fonts/`:
   ```
   private-assets/fonts/brasley.otf
   private-assets/fonts/DIN Round Pro/dinroundpro_light.otf
   private-assets/fonts/DIN Round Pro/dinroundpro.otf
   private-assets/fonts/DIN Round Pro/dinroundpro_medi.otf
   private-assets/fonts/DIN Round Pro/dinroundpro_bold.otf
   private-assets/fonts/DIN Round Pro/dinroundpro_black.otf
   ```
2. Run `npm run setup:fonts` (also runs automatically inside `deploy.sh`).
3. Swap the font setup in [`src/app/layout.tsx`](./src/app/layout.tsx) using the snippet in [`src/app/layout.brand-fonts.tsx.example`](./src/app/layout.brand-fonts.tsx.example).

The `private-assets/` directory and the copied `public/` font paths are gitignored.

---

## 🤝 Contributing

Pull requests welcome! See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, conventions, and the PR checklist. If you're reporting a security issue, please follow [`SECURITY.md`](./SECURITY.md) instead of opening a public issue.

---

## 📝 License

Licensed under the [Apache License, Version 2.0](./LICENSE). See [`NOTICE`](./NOTICE) for attribution and trademark notes.

---

**CultivatED** — Empowering students to master standardized tests through intelligent, adaptive learning.
