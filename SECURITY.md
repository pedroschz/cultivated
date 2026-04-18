# Security Policy

## Reporting a vulnerability

Thank you for helping keep CultivatED and its users safe.

**Please do not file a public GitHub issue for security vulnerabilities.**

Instead, report privately via one of:

1. **GitHub Security Advisories** — open a draft advisory at the repository's "Security" tab → "Report a vulnerability". This is the preferred channel.
2. **Email** — contact the maintainers privately (see the `MAINTAINERS` list in the repo description or commit history). Use a clear subject like `[SECURITY] <short description>`.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce (proof-of-concept code, requests, or a short video are very helpful).
- Affected versions / commit hashes.
- Any suggested mitigation.

## What to expect

- We aim to acknowledge new reports within **3 business days**.
- We aim to provide an initial assessment within **7 business days**.
- We will keep you informed of the fix timeline and credit you in the release notes (unless you prefer to remain anonymous).

## Scope

In scope:

- The Next.js web app under `src/`
- Firebase Cloud Functions under `functions/`
- Firestore and Storage security rules (`firestore.rules`, `storage.rules`)
- The Expo mobile app under `apps/mobile/`

Out of scope:

- Vulnerabilities in third-party dependencies (please report upstream).
- Issues that require a compromised user device or social-engineered authenticated session.
- Rate-limiting / DoS reports without a clear amplification or auth-bypass component.

Thank you!
