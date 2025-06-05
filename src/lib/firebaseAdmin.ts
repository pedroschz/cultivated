import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

let admin: App;

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // Replace escaped newlines in the private key
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), 
};

// TEMPORARY DEBUGGING: Log service account details
console.log("Firebase Admin Init - Raw FIREBASE_PRIVATE_KEY env var (first 70 chars):", process.env.FIREBASE_PRIVATE_KEY?.substring(0, 70));
console.log("Firebase Admin Init - Project ID:", serviceAccount.projectId);
console.log("Firebase Admin Init - Client Email:", serviceAccount.clientEmail);
if (serviceAccount.privateKey) {
  console.log("Firebase Admin Init - Processed Private Key (start with replace):", serviceAccount.privateKey.substring(0, 70));
  console.log("Firebase Admin Init - Processed Private Key (end with replace):", serviceAccount.privateKey.substring(serviceAccount.privateKey.length - 70));
  // Check if the replace function worked as expected
  const rawKeyHasEscapedNewlines = process.env.FIREBASE_PRIVATE_KEY?.includes('\\n');
  const processedKeyHasActualNewlines = serviceAccount.privateKey.includes('\n');
  const processedKeyHasEscapedNewlines = serviceAccount.privateKey.includes('\\n');
  console.log("Firebase Admin Init - Raw key had \\n:", rawKeyHasEscapedNewlines);
  console.log("Firebase Admin Init - Processed key has \n (actual newlines):", processedKeyHasActualNewlines);
  console.log("Firebase Admin Init - Processed key still has \\n (escaped newlines - should be false if replace worked):", processedKeyHasEscapedNewlines);
  console.log("Firebase Admin Init - Processed Private Key length:", serviceAccount.privateKey.length);
} else {
  console.log("Firebase Admin Init - Private Key is MISSING after processing!");
}
// END TEMPORARY DEBUGGING

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  throw new Error(
    'Firebase Admin SDK Service Account credentials are not fully set in environment variables. ' +
    'Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
  );
}

if (!getApps().length) {
  admin = initializeApp({
    credential: cert(serviceAccount as any), // Cast as any because type expects more specific string types
  });
} else {
  admin = getApps()[0]!;
}

export const adminAuth = getAdminAuth(admin);
