"use client";

import { Suspense, useEffect, useState } from 'react';
import { searchPostsByTitlePrefix } from '@/lib/forum/client';
import type { ForumPost } from '@/lib/types/forum';
import { PostCard } from '@/components/forum/PostCard';
import { useSearchParams } from 'next/navigation';

function ForumSearchInner() {
  const [q, setQ] = useState('');
  const [posts, setPosts] = useState<ForumPost[] | null>(null);
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();

  useEffect(() => {
    const initial = params?.get('q') || '';
    setQ(initial);
    if (initial.trim()) {
      setLoading(true);
      searchPostsByTitlePrefix(initial.trim()).then((r) => setPosts(r)).finally(() => setLoading(false));
    }
  }, [params]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    const r = await searchPostsByTitlePrefix(query);
    setPosts(r);
    setLoading(false);
  };

  return (
    <div>
      <form onSubmit={onSubmit} className="mb-4 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles" className="flex-1 px-3 py-2 rounded-md border bg-background" />
        <button className="px-3 py-2 rounded-md bg-primary text-primary-foreground">Search</button>
      </form>
      {loading && <div className="text-sm text-muted-foreground">Searching...</div>}
      {!!posts && (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ForumSearch() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <ForumSearchInner />
    </Suspense>
  );
}


