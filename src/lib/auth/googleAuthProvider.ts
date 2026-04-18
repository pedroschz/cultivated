import { GoogleAuthProvider } from "firebase/auth";

let googleProvider: GoogleAuthProvider | null = null;

export function getGoogleAuthProvider(): GoogleAuthProvider {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
  }
  return googleProvider;
}
