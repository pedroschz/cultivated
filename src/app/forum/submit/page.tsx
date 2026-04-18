"use client";

import { Suspense, useEffect, useState } from 'react';
import { createPost, fetchCommunities } from '@/lib/forum/client';
import { auth } from '@/lib/firebaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ForumCommunity } from '@/lib/types/forum';

function SubmitPostInner() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [subreddit, setSubreddit] = useState('');
  const [communities, setCommunities] = useState<ForumCommunity[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const sr = params?.get('r');
    if (sr) setSubreddit(sr);
  }, [params]);

  useEffect(() => {
    let mounted = true;
    fetchCommunities().then((list) => {
      if (!mounted) return;
      setCommunities(list);
    }).catch(() => setCommunities([]));
    return () => { mounted = false; };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.currentUser || !title.trim()) return;
    setSubmitting(true);
    try {
      const id = await createPost({
        title: title.trim(),
        body: body.trim() || undefined,
        subreddit: subreddit || null,
        author: {
          uid: auth.currentUser.uid,
          name: auth.currentUser.displayName || 'You',
        },
      });
      router.push(`/forum/post?id=${encodeURIComponent(id)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full px-3 py-2 rounded-md border bg-background"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Text (optional)"
        rows={8}
        className="w-full px-3 py-2 rounded-md border bg-background"
      />
      <div>
        <label className="block text-sm mb-1">Community</label>
        <select
          value={subreddit}
          onChange={(e) => setSubreddit(e.target.value)}
          className="w-full px-3 py-2 rounded-md border bg-background"
        >
          <option value="">All</option>
          {communities?.map((c) => (
            <option key={c.id} value={c.id}>r/{c.id}</option>
          ))}
        </select>
      </div>
      <button disabled={submitting} className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">Submit</button>
    </form>
  );
}

export default function SubmitPost() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <SubmitPostInner />
    </Suspense>
  );
}

 