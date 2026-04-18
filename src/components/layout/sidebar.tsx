"use client";

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { User, signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { CustomAvatar } from '@/components/ui/custom-avatar';
import { getInitials } from '@/lib/constants/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Settings, 
  LayoutDashboard, 
  LogOut,
  ClipboardList,
  Trophy,
  Users,
  Gift,
  Megaphone,
  Bot,
  Calendar,
  History,
  School,
  House
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/firebaseClient';
import { useUser } from '@/lib/context/UserContext';

interface SidebarProps {
  user?: User | null;
  userName?: string | null;
  userUsername?: string | null;
  userAvatarIcon?: string | null;
  userAvatarColor?: string | null;
  tutorName?: string | null;
  asDrawer?: boolean;
}

export function Sidebar({ 
  userName: propUserName, 
  userUsername: propUserUsername, 
  userAvatarIcon: propUserAvatarIcon, 
  userAvatarColor: propUserAvatarColor, 
  tutorName: propTutorName, 
  asDrawer 
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { userData } = useUser();

  // Use context data, falling back to props or defaults
  const tutorName = propTutorName || userData?.tutorName || 'My Tutor';
  const schoolId = userData?.schoolId || null;
  
  const userName = propUserName || userData?.userName || 'User';
  const userUsername = propUserUsername || userData?.userUsername;
  const userAvatarIcon = propUserAvatarIcon || userData?.userAvatarIcon;
  const userAvatarColor = propUserAvatarColor || userData?.userAvatarColor;

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const NavButton = ({ 
    href, 
    icon: Icon, 
    label,
    asAnchor
  }: { 
    href: string; 
    icon: any; 
    label: string; 
    asAnchor?: boolean;
  }) => {
    const isActive = pathname === href;
    const content = (
      <>
        <Icon className={cn("h-5 w-5 shrink-0", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
        <span className={cn("font-bold uppercase tracking-wide text-sm", isActive ? "text-[#1CB0F6]" : "text-muted-foreground")}>
          {label}
        </span>
      </>
    );

    return (
      <Button
        variant="ghost"
        asChild
        className={cn(
          "w-full justify-start gap-3 transition-all duration-200 text-base py-2.5 h-auto",
          "hover:bg-muted/50 border-2 border-transparent",
          isActive 
            ? "bg-[#ddf4ff] dark:bg-[#1CB0F6]/20 text-[#1CB0F6] border-[#1CB0F6]/30 dark:border-[#1CB0F6]/50 hover:bg-[#ddf4ff] dark:hover:bg-[#1CB0F6]/30" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {asAnchor ? <a href={href}>{content}</a> : <Link href={href}>{content}</Link>}
      </Button>
    );
  };

  return (
    <div className={cn(
      asDrawer
        ? "flex md:hidden fixed inset-0 z-50 overflow-hidden bg-background"
        : "hidden md:flex fixed left-4 top-4 bottom-4 z-30 flex-col bg-background border-2 border-border rounded-3xl overflow-hidden w-64"
    )}>
      
      {/* Header section with logo */}
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <Image 
            src="/text-logo.png" 
            alt="CultivatED Logo" 
            width={120} 
            height={40} 
            className="dark:brightness-0 dark:invert" 
            priority
          />
        </div>
      </div>

      {/* Navigation menu section */}
      <div className="flex-1 px-4 py-2 overflow-y-auto no-scrollbar">
        <div className="space-y-2">
          <NavButton href="/dashboard" icon={House} label="Dashboard" asAnchor />
          <NavButton href="/my-tutor" icon={Bot} label={tutorName} asAnchor />
          {schoolId && (
            <NavButton href="/school" icon={School} label="My School" />
          )}
          <NavButton href="/calendar" icon={Calendar} label="Calendar" />
          <NavButton href="/scores" icon={ClipboardList} label="Scores" />
          <NavButton href="/history" icon={History} label="History" />
          <NavButton href="/leaderboard" icon={Trophy} label="Leaderboard" />
          <NavButton href="/friends" icon={Users} label="My Friends" />
          <NavButton href="/forum" icon={Megaphone} label="Forum" />
          <NavButton href="/share" icon={Gift} label="Share CultivatED" />
          <NavButton href="/settings" icon={Settings} label="Settings" />
        </div>
      </div>

      {/* User profile section at bottom */}
      <div className="p-4 border-t-2 border-border">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors">
          <CustomAvatar 
            icon={userAvatarIcon || undefined}
            color={userAvatarColor || undefined}
            fallbackText={getInitials(userName || 'User')}
            size="md"
          />
          
          <div className="flex-1 min-w-0 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">
                {userName || 'User'}
              </p>
              {userUsername && (
                <p className="text-xs text-muted-foreground truncate">
                  @{userUsername}
                </p>
              )}
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-[#FF4B4B] hover:bg-transparent"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Logout</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
