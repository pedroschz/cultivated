/**
 * Centralized config for Firebase Functions. Mirrors `src/lib/config.ts`
 * on the Next.js side. Keep these helpers small and dependency-free so
 * they can be imported from any function or trigger.
 */

const DEFAULT_BASE_URL = "http://localhost:3000";

/** Public URL of the deployed web app. Used in transactional emails. */
export function getWebBaseUrl(): string {
  const v =
    process.env.WEB_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WEB_BASE_URL?.trim() ||
    DEFAULT_BASE_URL;
  return v.replace(/\/$/, "");
}

/** Display name for the app (used in email subjects, etc). */
export function getAppName(): string {
  return process.env.APP_NAME?.trim() || process.env.NEXT_PUBLIC_APP_NAME?.trim() || "CultivatED";
}

/**
 * Comma-separated allowlist of recipient emails for the email-debug
 * admin tool. When unset, no recipients are allowed (safe default).
 */
export function getAllowedTestEmails(): string[] {
  const raw = process.env.ALLOWED_TEST_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
