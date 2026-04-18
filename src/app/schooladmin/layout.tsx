"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { SchoolAdminSidebar } from "@/components/school-admin/sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

interface SchoolAdminLayoutProps {
  children: ReactNode;
}

type UserRole = "schoolAdmin" | "teacher" | string;

export default function SchoolAdminLayout({ children }: SchoolAdminLayoutProps) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth as any, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const token = await user.getIdTokenResult(true);
        const r = String((token.claims as any)?.role || "");
        if (!["schoolAdmin", "teacher"].includes(r)) {
          router.replace("/dashboard");
          return;
        }
        setRole(r);
      } catch {
        setRole(null);
      }
    });
    return () => unsubscribe?.();
  }, [router]);

  return (
    <div className="min-h-screen ambient-bg flex">
      {/* Desktop Sidebar */}
      <SchoolAdminSidebar role={role} />

      {/* Main Content Area */}
      <div className="flex-1 md:ml-[280px] flex flex-col min-h-screen transition-all duration-300 ease-in-out">
        
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-4 sticky top-0 z-40">
           <Link href="/schooladmin" className="flex items-center gap-2">
             <Image src="/text-logo.png" alt="CultivatED" width={100} height={30} className="block dark:hidden" />
             <Image src="/text-logo-dark.png" alt="CultivatED" width={100} height={30} className="hidden dark:block" />
           </Link>
           <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
             <Menu className="h-6 w-6" />
           </Button>
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
            <div className="flex justify-end mb-4">
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <Menu className="h-6 w-6" />
              </Button>
            </div>
            <div className="flex flex-col gap-4">
               <Link href="/schooladmin" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Overview</Link>
               <Link href="/schooladmin/students" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Students</Link>
               <Link href="/schooladmin/calendar" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Calendar</Link>
               <Link href="/schooladmin/reports" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Reports</Link>
               {role === 'schoolAdmin' && (
                 <Link href="/schooladmin/assignments" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Assignments</Link>
               )}
            </div>
          </div>
        )}

        <main className="flex-1 p-6 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
