"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/context/UserContext";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "profileCompletionBannerDismissedUntil";
const DISMISS_WINDOW_MS = 1000 * 60 * 60 * 24; // 24 hours

export function ProfileCompletionBanner({ className }: { className?: string }) {
  const router = useRouter();
  const { userData, isLoading } = useUser();
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(DISMISS_KEY) : null;
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts) && ts > Date.now()) setDismissedUntil(ts);
      }
    } catch {
      /* noop */
    }
  }, []);

  if (!mounted) return null;
  if (isLoading) return null;
  if (!userData) return null;

  const needsFullOnboarding = userData.quickOnboardingCompleted && !userData.onboardingCompleted;
  if (!needsFullOnboarding) return null;

  if (dismissedUntil && dismissedUntil > Date.now()) return null;

  const handleDismiss = () => {
    const until = Date.now() + DISMISS_WINDOW_MS;
    try {
      window.localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      /* noop */
    }
    setDismissedUntil(until);
  };

  const handleContinue = () => {
    router.push("/onboarding?resume=1");
  };

  const firstName = (userData.userName || "").split(" ")[0] || "there";

  return (
    <div
      className={cn(
        "relative rounded-2xl border-2 border-border border-b-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 px-4 sm:px-6 py-4 mb-4 shadow-none",
        className
      )}
      role="status"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-semibold text-foreground">
            Finish setting up your tutor, {firstName}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Tell us a few things about your goals and interests so your tutor can personalize sessions. Takes ~3 minutes.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={handleContinue}>
              Personalize my tutor
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Maybe later
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default ProfileCompletionBanner;
