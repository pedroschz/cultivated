import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore, initializeFirestore } from "firebase/firestore";

/**
 * This module handles the initialization of the Firebase SDK.
 * It supports both client-side and server-side initialization for Firestore access.
 */

// Firebase configuration object, populated from environment variables.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

/**
 * Validates that all required Firebase configuration keys are present.
 * @returns True if the configuration is valid, false otherwise.
 */
const validateFirebaseConfig = (): boolean => {
  const requiredKeys: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);
  
  if (missingKeys.length > 0) {
    console.error(`Missing Firebase configuration keys: ${missingKeys.join(', ')}`);
    return false;
  }
  return true;
};

let app: FirebaseApp | undefined;
let auth: any = undefined;
let storage: any = undefined;
let db: any = undefined;
let labsDb: any = undefined;

try {
  if (validateFirebaseConfig()) {
    // Initialize the Firebase app, or get the existing instance if already initialized.
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    
    // Initialize Firebase services.
    auth = getAuth(app);
    storage = getStorage(app);
    
    if (typeof window !== "undefined") {
      // Initialize Firestore with networking fallbacks to avoid CORS issues in certain environments
      db = initializeFirestore(app, {
        // Force long polling to avoid streaming channels that can trip CORS
        experimentalForceLongPolling: true,
        experimentalLongPollingOptions: { timeoutSeconds: 30 },
      });
    } else {
      // Server-side initialization
      db = getFirestore(app);
    }

    // Secondary Firestore database for 1600Labs (named databaseId: 'labs')
    try {
      labsDb = getFirestore(app, 'labs');
    } catch (e) {
      // Fallback: if secondary DB init fails, leave undefined and callers will guard
      labsDb = undefined;
    }
  } else {
    console.error('Firebase initialization skipped due to invalid configuration.');
  }
} catch (error) {
  console.error('An error occurred during Firebase initialization:', error);
}

/** The initialized Firebase app instance. */
export { app, auth, storage, db, labsDb };
