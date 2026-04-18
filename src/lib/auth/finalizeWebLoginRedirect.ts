import type { User } from "firebase/auth";
import type { FirebaseApp } from "firebase/app";
import { doc, getDoc, serverTimestamp, updateDoc, type Firestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

/**
 * Shared post-auth redirect for web: teacher invites, onboarding gate, lastLogin.
 * Uses a full navigation so static-export auth state stays consistent.
 */
export async function finalizeWebLoginRedirect(opts: {
  app: FirebaseApp;
  db: Firestore;
  user: User;
  teacherToken: string | null;
}): Promise<void> {
  const { app, db, user, teacherToken } = opts;

  try {
    if (teacherToken) {
      const fns = getFunctions(app, "us-central1");
      const acceptTeacherInvite = httpsCallable(fns, "acceptTeacherInviteCallable");
      await acceptTeacherInvite({ token: teacherToken });
      await user.getIdToken(true);
      window.location.href = "/schooladmin";
      return;
    }
  } catch (e) {
    console.warn("Teacher invite acceptance failed:", e);
  }

  const userRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userRef);

  let redirectPath = "/dashboard";
  if (!userDoc.exists() || !userDoc.data()?.onboardingCompleted) {
    redirectPath = "/onboarding";
  }

  if (userDoc.exists()) {
    await updateDoc(userRef, {
      lastLogin: serverTimestamp(),
    });
  }

  window.location.href = redirectPath;
}
