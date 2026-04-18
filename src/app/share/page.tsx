"use client";

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { PageHeader } from '@/components/layout/page-header';
import { auth, app } from '@/lib/firebaseClient';
import { DEFAULT_AVATAR } from '@/lib/constants/avatar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Referral = {
  referredUserId: string;
  referredEmail?: string;
  createdAt?: any;
};

export default function SharePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string | null>(null);
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null);
  const [isSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isUnlimitedReferrerFlag, setIsUnlimitedReferrerFlag] = useState<boolean>(false);
  const [copying, setCopying] = useState(false);

  const UNLIMITED_REFERRER_USERNAME = useMemo(
    () => (process.env.NEXT_PUBLIC_UNLIMITED_REFERRER_USERNAME || '').toLowerCase() || null,
    []
  );

  const referralLink = useMemo(() => {
    if (!user) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    // Prefer username when available; otherwise fall back to uid for backwards compatibility
    const refParam = userUsername || user.uid;
    return `${origin}/signup?ref=${refParam}`;
  }, [user, userUsername]);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
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
            setUserAvatarIcon(data.avatarIcon || DEFAULT_AVATAR.icon);
            setUserAvatarColor(data.avatarColor || DEFAULT_AVATAR.color);
            setIsUnlimitedReferrerFlag(data?.isUnlimitedReferrer === true);
          } else {
            setUserName(u.displayName || 'Valued User');
            setUserUsername(null);
            setUserAvatarIcon(DEFAULT_AVATAR.icon);
            setUserAvatarColor(DEFAULT_AVATAR.color);
            setIsUnlimitedReferrerFlag(false);
          }

          // Load referrals for this user by stored referrerId (uid)
          const referralsQ = query(collection(db, 'referrals'), where('referrerId', '==', u.uid));
          const snapshot = await getDocs(referralsQ);
          const list: Referral[] = snapshot.docs.map(d => ({ ...(d.data() as any) }));
          setReferrals(list);
        } catch {
          setUserName(u.displayName || 'Valued User');
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      setCopying(true);
      await navigator.clipboard.writeText(referralLink);
    } finally {
      setTimeout(() => setCopying(false), 600);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen ambient-bg">
        <Sidebar 
          user={user}
          userName={userName}
          userUsername={userUsername}
          userAvatarIcon={userAvatarIcon}
          userAvatarColor={userAvatarColor}
        />
        <div className={cn(
          'transition-all duration-300 ease-in-out',
          isSidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
        )}>
          <div className="py-6 px-4 md:py-8 md:pr-8 md:pl-14 xl:pl-16">
            <PageHeader title="Share CultivatED" />
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="text-lg text-muted-foreground">Loading…</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  // Determine unlimited: username match or explicit user flag
  const isUnlimited = (UNLIMITED_REFERRER_USERNAME !== null && (userUsername || '').toLowerCase() === UNLIMITED_REFERRER_USERNAME) || isUnlimitedReferrerFlag === true;
  const used = referrals.length;
  const remaining = isUnlimited ? '∞' : Math.max(0, 3 - used);

  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar 
        user={user}
        userName={userName}
        userUsername={userUsername}
        userAvatarIcon={userAvatarIcon}
        userAvatarColor={userAvatarColor}
      />

      <div className={cn(
        'transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
      )}>
        <div className="py-6 px-4 md:py-8 md:pr-8 md:pl-14 xl:pl-16">
          <PageHeader title="Share CultivatED" />
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            <div className="lg:col-span-1">
              <div className="p-6 rounded-lg border bg-card h-full pb-10 md:pb-16 lg:pb-[30%]">
                <div className="text-xl md:text-2xl font-semibold mb-4">Invite your friends</div>
                <div className="text-base md:text-lg text-muted-foreground space-y-4">
                  <p>
                    CultivatED is better with friends. Share your referral link and they&apos;ll
                    automatically be added to your friends list when they sign up.
                  </p>
                  <p>
                    Study together, track each other&apos;s progress, and push each other to improve.
                  </p>
                  <p>
                    - the CultivatED team
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-8">
              <div className="p-6 rounded-lg border bg-card">
                <div className="font-semibold mb-2">Your referral link</div>
                <div className="text-sm text-muted-foreground mb-4">
                  {isUnlimited ? 'Your link has unlimited referrals.' : 'You can invite up to 3 friends.'}
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={referralLink} />
                  <Button onClick={handleCopy} disabled={!referralLink || copying}>
                    {copying ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  Used: {used} • Remaining: {remaining}
                </div>
              </div>

              <div className="p-6 rounded-lg border bg-card">
                <div className="font-semibold mb-2">People who joined with your link</div>
                {referrals.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No signups yet. Share your link to invite friends.</div>
                ) : (
                  <ul className="divide-y">
                    {referrals.map((r, idx) => (
                      <li key={idx} className="py-3 text-sm flex items-center justify-between">
                        <span>{r.referredEmail || r.referredUserId}</span>
                        {/* createdAt is a client Date in our write path; display simple */}
                        <span className="text-muted-foreground">{r.createdAt ? new Date(r.createdAt.toDate ? r.createdAt.toDate() : r.createdAt).toLocaleString() : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

