"use client";

import { FeedTabs } from '@/components/forum/FeedTabs';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { auth } from '@/lib/firebaseClient';
import { fetchSubscriptions, subscribe, unsubscribe } from '@/lib/forum/client';
import { useSearchParams } from 'next/navigation';

function SubredditLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const slug = (params?.get('slug') || '').trim();
  const [isSub, setIsSub] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const uid = auth?.currentUser?.uid;
    if (!uid || !slug) return;
    fetchSubscriptions(uid).then((subs) => {
      if (!mounted) return;
      setIsSub(subs.includes(slug));
    });
    return () => {
      mounted = false;
    };
  }, [slug]);

  const toggleSub = async () => {
    const uid = auth?.currentUser?.uid;
    if (!uid || !slug) return;
    const prev = isSub;
    setIsSub(!prev);
    setLoading(true);
    try {
      if (prev) await unsubscribe(uid, slug);
      else await subscribe(uid, slug);
    } finally {
      setLoading(false);
    }
  };

  const tabQuery = useMemo(() => (slug ? `slug=${encodeURIComponent(slug)}` : undefined), [slug]);

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">{slug ? `r/${slug}` : 'r/(choose community)'}</div>
          <div className="flex items-center gap-3">
            {auth?.currentUser && slug && (
              <button onClick={toggleSub} disabled={loading} className="text-sm underline disabled:opacity-50">
                {isSub ? 'Unsubscribe' : 'Subscribe'}
              </button>
            )}
            {slug && (
              <Link className="text-sm underline" href={`/forum/submit?r=${encodeURIComponent(slug)}`}>Create post</Link>
            )}
          </div>
        </div>
      </div>
      <FeedTabs basePath="/forum/r" query={tabQuery} />
      {children}
    </div>
  );
}

export default function SubredditLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <SubredditLayoutInner>{children}</SubredditLayoutInner>
    </Suspense>
  );
}


