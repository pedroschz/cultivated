"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ForumPost } from '@/lib/types/forum';
import { watchPost } from '@/lib/forum/client';
import { PostCard } from '@/components/forum/PostCard';
import { CommentsThread } from '@/components/forum/CommentsThread';
import Link from 'next/link';

function PostPageInner() {
  const params = useSearchParams();
  const postId = (params?.get('id') || '').trim();
  const [post, setPost] = useState<ForumPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    const unsub = watchPost(postId, (p) => {
      setPost(p);
      setLoading(false);
    });
    return () => unsub();
  }, [postId]);

  const title = useMemo(() => (post?.title ? post.title : 'Post'), [post]);

  if (!postId) return <div className="text-sm text-muted-foreground">Missing post id</div>;
  if (loading) return <div className="text-sm text-muted-foreground">Loading post...</div>;
  if (!post) return <div className="text-sm text-muted-foreground">Post not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold truncate" title={title}>{title}</div>
        <div className="text-sm">
          <Link href="/forum" className="underline">Back to Forum</Link>
        </div>
      </div>
      <PostCard post={post} />
      <CommentsThread postId={post.id} />
    </div>
  );
}

export default function PostPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <PostPageInner />
    </Suspense>
  );
}


