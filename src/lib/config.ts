/**
 * Centralized runtime configuration. All references to the deployed app
 * URL, app name, and Firebase project should go through these helpers so
 * the project stays fork-friendly.
 *
 * For client-side usage (anything that runs in the browser), use the
 * `NEXT_PUBLIC_*` variants — these are inlined at build time by Next.js.
 *
 * For server-side / Functions code, see `functions/src/config.ts`.
 */

export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME?.trim() || "CultivatED";

/**
 * Public URL where the deployed app is reachable. Used for OpenGraph,
 * sitemaps, robots.txt, transactional email links, QR codes, etc.
 *
 * Defaults to localhost in development so the build doesn't blow up if
 * the env var is missing. ALWAYS set this in your hosting environment.
 */
export const WEB_BASE_URL =
  process.env.NEXT_PUBLIC_WEB_BASE_URL?.trim().replace(/\/$/, "") ||
  "http://localhost:3000";

/**
 * Firebase project ID. Required for any code path that needs to address
 * Firestore directly via the REST API or construct project-scoped URLs.
 * Returns null (instead of throwing) so call-sites can decide what to do.
 */
export function getFirebaseProjectId(): string | null {
  const id = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  return id && id.length > 0 ? id : null;
}

/**
 * Schools allowed on the school leaderboard / partner-school features.
 * Comma-separated env var. When unset, no schools are restricted (the
 * features either show generic UI or are hidden — see call sites).
 */
export function getAllowedSchools(): string[] {
  const raw = process.env.NEXT_PUBLIC_ALLOWED_SCHOOLS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Username of the "house" referrer that gets unlimited referrals (used to
 * preassign new signups to a default referrer when no ?ref code is given).
 * Returns null when unset — call sites should treat this as "feature off".
 */
export function getUnlimitedReferrerUsername(): string | null {
  const v = process.env.NEXT_PUBLIC_UNLIMITED_REFERRER_USERNAME?.trim();
  return v && v.length > 0 ? v.toLowerCase() : null;
}

export function requireFirebaseProjectId(): string {
  const id = getFirebaseProjectId();
  if (!id) {
    throw new Error(
      "Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID env var. " +
        "Set it in .env.local — see .env.example for the full list."
    );
  }
  return id;
}
