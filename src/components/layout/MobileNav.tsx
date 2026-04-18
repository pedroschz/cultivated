"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Bot,
  Megaphone,
  Ellipsis,
  Calendar,
  ClipboardList,
  Trophy,
  Gift,
  Settings,
  History,
  LogOut
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);

  const mainItems = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/friends", label: "Friends", icon: Users },
    { href: "/my-tutor", label: "Tutor", icon: Bot },
    { href: "/forum", label: "Forum", icon: Megaphone },
  ] as const;

  const moreItems = useMemo(
    () => [
      { href: "/history", label: "History", icon: History },
      { href: "/scores", label: "Scores", icon: ClipboardList },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/share", label: "Share", icon: Gift },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
    []
  );

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
        window.location.href = '/login';
      }
    } catch (e) {
      // no-op
    } finally {
      setShowMore(false);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* More panel overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-x-0 bottom-16 flex justify-center pointer-events-none">
            <div className="pointer-events-auto w-[92vw] max-w-sm rounded-xl border bg-background shadow-xl p-2">
              <ul className="divide-y">
                {moreItems.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <a
                      href={href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md",
                        isActive(href) ? "text-primary" : "text-foreground hover:bg-muted/40"
                      )}
                      onClick={() => setShowMore(false)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{label}</span>
                    </a>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-foreground hover:bg-muted/40"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">Logout</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="safe-bottom">
        <ul className="grid grid-cols-5">
          {mainItems.map(({ href, label, icon: Icon }) => (
            <li key={href} className="flex">
              <a
                href={href}
                className={cn(
                  "flex-1 h-14 px-2 flex flex-col items-center justify-center text-xs",
                  isActive(href) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive(href) ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="mt-0.5 leading-none">{label}</span>
              </a>
            </li>
          ))}
          {/* More trigger */}
          <li className="flex">
            <button
              type="button"
              className={cn(
                "flex-1 h-14 px-2 flex flex-col items-center justify-center text-xs",
                showMore ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              aria-expanded={showMore}
              onClick={() => setShowMore((v) => !v)}
            >
              <Ellipsis className="h-5 w-5" />
              <span className="mt-0.5 leading-none">More</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}


