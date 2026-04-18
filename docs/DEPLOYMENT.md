# Deployment Guide

CultivatED deploys as a static Next.js export to Firebase Hosting, with Cloud Functions as the backend.

---

## Prerequisites

1. Firebase project fully configured (see [`docs/SETUP.md`](./SETUP.md)).
2. Firebase CLI authenticated: `firebase login`.
3. Project selected: `firebase use --add` (or `firebase use <project-id>`).
4. All env vars set in your hosting environment (see below).

---

## Environment variables in production

The static export inlines `NEXT_PUBLIC_*` values at **build time**. You must set them in your build environment (CI secrets, `.env.production`, etc.) before running `npm run build`.

Server-only vars (`FIREBASE_*`, `GEMINI_API_KEY`, `ASSEMBLYAI_API_KEY`) are used exclusively in Next.js API routes and don't need to be set for a fully-static Firebase Hosting deploy. They're only needed if you run `next start` (Node.js server mode).

Firebase Functions read secrets via `firebase functions:secrets:*`. Non-sensitive runtime config goes into `firebase functions:config:set` or `.env` files in `functions/`.

### Setting `NEXT_PUBLIC_WEB_BASE_URL` for production

Make sure this points to your live URL before building:

```bash
NEXT_PUBLIC_WEB_BASE_URL=https://your-project.web.app npm run build
```

Or set it in a `.env.production` file (which `.gitignore` excludes by default via `.env*`).

---

## Manual deploy

```bash
# 1. Copy brand fonts if you have them (no-op otherwise)
npm run setup:fonts

# 2. Build
NEXT_PUBLIC_WEB_BASE_URL=https://your-project.web.app npm run build

# 3. Deploy Functions first (so the app can call them immediately)
firebase deploy --only functions

# 4. Deploy Hosting
firebase deploy --only hosting

# 5. Deploy Firestore rules + indexes (run after any rules change)
firebase deploy --only firestore:rules,firestore:indexes

# 6. Deploy Storage rules (run after any rules change)
firebase deploy --only storage
```

Or use the convenience script (handles fonts + build + deploy):

```bash
NEXT_PUBLIC_WEB_BASE_URL=https://your-project.web.app \
  APP_URL=https://your-project.web.app \
  bash deploy.sh
```

---

## Named hosting targets

If you use [Firebase Hosting multiple sites](https://firebase.google.com/docs/hosting/multisites), apply a target first:

```bash
firebase target:apply hosting my-target your-site-id
```

Then deploy with:

```bash
FIREBASE_HOSTING_TARGET=my-target bash deploy.sh
```

---

## GitHub Actions CI/CD (optional)

A ready-to-use workflow is provided in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

To add auto-deploy to Firebase on push to `main`:

1. Generate a CI service account token:
   ```bash
   firebase login:ci
   ```
2. Add it as a GitHub secret: `FIREBASE_TOKEN`.
3. Add all `NEXT_PUBLIC_*` values as GitHub secrets.
4. Uncomment the deploy steps in `.github/workflows/ci.yml`.

---

## Rollback

Firebase Hosting keeps a history of releases. To roll back:

```bash
firebase hosting:releases:list
firebase hosting:rollback          # reverts to the previous release
```

---

## Firestore + Storage rules

Rules are version-controlled in `firestore.rules` and `storage.rules`. Deploy them after any change:

```bash
firebase deploy --only firestore:rules,storage
```

Always run `firebase emulators:start` and test your rules locally before deploying to production.
