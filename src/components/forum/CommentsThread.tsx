"use client";

import { useEffect, useMemo, useState } from 'react';
import type { ForumComment } from '@/lib/types/forum';
import { addComment, deleteComment, fetchComments, getUserVote, vote, watchComments } from '@/lib/forum/client';
import { auth } from '@/lib/firebaseClient';
import { ArrowBigDown, ArrowBigUp } from 'lucide-react';
import { Trash2 } from 'lucide-react';

interface Props {
  postId: string;
}

export function CommentsThread({ postId }: Props) {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = watchComments(postId, (c) => {
      setComments(c);
      setLoading(false);
    });
    return () => unsub();
  }, [postId]);

  const onSubmit = async () => {
    if (!auth?.currentUser || !input.trim()) return;
    setSubmitting(true);
    const optimistic: ForumComment = {
      id: `optimistic_${Date.now()}`,
      postId,
      body: input.trim(),
      author: { uid: auth.currentUser.uid, name: auth.currentUser.displayName || 'You' },
      voteScore: 0,
      createdAt: Date.now(),
    };
    setComments((c) => [...c, optimistic]);
    setInput('');
    try {
      const id = await addComment({
        postId,
        body: optimistic.body,
        author: optimistic.author,
      });
      setComments((c) => c.map((x) => (x.id === optimistic.id ? { ...optimistic, id } : x)));
    } catch {
      setComments((c) => c.filter((x) => x.id !== optimistic.id));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (commentId: string, value: 1 | -1) => {
    if (!auth?.currentUser) return;
    // Allow switch and undo
    const v = await getUserVote('comment', commentId, auth.currentUser.uid);
    const isUndo = v === value;
    const delta = isUndo ? (0 - value) : (v === null ? value : (value - v));
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, voteScore: c.voteScore + (delta as number) } : c)));
    try {
      await vote('comment', commentId, auth.currentUser.uid, value);
    } catch {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, voteScore: c.voteScore - (delta as number) } : c)));
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!auth?.currentUser) return;
    setDeletingId(commentId);
    try {
      await deleteComment(commentId, postId, auth.currentUser.uid);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading comments...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a comment"
          className="flex-1 px-3 py-2 rounded-md border bg-background"
        />
        <button onClick={onSubmit} disabled={submitting} className="px-3 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">Comment</button>
      </div>
      {comments.map((c) => (
        <div key={c.id} className="flex gap-3">
          <div className="flex flex-col items-center gap-1 pt-1">
            <button onClick={() => handleVote(c.id, 1)} className="p-1 hover:text-primary">
              <ArrowBigUp className="w-4 h-4" />
            </button>
            <div className="text-xs font-semibold">{c.voteScore}</div>
            <button onClick={() => handleVote(c.id, -1)} className="p-1 hover:text-destructive">
              <ArrowBigDown className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1">
            <div className="text-sm">
              <span className="text-muted-foreground mr-2">{c.author.username ? `@${c.author.username}` : c.author.name || 'anonymous'}</span>
              <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
            {auth?.currentUser?.uid && c.author?.uid === auth.currentUser.uid && (
              <div className="mt-1">
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


