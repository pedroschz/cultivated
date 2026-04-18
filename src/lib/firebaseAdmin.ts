import { getApps, initializeApp, cert, App, applicationDefault } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * This module handles the server-side initialization of the Firebase Admin SDK.
 * It uses service account credentials from environment variables to create a
 * secure connection for administrative tasks like minting custom tokens or
 * accessing Firestore with elevated privileges.
 */

let admin: App;

// The service account credentials for the Firebase project, loaded from environment variables.
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // The private key needs to have its escaped newline characters replaced.
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), 
};

// Initialize the Firebase Admin app, but only if it hasn't been initialized already.
// This prevents re-initialization errors in environments like serverless functions.
if (!getApps().length) {
  const hasServiceAccount = Boolean(serviceAccount.projectId && serviceAccount.clientEmail && serviceAccount.privateKey);
  admin = initializeApp({
    credential: hasServiceAccount ? cert(serviceAccount as any) : applicationDefault(),
  });
} else {
  // If already initialized, get the existing app instance.
  admin = getApps()[0]!;
}

/** The Firebase Admin Authentication service. */
export const adminAuth = getAdminAuth(admin);
/** The Firebase Admin Firestore service. */
export const db = getFirestore(admin);
/** The initialized Firebase Admin app instance. */
export const adminApp = admin;
