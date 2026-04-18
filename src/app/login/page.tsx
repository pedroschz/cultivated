/**
 * @file This file implements the user login page with email/password authentication.
 * It handles user authentication through Firebase Auth, validates credentials,
 * and redirects users to the appropriate page based on their onboarding status.
 * The page includes form validation, error handling, and password visibility toggle.
 */
"use client";

// Prevent prerendering issues with client-only navigation hooks
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { app, auth, db, labsDb } from "@/lib/firebaseClient";
import { signInWithEmailAndPassword, signOut, signInWithPopup } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff } from "lucide-react";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { GoogleContinueButton } from "@/components/auth/GoogleContinueButton";
import { enforceLabsExclusion } from "@/lib/auth/labsUserGuard";
import { finalizeWebLoginRedirect } from "@/lib/auth/finalizeWebLoginRedirect";
import { getGoogleAuthProvider } from "@/lib/auth/googleAuthProvider";
import Link from "next/link";

export default function LoginPage() {
  const [teacherToken, setTeacherToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      setTeacherToken(p ? p.get('teacherToken') : null);
    } catch {
      setTeacherToken(null);
    }
  }, []);

  // Prefetch likely destinations after login
  useEffect(() => {
    router.prefetch('/dashboard');
    router.prefetch('/onboarding');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!auth || !db || !app) {
      setError("Firebase is not initialized. Check your firebaseClient.ts configuration.");
      setLoading(false);
      return;
    }

    try {
      // Pre-check: block login if a Labs user exists with the same email in the labs DB
      try {
        if (labsDb) {
          const q = query(collection(labsDb, 'users'), where('email', '==', email.trim().toLowerCase()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setError("You can't log in to CultivatED because you already have an account at 1600Labs. Use a different email for CultivatED or visit 1600Labs to continue.");
            setLoading(false);
            return;
          }
        }
      } catch {}

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        // Post-sign-in guard: if a Labs user document exists by UID, sign out and show message (avoids redirect flash)
        try {
          if (labsDb) {
            const labsUserSnap = await getDoc(doc(labsDb, 'users', user.uid));
            if (labsUserSnap.exists()) {
              try { await signOut(auth); } catch {}
              setError("You can't log in to CultivatED because you already have an account at 1600Labs. Use a different email for CultivatED or visit 1600Labs to continue.");
              setLoading(false);
              return;
            }
          }
        } catch {}

        await finalizeWebLoginRedirect({ app, db, user, teacherToken });
      }
    } catch (error: unknown) {
      console.error("Sign-in error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    if (!auth || !db || !app) {
      setError("Firebase is not initialized. Check your firebaseClient.ts configuration.");
      setLoading(false);
      return;
    }

    try {
      const { user } = await signInWithPopup(auth, getGoogleAuthProvider());
      const labsError = await enforceLabsExclusion(auth, labsDb, user);
      if (labsError) {
        setError(labsError);
        return;
      }
      await finalizeWebLoginRedirect({ app, db, user, teacherToken });
    } catch (err: unknown) {
      const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError(null);
      } else {
        console.error("Google sign-in error:", err);
        const message = err instanceof Error ? err.message : "Google sign-in failed. Please try again.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout 
    >
      <div className="space-y-6">
        <div className="space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-bold font-display">Sign In</h1>
          <p className="text-muted-foreground">
            Enter your credentials to access your account
          </p>
        </div>

        <GoogleContinueButton disabled={loading} onClick={handleGoogleLogin} />

        <div className="relative py-1">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
            or
          </span>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-12"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-12 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-200 bg-red-50 dark:bg-red-950/30 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base"
            disabled={loading}
            size="lg"
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:opacity-90 font-medium">
            Create account
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
