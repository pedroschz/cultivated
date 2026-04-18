import { signOut, type Auth, type User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Firestore,
} from "firebase/firestore";

const LABS_BLOCK_MESSAGE =
  "You can't log in to CultivatED because you already have an account at 1600Labs. Use a different email for CultivatED or visit 1600Labs to continue.";

/**
 * If the account is tied to 1600Labs (email or UID in the labs DB), signs the user out
 * and returns an error message. Otherwise returns null.
 */
export async function enforceLabsExclusion(
  auth: Auth,
  labsDb: Firestore | undefined,
  user: User,
): Promise<string | null> {
  try {
    const email = user.email?.trim().toLowerCase();
    if (email && labsDb) {
      const q = query(collection(labsDb, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        try {
          await signOut(auth);
        } catch {}
        return LABS_BLOCK_MESSAGE;
      }
    }
  } catch {}

  try {
    if (labsDb) {
      const labsUserSnap = await getDoc(doc(labsDb, "users", user.uid));
      if (labsUserSnap.exists()) {
        try {
          await signOut(auth);
        } catch {}
        return LABS_BLOCK_MESSAGE;
      }
    }
  } catch {}

  return null;
}
