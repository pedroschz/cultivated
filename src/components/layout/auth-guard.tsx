"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

/**
 * Global client-side auth guard.
 * - Redirects unauthenticated users to `/login`, allowing only `/login` and `/signup`.
 * - Redirects authenticated users away from `/login` and `/signup` to `/dashboard`.
 * Mount this once in the root layout so it runs for all routes.
 */
export function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Only treat /login, /signup, and legacy /join as auth/public pages (support trailing slashes/queries)
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/join");

  // Onboarding page - accessible to authenticated users who haven't completed onboarding
  const isOnboardingPage = pathname.startsWith("/onboarding");

  // Public landing page should be accessible when unauthenticated
  const isPublicLanding = pathname === "/" || pathname === "/demo" || pathname === "/schools";

  // Shared pages accessible by everyone (authenticated or not)
  const isSharedPage = pathname.startsWith("/blog");

  useEffect(() => {
    // SHARED PAGES & LANDING: allow everyone (authenticated or not)
    if (isSharedPage || isPublicLanding) {
      return;
    }

    // AUTH PAGES: allow unauthenticated users; redirect authenticated users to dashboard
    if (isAuthPage) {

      if (!auth) {
        return;
      }

      const unsubscribe = onAuthStateChanged(auth as any, async (user) => {
        if (user) {
          (async () => {
            try {
              const idTokenResult = await (user as any).getIdTokenResult(true);
              const claims = (idTokenResult && idTokenResult.claims) || {};
              const role = String(claims.role || '').toLowerCase();
              if (role === 'schooladmin' || role === 'teacher') {
                window.location.href = '/schooladmin';
              } else {
                // Users only need the minimal "quick" onboarding (name + username)
                // to reach the dashboard. The full profile questionnaire lives on
                // /onboarding and can be completed later from a dashboard banner.
                if (db) {
                  try {
                    const userRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userRef);
                    const data = userDoc.exists() ? userDoc.data() : null;
                    const quickDone = data?.quickOnboardingCompleted === true || data?.onboardingCompleted === true;

                    if (!quickDone) {
                      window.location.href = '/onboarding/quick';
                      return;
                    }
                  } catch (e) {
                    console.warn('[AuthGuard] Error checking onboarding on auth page:', e);
                  }
                }
                window.location.href = '/dashboard';
              }
            } catch (e) {
              window.location.href = '/dashboard';
            }
          })();
        } else {
          console.log(`[AuthGuard] No user on auth page (${pathname}). Staying.`);
        }
      });

      return () => {
        unsubscribe?.();
      };
    }

    // PROTECTED PAGES: redirect unauthenticated users to /login

    const timeoutMs = process.env.NODE_ENV === "production" ? 5000 : 3000;
    const retryMs = process.env.NODE_ENV === "production" ? 2000 : 100;

    const timeoutId = setTimeout(() => {
      if (!isFirebaseReady) {
        setHasTimedOut(true);
        console.warn(`[AuthGuard] Firebase initialization timed out after ${timeoutMs}ms on ${pathname}. Allowing render to prevent blocking.`);
      }
    }, timeoutMs);

    const checkFirebaseAndAuth = () => {
      if (!auth) {
        setTimeout(checkFirebaseAndAuth, retryMs);
        return;
      }

      setIsFirebaseReady(true);
      clearTimeout(timeoutId);

      const unsubscribe = onAuthStateChanged(auth as any, async (user) => {
        if (!user) {
          router.replace("/login");
        } else {
          // Check if user has completed onboarding (skip for schooladmin/teacher roles)
          try {
            const idTokenResult = await (user as any).getIdTokenResult(true);
            const claims = (idTokenResult && idTokenResult.claims) || {};
            const role = String(claims.role || '').toLowerCase();
            
            // School admins and teachers bypass onboarding check
            if (role === 'schooladmin' || role === 'teacher') {
              console.log(`[AuthGuard] User authenticated (${role}). Staying on ${pathname}.`);
              return;
            }
          } catch (e) {
            console.warn('[AuthGuard] Failed to get token claims:', e);
          }

          // For regular users, check that the minimal ("quick") onboarding is
          // done. The extended onboarding can be completed later via banners.
          if (db) {
            try {
              const userRef = doc(db, 'users', user.uid);
              const userDoc = await getDoc(userRef);
              const data = userDoc.exists() ? userDoc.data() : null;

              const quickOnboardingCompleted =
                data?.quickOnboardingCompleted === true || data?.onboardingCompleted === true;
              const onboardingCompleted = data?.onboardingCompleted === true;

              const isQuickOnboardingPage = pathname.startsWith('/onboarding/quick');
              const isFullOnboardingPage = isOnboardingPage && !isQuickOnboardingPage;

              // Not past the quick gate yet → force them to the quick onboarding
              if (!quickOnboardingCompleted && !isQuickOnboardingPage) {
                console.log('[AuthGuard] User has not completed quick onboarding. Redirecting to /onboarding/quick');
                window.location.href = '/onboarding/quick';
                return;
              }

              // Already past the quick gate → don't keep them on the quick page
              if (quickOnboardingCompleted && isQuickOnboardingPage) {
                console.log('[AuthGuard] Quick onboarding already completed. Redirecting to /dashboard');
                window.location.href = '/dashboard';
                return;
              }

              // Already finished the full questionnaire → bounce off the
              // extended onboarding page, since it would otherwise reset state
              if (onboardingCompleted && isFullOnboardingPage) {
                console.log('[AuthGuard] Full onboarding already completed. Redirecting to /dashboard');
                window.location.href = '/dashboard';
                return;
              }

              console.log(`[AuthGuard] User authenticated. Staying on ${pathname}.`);
            } catch (e) {
              console.error('[AuthGuard] Error checking onboarding status:', e);
              // On error, allow access (fail open)
            }
          }
        }
      });

      return unsubscribe;
    };

    const unsubscribe = checkFirebaseAndAuth();

    return () => {
      clearTimeout(timeoutId);
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [pathname, router, isAuthPage, isOnboardingPage, isPublicLanding, isSharedPage, isFirebaseReady]);

  // RENDERING RULES
  if (isAuthPage || isOnboardingPage || isPublicLanding || isSharedPage) {
    return null;
  }

  if (!isFirebaseReady && !hasTimedOut) {
    return null;
  }

  return null;
}
