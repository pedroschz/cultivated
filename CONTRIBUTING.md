# Contributing to CultivatED

Thanks for your interest in contributing! This document covers the basics. By contributing, you agree your work will be licensed under the [Apache License 2.0](./LICENSE).

## Code of conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting set up locally

1. Fork the repository on GitHub and clone your fork.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env.local` and fill in values — see [`docs/SETUP.md`](./docs/SETUP.md) for a step-by-step Firebase setup walkthrough.
4. Run the dev server: `npm run dev`.
5. (Optional) Seed demo data: `npm run seed:demo`.

## Project layout

See [README.md](./README.md#%EF%B8%8F-project-structure-high-level) and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Branching and commits

- Create a topic branch off `main`: `git checkout -b feature/short-description` or `fix/short-description`.
- Use clear, imperative commit messages: `add foo`, `fix bar`, `refactor baz`. Squash WIP commits before opening the PR.
- One logical change per PR. If you find yourself bundling unrelated work, split it.

## Code style

- **TypeScript** for everything, no implicit `any`.
- Run `npm run lint` before committing.
- Components: prefer composition over inheritance, keep them small and focused, colocate styles with Tailwind.
- File names: `kebab-case.ts` for utilities, `PascalCase.tsx` for React components.
- Keep secrets out of the repo. Anything sensitive belongs in `.env.local` or Firebase Secrets — never committed.
- Don't add comments that just narrate what code does; comment intent or trade-offs only.

## Pull request checklist

Before requesting review, please confirm:

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes (catches type errors).
- [ ] No new dependencies without justification in the PR description.
- [ ] No personal info, hardcoded URLs, or commercial assets added.
- [ ] If touching the Firestore data model, [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) is updated.
- [ ] If adding a new env var, both `.env.example` and the relevant doc are updated.
- [ ] User-facing changes have a brief screenshot/screen recording in the PR.

## Adding a new dependency

- Prefer well-maintained, widely-used packages.
- Pin to the latest stable major.
- Justify the addition in the PR description (why it's needed, what was considered as an alternative).

## Reporting bugs / proposing features

Use the GitHub Issues templates. For security issues, see [`SECURITY.md`](./SECURITY.md) — do **not** open a public issue.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
