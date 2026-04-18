"use client";

import { useEffect, useMemo, useState } from 'react';
import { ArrowBigDown, ArrowBigUp, Bookmark, BookmarkCheck, MessageSquare, Share2, Flag, Trash2 } from 'lucide-react';
import type { ForumPost } from '@/lib/types/forum';
import { deletePost, getUserVote, isSaved, savePost, unsavePost, vote, reportContent } from '@/lib/forum/client';
import { auth } from '@/lib/firebaseClient';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  post: ForumPost;
}

export function PostCard({ post }: Props) {
  const [score, setScore] = useState(post.voteScore ?? 0);
  const [isVoting, setIsVoting] = useState(false);
  const [userVote, setUserVote] = useState<1 | -1 | 0>(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletedLocally, setDeletedLocally] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load user's existing vote to enforce single vote and show state
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const uid = auth?.currentUser?.uid;
        if (!uid) return;
        const v = await getUserVote('post', post.id, uid);
        if (!mounted) return;
        if (v === 1 || v === -1) setUserVote(v);
        const [s] = await Promise.all([isSaved(uid, post.id)]);
        if (!mounted) return;
        setSaved(s);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [post.id]);

  const authorLabel = useMemo(() => {
    const username = post.author?.username;
    if (username && username.trim()) return `@${username}`;
    return 'anonymous';
  }, [post.author]);

  const createdAtLabel = useMemo(() => {
    const ts: any = (post as any).createdAt;
    if (!ts) return '';
    if (typeof ts === 'number') return new Date(ts).toLocaleString();
    if (typeof ts === 'string') {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? '' : d.toLocaleString();
    }
    // Firestore Timestamp
    if (typeof ts === 'object' && typeof ts.seconds === 'number') {
      return new Date(ts.seconds * 1000).toLocaleString();
    }
    return '';
  }, [post]);

  const handleVote = async (value: 1 | -1) => {
    if (!auth?.currentUser) return;
    if (isVoting) return;
    setIsVoting(true);
    const prevScore = score;
    const prevUserVote = userVote;

    // same click toggles (undo), different click switches direction
    const isUndo = prevUserVote === value;
    const delta = isUndo ? (0 - value) : (prevUserVote === 0 ? value : (value - prevUserVote));

    setScore((s) => s + (delta as number));
    setUserVote(isUndo ? 0 : value);
    try {
      await vote('post', post.id, auth.currentUser.uid, value);
    } catch {
      setScore(prevScore);
      setUserVote(prevUserVote);
    } finally {
      setIsVoting(false);
    }
  };

  const canDelete = auth?.currentUser?.uid && post.author?.uid === auth.currentUser.uid;

  const handleDelete = async () => {
    if (!auth?.currentUser || !canDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await deletePost(post.id, auth.currentUser.uid);
      setDeletedLocally(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSave = async () => {
    if (!auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    const prev = saved;
    setSaved(!saved);
    try {
      if (prev) await unsavePost(uid, post.id);
      else await savePost(uid, post.id);
    } catch {
      setSaved(prev);
    }
  };

  // hide feature removed

  const handleShare = async () => {
    try {
      const url = `${window.location.origin}/forum/post?id=${encodeURIComponent(post.id)}`;
      if (navigator.share) {
        await navigator.share({ title: post.title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
  };

  const handleReport = async () => {
    try {
      const reason = prompt('Report reason?');
      const uid = auth?.currentUser?.uid;
      if (!uid) return;
      if (!reason) return;
      await reportContent({ targetType: 'post', targetId: post.id, reporterUid: uid, reason });
      alert('Reported. Thank you.');
    } catch {}
  };

  if (deletedLocally) return null;

  return (
    <Card className="flex flex-row items-stretch p-0 gap-0 overflow-hidden">
      <div className="flex flex-col items-center p-2 bg-muted/20 border-r-2 border-border/50 gap-1 min-w-[3.5rem] pt-4">
        <button 
          disabled={isVoting} 
          onClick={() => handleVote(1)} 
          className={cn("p-1 rounded hover:bg-muted transition-colors disabled:opacity-50", userVote === 1 ? 'text-primary' : 'text-muted-foreground hover:text-primary')}
        >
          <ArrowBigUp className={cn("w-6 h-6", userVote === 1 && "fill-current")} />
        </button>
        <div className={cn("text-sm font-bold", userVote === 1 ? "text-primary" : userVote === -1 ? "text-destructive" : "text-foreground")}>
          {score}
        </div>
        <button 
          disabled={isVoting} 
          onClick={() => handleVote(-1)} 
          className={cn("p-1 rounded hover:bg-muted transition-colors disabled:opacity-50", userVote === -1 ? 'text-destructive' : 'text-muted-foreground hover:text-destructive')}
        >
          <ArrowBigDown className={cn("w-6 h-6", userVote === -1 && "fill-current")} />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col p-4 gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {post.subreddit && (
            <Badge variant="secondary" className="hover:bg-secondary/80">
              r/{post.subreddit}
            </Badge>
          )}
          <span className="font-medium text-foreground">{authorLabel}</span>
          <span>•</span>
          <span>{createdAtLabel}</span>
        </div>

        <Link href={`/forum/post?id=${encodeURIComponent(post.id)}`} className="group">
          <h3 className="font-bold text-lg text-foreground leading-tight group-hover:underline decoration-2 decoration-primary/50">
            {post.title}
          </h3>
          {post.body && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
              {post.body}
            </p>
          )}
        </Link>

        <div className="mt-2 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" asChild>
            <Link href={`/forum/post?id=${encodeURIComponent(post.id)}`}>
              <MessageSquare className="w-4 h-4 mr-1.5" />
              {post.commentCount ?? 0} Comments
            </Link>
          </Button>

          <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-1.5" />
            Share
          </Button>
          
          {auth?.currentUser && (
            <>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={toggleSave}>
                {saved ? <BookmarkCheck className="w-4 h-4 mr-1.5 text-primary" /> : <Bookmark className="w-4 h-4 mr-1.5" />}
                {saved ? 'Saved' : 'Save'}
              </Button>
              
              <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={handleReport}>
                <Flag className="w-4 h-4 mr-1.5" />
                Report
              </Button>
            </>
          )}
          
          {canDelete && (
             <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}


