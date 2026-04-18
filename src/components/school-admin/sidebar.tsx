"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  LogOut, 
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebaseClient";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface SchoolAdminSidebarProps {
  role?: string | null;
  asDrawer?: boolean;
}

export function SchoolAdminSidebar({ role, asDrawer }: SchoolAdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      if (auth) {
        await auth.signOut();
        router.replace("/login");
      }
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const NavItem = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const isActive = pathname === href;
    return (
      <Button
        variant="ghost"
        onClick={() => { window.location.href = href; }}
        className={cn(
          "w-full justify-start gap-3 transition-all duration-200 text-base py-2.5 h-auto",
          "hover:bg-muted/50 border-2 border-transparent",
          isActive 
            ? "bg-[#ddf4ff] dark:bg-[#1CB0F6]/20 text-[#1CB0F6] border-[#1CB0F6]/30 dark:border-[#1CB0F6]/50 hover:bg-[#ddf4ff] dark:hover:bg-[#1CB0F6]/30" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className={cn("h-5 w-5 shrink-0", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className={cn("font-bold uppercase tracking-wide text-sm", isActive ? "text-[#1CB0F6]" : "text-muted-foreground")}>
          {label}
        </span>
      </Button>
    );
  };

  return (
    <div className={cn(
      asDrawer
        ? "flex md:hidden fixed inset-0 z-50 overflow-hidden bg-background"
        : "hidden md:flex fixed left-4 top-4 bottom-4 z-30 flex-col bg-background border-2 border-border rounded-3xl overflow-hidden w-64"
    )}>
      <div className="flex items-center justify-between p-6">
        <Link href="/schooladmin" className="flex items-center gap-2">
          <Image src="/text-logo.png" alt="CultivatED" width={120} height={40} className="dark:brightness-0 dark:invert" />
        </Link>
      </div>

      <div className="flex-1 px-4 py-2 overflow-y-auto no-scrollbar">
        <div className="space-y-2">
          <NavItem href="/schooladmin" icon={LayoutDashboard} label="Overview" />
          <NavItem href="/schooladmin/students" icon={Users} label="Students" />
          <NavItem href="/schooladmin/calendar" icon={Calendar} label="Calendar" />
          <NavItem href="/schooladmin/assignments" icon={ClipboardList} label="Assignments" />
          <NavItem href="/schooladmin/reports" icon={FileText} label="Reports" />
          
          {role === "schoolAdmin" && (
            <NavItem href="/schooladmin/staff" icon={Users} label="Staff" />
          )}
        </div>
      </div>

      <div className="p-4 border-t-2 border-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-destructive uppercase font-bold tracking-wide" 
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
