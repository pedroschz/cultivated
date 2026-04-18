"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import { TutorLiveCoach } from '@/components/voice/TutorLiveCoach';
import { useUser } from '@/lib/context/UserContext';

export default function MyTutorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, isLoading } = useUser();
  const [isSidebarCollapsed] = useState(false);
  const autoStartRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  // Check for autoStart query parameter
  const shouldAutoStart = searchParams?.get('autoStart') === 'true';

  if (isLoading) {
    return (
      <div className="min-h-screen ambient-bg">
        <Sidebar />
        <div className={cn(
          'transition-all duration-300 ease-in-out',
          isSidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
        )}>
          <div className="py-6 px-4 md:py-8 md:pr-8 md:pl-14 xl:pl-16">
            <PageHeader title={userData?.tutorName || 'My Tutor'} />
            <div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const tutorName = userData?.tutorName || 'My Tutor';
  const tutorVoice = userData?.tutorVoice;

  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar />

      <div className={cn(
        'transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
      )}>
        <div className="py-6 px-4 md:py-8 md:pr-8 md:pl-14 xl:pl-16">
          <PageHeader title={tutorName} />
          <div className="mt-10">
            <TutorLiveCoach 
              userId={user.uid} 
              displayName={userData?.userName || 'Student'} 
              tutorName={tutorName} 
              tutorVoice={tutorVoice}
              autoStart={shouldAutoStart}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
