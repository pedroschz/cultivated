/**
 * @file Minimal "quick" onboarding that lets a user land on the dashboard
 * after providing just their display name and a unique username. The full
 * onboarding questionnaire (interests, confidence, tutor voice, etc.) can
 * then be completed at any time from a dismissible banner on the dashboard.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loading } from "@/components/ui/loading";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, User as UserIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const USERNAME_RE = /^[a-z0-9.-]+$/;

function validateUsername(username: string): string | null {
  if (!username) return "Pick a username.";
  if (username.length < 3) return "Username must be at least 3 characters.";
  if (username.length > 20) return "Username must be 20 characters or fewer.";
  if (!/[a-z]/.test(username)) return "Include at least one letter.";
  if (!USERNAME_RE.test(username)) return "Lowercase letters, numbers, dots, and dashes only.";
  if (/^[-.]|[-.]$/.test(username)) return "Cannot start or end with a dot or dash.";
  return null;
}

export default function QuickOnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);
      if (!db) {
        setCheckingAuth(false);
        return;
      }
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : null;

        const flagDone = data?.quickOnboardingCompleted === true || data?.onboardingCompleted === true;
        // Legacy accounts may have name+username without the flag ever being written.
        const hasProfile = !!(data?.username && (data?.name || data?.displayName));

        if (flagDone || hasProfile) {
          // Backfill so this redirect never fires for this account again.
          if (hasProfile && !flagDone && db) {
            setDoc(ref, { quickOnboardingCompleted: true }, { merge: true }).catch(() => {});
          }
          window.location.href = "/dashboard";
          return;
        }

        if (data?.name && typeof data.name === "string") setName(data.name);
        if (data?.username && typeof data.username === "string") setUsername(String(data.username).toLowerCase());
      } catch (e) {
        console.warn("[QuickOnboarding] Error reading user doc:", e);
      } finally {
        setCheckingAuth(false);
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    setUsernameError(null);

    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      setUsernameStatus("idle");
      return;
    }
    const formatError = validateUsername(trimmed);
    if (formatError) {
      setUsernameStatus("invalid");
      setUsernameError(formatError);
      return;
    }

    setUsernameStatus("checking");
    checkTimer.current = setTimeout(async () => {
      if (!db) return;
      try {
        const q = query(collection(db, "users_public"), where("username", "==", trimmed));
        const snap = await getDocs(q);
        const takenByOther = snap.docs.some((d) => d.id !== user?.uid);
        setUsernameStatus(takenByOther ? "taken" : "available");
        if (takenByOther) setUsernameError("That username is already taken.");
      } catch (e) {
        console.warn("[QuickOnboarding] Username check failed:", e);
        setUsernameStatus("idle");
      }
    }, 350);

    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [username, user?.uid]);

  const canSubmit =
    !!user &&
    !submitting &&
    name.trim().length >= 1 &&
    usernameStatus === "available";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const usernameIssue = validateUsername(trimmedUsername);

    if (trimmedName.length < 1) {
      setError("Please enter your name.");
      return;
    }
    if (usernameIssue) {
      setError(usernameIssue);
      return;
    }
    if (usernameStatus !== "available") {
      setError("Pick a username that's still available.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const q = query(collection(db, "users_public"), where("username", "==", trimmedUsername));
      const snap = await getDocs(q);
      const takenByOther = snap.docs.some((d) => d.id !== user.uid);
      if (takenByOther) {
        setUsernameStatus("taken");
        setUsernameError("That username was just taken. Try another.");
        setSubmitting(false);
        return;
      }

      const ref = doc(db, "users", user.uid);
      await setDoc(
        ref,
        {
          name: trimmedName,
          displayName: trimmedName,
          username: trimmedUsername,
          quickOnboardingCompleted: true,
          quickOnboardingCompletedAt: new Date(),
        },
        { merge: true },
      );

      try {
        await updateProfile(user, { displayName: trimmedName });
      } catch (e) {
        console.warn("[QuickOnboarding] updateProfile failed:", e);
      }

      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("[QuickOnboarding] Failed to save:", err);
      setError(err?.message || "Something went wrong. Try again.");
      setSubmitting(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-lg"
      >
        <Card>
          <CardContent className="pt-8 pb-8 px-6 md:px-8 space-y-8">
            <div className="text-center space-y-3">
              <h1 className="text-3xl font-bold tracking-tight">Welcome to CultivatED</h1>
              <p className="text-muted-foreground">
                Two quick things and you're in. You can finish the rest whenever.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  What should we call you?
                </label>
                <Input
                  id="name"
                  autoFocus
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-lg py-5 border-2"
                  maxLength={60}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Pick a username
                </label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    className={cn(
                      "text-lg py-5 border-2 font-mono pr-10",
                      usernameStatus === "available" && "border-green-500 focus-visible:ring-green-500",
                      (usernameStatus === "taken" || usernameStatus === "invalid") && "border-red-500 focus-visible:ring-red-500"
                    )}
                    maxLength={20}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === "checking" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    {usernameStatus === "available" && <Check className="w-4 h-4 text-green-600" />}
                  </div>
                </div>
                <p
                  className={cn(
                    "text-xs",
                    usernameError ? "text-red-500" : "text-muted-foreground"
                  )}
                >
                  {usernameError || "Lowercase letters, numbers, dots, and dashes. 3–20 characters."}
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-12 text-base font-medium"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up…
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              You can personalize your tutor and goals from the dashboard.
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
