"use client";

import { Sidebar } from '@/components/layout/sidebar';
import { PageHeader } from '@/components/layout/page-header';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { auth, app } from '@/lib/firebaseClient';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { SearchInline } from '@/components/forum/SearchInline';
import { Button } from '@/components/ui/button';
import { Plus, Home, User as UserIcon } from 'lucide-react';

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string | null>(null);
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null);
  const [isSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const isPostPage = !!(pathname && pathname.startsWith('/forum/post'));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth!, async (u) => {
      setUser(u);
      if (u && app) {
        try {
          const db = getFirestore(app);
          const userRef = doc(db, 'users', u.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            setUserName(data.name || u.displayName || 'Valued User');
            setUserUsername(data.username || null);
            setUserAvatarIcon(data.avatarIcon || null);
            setUserAvatarColor(data.avatarColor || null);
          } else {
            setUserName(u.displayName || 'Valued User');
          }
        } catch {
          setUserName(u.displayName || 'Valued User');
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar 
        user={user}
        userName={userName}
        userUsername={userUsername}
        userAvatarIcon={userAvatarIcon}
        userAvatarColor={userAvatarColor}
      />
      <div className={cn('transition-all duration-300 ease-in-out', isSidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64')}>
        <div className="py-6 px-4 md:py-8 md:pr-8 md:pl-14 xl:pl-16">
          {!isPostPage && (
            <PageHeader title="Forum">
              <div className="flex flex-wrap items-center gap-2">
                <SearchInline />
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/forum">
                    <Home className="w-4 h-4 mr-2" />
                    Home
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/forum/me">
                    <UserIcon className="w-4 h-4 mr-2" />
                    My Posts
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/forum/submit">
                    <Plus className="w-4 h-4 mr-2" />
                    New Post
                  </Link>
                </Button>
              </div>
            </PageHeader>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}


