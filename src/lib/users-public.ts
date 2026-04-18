/**
 * Helpers for reading the `users_public/{uid}` collection.
 *
 * The full `users/{uid}` doc is owner-only (see `firestore.rules`); any code
 * that needs to look up *another* user's display info should go through this
 * module so the public surface stays small and consistent.
 *
 * The mirror is maintained by the `mirrorUserPublicOnWrite` Cloud Function in
 * `functions/src/triggers.ts` — when a private `users/{uid}` doc changes, the
 * fields in `PUBLIC_USER_FIELDS` are copied to `users_public/{uid}`.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";

/**
 * The exact set of fields that get mirrored to `users_public/{uid}`.
 * Keep this list in sync with `PUBLIC_USER_FIELDS` in
 * `functions/src/triggers.ts`.
 */
export const PUBLIC_USER_FIELDS = [
  "username",
  "name",
  "displayName",
  "firstName",
  "avatarIcon",
  "avatarColor",
  "avatar",
  "school",
  "schoolId",
  "schoolSlug",
  "country",
  "countryCode",
  "class",
  "referrerUsername",
  "friends",
  "lastLogin",
  "lastActive",
  "publicCompetency", // see triggers.ts: derived from adaptiveLearning
  "publicQuestionsAnswered", // see triggers.ts
  "publicMasteryLevel", // see triggers.ts
  "publicMasteryHistory", // last ~60 days of mastery snapshots
] as const;

export type PublicUserField = (typeof PUBLIC_USER_FIELDS)[number];

export interface PublicUser {
  id: string;
  username?: string | null;
  name?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  avatarIcon?: string | null;
  avatarColor?: string | null;
  avatar?: any;
  school?: string | null;
  schoolId?: string | null;
  schoolSlug?: string | null;
  country?: string | null;
  countryCode?: string | null;
  class?: string | null;
  referrerUsername?: string | null;
  friends?: string[];
  lastLogin?: any;
  lastActive?: any;
  publicCompetency?: number | null;
  publicQuestionsAnswered?: number | null;
  publicMasteryLevel?: string | null;
  publicMasteryHistory?: Array<{ date: string; overall?: number; math?: number; readingWriting?: number }>;
}

/** Read a single public profile by uid. Returns null if not present. */
export async function getPublicUser(
  db: Firestore,
  uid: string,
): Promise<PublicUser | null> {
  if (!uid) return null;
  const ref = doc(db, "users_public", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) };
}

/** Read many public profiles in parallel. Missing uids are filtered out. */
export async function getPublicUsers(
  db: Firestore,
  uids: string[],
): Promise<PublicUser[]> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const results = await Promise.all(unique.map((u) => getPublicUser(db, u)));
  return results.filter((u): u is PublicUser => u !== null);
}

/** Look up a public profile by exact (case-sensitive) username. */
export async function getPublicUserByUsername(
  db: Firestore,
  username: string,
): Promise<PublicUser | null> {
  const trimmed = (username || "").trim();
  if (!trimmed) return null;
  const q = query(collection(db, "users_public"), where("username", "==", trimmed));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as any) };
}

/** Run an arbitrary query against `users_public`. */
export async function queryPublicUsers(
  db: Firestore,
  ...constraints: QueryConstraint[]
): Promise<PublicUser[]> {
  const q = query(collection(db, "users_public"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}
