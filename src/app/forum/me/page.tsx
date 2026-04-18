"use client";

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebaseClient';
import { collection, getDocs, getFirestore, query, where, doc, getDoc } from 'firebase/firestore';
import type { ForumPost } from '@/lib/types/forum';
import { PostCard } from '@/components/forum/PostCard';

export default function MyContent() {
  const [myPosts, setMyPosts] = useState<ForumPost[]>([]);
  const [bookmarked, setBookmarked] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const uid = auth?.currentUser?.uid;
        if (!uid) {
          setLoading(false);
          return;
        }
        const db = getFirestore();
        // My posts
        const postsQ = query(collection(db, 'forum_posts'), where('author.uid', '==', uid));
        const postsSnap = await getDocs(postsQ);
        const mine: ForumPost[] = postsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ForumPost));

        // My bookmarks (forum_user_saves -> forum_posts)
        const savesSnap = await getDocs(query(collection(db, 'forum_user_saves'), where('uid', '==', uid)));
        const postIds = savesSnap.docs.map((d) => (d.data() as any).postId as string);
        const bookmarkedPosts: ForumPost[] = [];
        for (const pid of postIds) {
          const pSnap = await getDoc(doc(db, 'forum_posts', pid));
          if (pSnap.exists()) bookmarkedPosts.push({ id: pSnap.id, ...(pSnap.data() as any) } as ForumPost);
        }

        if (!mounted) return;
        setMyPosts(mine);
        setBookmarked(bookmarkedPosts);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-lg font-semibold mb-3">My Posts</div>
        {myPosts.length === 0 && <div className="text-sm text-muted-foreground">You haven't posted yet.</div>}
        <div className="space-y-3">
          {myPosts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      </div>
      <div>
        <div className="text-lg font-semibold mb-3">My Bookmarks</div>
        {bookmarked.length === 0 && <div className="text-sm text-muted-foreground">No bookmarks yet.</div>}
        <div className="space-y-3">
          {bookmarked.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      </div>
    </div>
  );
}


