/**
 * @file This file implements the user registration page.
 * Signup is open to everyone. An optional referral link (?ref=<username>)
 * attributes the signup and auto-friends the new user with the referrer.
 */
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { auth, app, db as clientFirestore, labsDb } from "@/lib/firebaseClient";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, addDoc, getDoc, getDocs, query, where, limit, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { GoogleContinueButton } from "@/components/auth/GoogleContinueButton";
import { Separator } from "@/components/ui/separator";
import { enforceLabsExclusion } from "@/lib/auth/labsUserGuard";
import { finalizeWebLoginRedirect } from "@/lib/auth/finalizeWebLoginRedirect";
import { getGoogleAuthProvider } from "@/lib/auth/googleAuthProvider";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center ambient-bg px-4"><div className="text-sm text-muted-foreground">Loading…</div></div>}>
      <SignUpInner />
    </Suspense>
  );
}

function SignUpInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [referrerUsername, setReferrerUsername] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [referrerType, setReferrerType] = useState<'user' | 'school' | null>(null);
  const [adminCode, setAdminCode] = useState<string | null>(null);
  const [adminValid, setAdminValid] = useState<boolean>(false);
  const [adminChecking, setAdminChecking] = useState<boolean>(false);
  const [referralAllowed, setReferralAllowed] = useState<boolean | null>(null);
  const [referralChecking, setReferralChecking] = useState<boolean>(true);
  const [schoolIdFromSlug, setSchoolIdFromSlug] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const teacherToken = searchParams?.get("teacherToken");
  const [teacherTokenState, setTeacherTokenState] = useState<string | null>(teacherToken);

  // Prefetch onboarding page (guaranteed destination after signup)
  useEffect(() => {
    router.prefetch('/onboarding/quick');
    router.prefetch('/schooladmin'); // Also prefetch for teacher invites
  }, [router]);

  useEffect(() => {
    // Fallback for static deployments where Next's useSearchParams may not include
    // query params on first render. Read from window.location.search if needed.
    try {
      if (!teacherTokenState && typeof window !== 'undefined') {
        const p = new URLSearchParams(window.location.search || '');
        const t = p.get('teacherToken');
        if (t) setTeacherTokenState(t);
      }
    } catch {}
  }, [teacherTokenState]);

  // Debug logs to help trace token and invite state on deployed site
  useEffect(() => {
    try {
      console.log('[SignupDebug] searchParamsTeacherToken=', teacherToken);
      console.log('[SignupDebug] teacherTokenState=', teacherTokenState);
      if (typeof window !== 'undefined') console.log('[SignupDebug] window.search=', window.location.search);
      console.log('[SignupDebug] referrerId=', referrerId, 'referrerType=', referrerType, 'referralAllowed=', referralAllowed, 'adminValid=', adminValid);
      console.log('[SignupDebug] hasReferral=', Boolean(referrerId) || adminValid || referrerType === 'school' || Boolean(teacherTokenState));
    } catch (e) {
      console.warn('[SignupDebug] logging failed', e);
    }
  }, [teacherToken, teacherTokenState, referrerId, referrerType, referralAllowed, adminValid]);

  // Keep local state in sync if Next.js updates search params after hydration
  useEffect(() => {
    if (teacherToken && teacherToken !== teacherTokenState) {
      setTeacherTokenState(teacherToken);
    }
  }, [teacherToken, teacherTokenState]);

  const UNLIMITED_REFERRER_USERNAME = useMemo(
    () => (process.env.NEXT_PUBLIC_UNLIMITED_REFERRER_USERNAME || "").toLowerCase() || null,
    []
  );

  const hasReferral = Boolean(referrerId) || adminValid || referrerType === 'school' || Boolean(teacherTokenState);
  const isCheckingInvite = referralChecking || adminChecking;

  useEffect(() => {
    const ref = searchParams?.get("ref");
    const admin = searchParams?.get("admin");
    setReferrerUsername(ref);
    setAdminCode(admin ? String(admin) : null);

    const checkReferral = async () => {
      setReferralChecking(true);
      // validate admin code if present (use local flag to avoid relying on state update timing)
      let adminIsValidLocal = false;
      if (admin) {
        setAdminChecking(true);
        try {
          const db = getFirestore();
          const invDoc = await getDoc(doc(db, 'schoolInvites', String(admin).trim().toUpperCase())).catch(() => null);
          if (invDoc && invDoc.exists()) {
            const inv = invDoc.data() as any;
            adminIsValidLocal = (inv.active !== false && (!inv.expiresAt || Date.now() <= Number(inv.expiresAt || 0)));
          }
        } catch (e) { adminIsValidLocal = false; }
        setAdminValid(adminIsValidLocal);
        setAdminChecking(false);
      }
      // If admin code is present and valid, treat invite as allowed (skip referrer checks)
      if (admin && adminIsValidLocal) {
        setReferralAllowed(true);
        // keep referrer display as school slug for context
        setReferrerId(null);
        setReferrerName(null);
        setReferrerUsername(ref || null);
        setReferralChecking(false);
        return;
      }
      try {
        if (!ref) {
          // allow signup if admin invite is valid
          if (admin) return;
          setReferralAllowed(null);
          return;
        }

        // 1. Try resolving as a User Referral via Cloud Function (bypasses auth rules)
        let isUserReferral = false;
        try {
          console.log('[SignupDebug] Calling checkReferralCallable with ref=', ref);
          const fns = getFunctions(app as any, 'us-central1');
          const checkFn = httpsCallable(fns, 'checkReferralCallable');
          const res = await checkFn({ ref });
          const data = res.data as any;
          console.log('[SignupDebug] checkReferralCallable result=', data);
          
          if (data.found) {
            isUserReferral = true;
            setReferrerId(data.referrerId);
            setReferrerName(data.referrerName || "a CultivatED user");
            setReferrerUsername(ref);
            setReferrerType('user');
            setReferralAllowed(data.allowed);
            setReferralChecking(false);
            return;
          }
        } catch (err) {
          console.warn('Referral check via function failed, falling back to direct query', err);
          // NOTE: We don't return here, we proceed to check if it's a school
        }

        // 2. If not a user, check if it's a School by slug (public read allowed)
        const db = getFirestore();
        try {
          const schoolQ = query(collection(db, 'schools'), where('slug', '==', ref), limit(1));
          const schoolSnap = await getDocs(schoolQ);
          if (!schoolSnap.empty) {
            const schoolDoc = schoolSnap.docs[0];
            const sdata = schoolDoc.data() as any;
            setReferrerId(null);
            setReferrerName(String(sdata?.name || ref));
            setReferrerUsername(ref);
            setReferrerType('school');
            setSchoolIdFromSlug(String(schoolDoc.id));
            setReferralAllowed(true);
            return;
          }
        } catch (schoolErr) {
           console.warn('School lookup failed', schoolErr);
        }

        // If neither found, we stop here. We do NOT fall back to the restricted direct user query
        if (!isUserReferral) {
            console.log('[SignupDebug] Referral check finished. Allowed:', referralAllowed);
            setReferralAllowed(false);
            setReferrerName(null);
            setReferrerId(null);
            setReferrerType(null);
            setSchoolIdFromSlug(null);
        }
      } catch (e) {
        console.error("Error checking referral:", e);
        setReferralAllowed(false);
      } finally {
        setReferralChecking(false);
      }
    };

    checkReferral();
  }, [searchParams, UNLIMITED_REFERRER_USERNAME]);

  const finalizeProfileForNewUser = async (user: User, firestore: Firestore) => {
    await setDoc(doc(firestore, "users", user.uid), {
      email: user.email,
      createdAt: new Date(),
      referrerId: referrerId || null,
      referrerUsername: referrerUsername || null,
      flags: {
        hasSeenFirstWrongAnswerTutorial: false,
        hasStartedPractice: false,
        hasCompletedFirstSession: false,
        hasSeenCalculatorTip: false,
        hasSeenRWAnnotatorTip: false,
        showFirstSessionComplete: false,
      },
    });

    if (referrerId) {
      await addDoc(collection(firestore, "referrals"), {
        referrerId,
        referredUserId: user.uid,
        referredEmail: user.email,
        createdAt: new Date(),
      });

      try {
        const fns = getFunctions(app as any, "us-central1");
        const addMutual = httpsCallable(fns, "addMutualFriendship");
        await addMutual({ otherUid: referrerId });
      } catch (e) {
        console.warn("Failed to auto-establish friendship on signup:", e);
      }
    }

    try {
      if (teacherTokenState) {
        console.log("[SignupDebug] attempting acceptTeacherInvite with token=", teacherTokenState);
        const fns = getFunctions(app as any, "us-central1");
        const acceptTeacherInvite = httpsCallable(fns, "acceptTeacherInviteCallable");
        await acceptTeacherInvite({ token: teacherTokenState });
        await user.getIdToken(true);

        const userRef = doc(firestore, "users", user.uid);
        await updateDoc(userRef, { onboardingCompleted: true });

        console.log("[SignupDebug] acceptTeacherInvite succeeded; redirecting to /schooladmin");
        router.push("/schooladmin");
        return;
      }
    } catch (e: any) {
      console.error("[SignupDebug] Teacher invite acceptance failed:", e?.message || e);
    }

    try {
      if (adminCode && adminValid) {
        const fns = getFunctions(app as any, "us-central1");
        const redeem = httpsCallable(fns, "redeemSchoolInviteCallable");
        await redeem({ code: adminCode });
        await user.getIdToken(true);
        router.push("/schooladmin");
        return;
      }
    } catch (e: any) {
      console.warn("Admin invite redemption failed:", e?.message || e);
    }

    try {
      if (referrerType === "school" && schoolIdFromSlug) {
        const userRefDoc = doc(firestore, "users", user.uid);
        await setDoc(
          userRefDoc,
          {
            schoolId: schoolIdFromSlug,
            role: "student",
            schoolName: referrerName || null,
          } as Record<string, unknown>,
          { merge: true },
        );
      }
    } catch (e) {
      console.warn("Failed to link school by slug on signup:", e);
    }

    router.push("/onboarding/quick");
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setLoading(true);

    if (!auth || !app || !clientFirestore) {
      setError("Firebase is not initialized. Check your firebaseClient.ts configuration.");
      setLoading(false);
      return;
    }

    if (referrerUsername && referralAllowed === false) {
      setError("This referral link has reached its limit.");
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

      const userRef = doc(clientFirestore, "users", user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        await finalizeWebLoginRedirect({
          app,
          db: clientFirestore,
          user,
          teacherToken: teacherTokenState,
        });
        return;
      }

      await finalizeProfileForNewUser(user, clientFirestore);
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError(null);
      } else {
        console.error("Google sign-up error:", err);
        const message = err instanceof Error ? err.message : "Google sign-up failed. Please try again.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!auth || !app || !clientFirestore) {
      setError("Firebase is not initialized. Check your firebaseClient.ts configuration.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      if (referrerUsername && referralAllowed === false) {
        setError("This referral link has reached its limit.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        await finalizeProfileForNewUser(user, clientFirestore);
      }
    } catch (err: any) {
      // Handle Firebase errors
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            setError('This email address is already in use.');
            break;
          case 'auth/invalid-email':
            setError('The email address is not valid.');
            break;
          case 'auth/operation-not-allowed':
            setError('Email/password accounts are not enabled.');
            break;
          case 'auth/weak-password':
            setError('The password is too weak.');
            break;
          default:
            setError("An error occurred during sign up. Please try again.");
        }
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
      console.error("Signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout 
       >
      <div className="space-y-6">
        <div className="space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-bold font-display">Create an account</h1>
          
          {isCheckingInvite ? (
            <p className="text-muted-foreground">Checking invite…</p>
          ) : teacherTokenState ? (
            <p className="text-muted-foreground">You&apos;re joining via a teacher invite. Create an account to activate teacher access.</p>
          ) : adminValid ? (
            <p className="text-muted-foreground">You&apos;re joining via an admin invite. Create an account to activate school admin access.</p>
          ) : referralAllowed ? (
            <p className="text-muted-foreground">You&apos;re joining via an invite from {referrerName || 'a CultivatED user'}.</p>
          ) : (
            <p className="text-muted-foreground">Sign up to start learning with CultivatED.</p>
          )}
        </div>

        {isCheckingInvite ? (
          <div className="text-center text-sm text-muted-foreground py-8">Checking invite…</div>
        ) : (
          <>
            <GoogleContinueButton
              disabled={loading}
              label="Sign up with Google"
              onClick={handleGoogleSignUp}
            />

            <div className="relative py-1">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
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
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  className="h-12 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  {showConfirmPassword ? (
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
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
          </>
        )}

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:opacity-90 font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
