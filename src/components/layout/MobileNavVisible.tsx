"use client";

import { usePathname } from "next/navigation";
import { MobileNav } from "@/components/layout/MobileNav";

export function MobileNavVisible() {
  const pathname = usePathname();
  const isPractice = pathname?.startsWith("/practice");
  const isAuthFlow = pathname === "/signup" || pathname === "/login" || pathname?.startsWith("/onboarding");
  if (isPractice || isAuthFlow) return null;
  return <MobileNav />;
}


