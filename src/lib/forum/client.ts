"use client";

import { app } from '@/lib/firebaseClient';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, increment, limit, onSnapshot, orderBy, query, runTransaction, setDoc, startAfter, updateDoc, where } from 'firebase/firestore';
import type { FeedSort, ForumComment, ForumCommunity, ForumPost, ForumReport, ForumUserSave, ForumUserSubscription, ForumVote, VoteValue } from '@/lib/types/forum';

/**
 * Client-only helpers that talk directly to Firestore. No server actions.
 */

const getDb = () => {
  if (!app) throw new Error('Firebase app not initialized');
  return getFirestore(app);
};

const POSTS = 'forum_posts';
const COMMENTS = 'forum_comments';
const VOTES = 'forum_votes';
const COMMUNITIES = 'forum_communities';
const SUBSCRIPTIONS = 'forum_user_subscriptions';
const SAVES = 'forum_user_saves';
const REPORTS = 'forum_reports';

export function computeHotScore(voteScore: number, createdAt: number): number {
  const order = Math.log10(Math.max(Math.abs(voteScore), 1));
  const seconds = createdAt / 1000;
  return Number((order + seconds / 45000).toFixed(6));
}

export async function fetchFeed(sort: FeedSort, subreddit?: string | null, pageSize = 20) {
  const db = getDb();
  const base = collection(db, POSTS);
  const constraints = [] as any[];
  if (subreddit) constraints.push(where('subreddit', '==', subreddit));

  if (sort === 'new') constraints.push(orderBy('createdAt', 'desc'));
  else if (sort === 'top') constraints.push(orderBy('voteScore', 'desc'));
  else if (sort === 'hot') constraints.push(orderBy('hotScore', 'desc'));
  else constraints.push(orderBy('voteScore', 'desc'));

  constraints.push(limit(pageSize));
  const q = query(base, ...constraints);
  const snap = await getDocs(q);
  const posts: ForumPost[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    posts.push({ id: d.id, ...data } as ForumPost);
  });
  return posts;
}

export async function fetchFeedPaged(params: { sort: FeedSort; subreddit?: string | null; pageSize?: number; cursor?: any }) {
  const { sort, subreddit = null, pageSize = 20, cursor } = params;
  const db = getDb();
  const base = collection(db, POSTS);
  const constraints = [] as any[];
  if (subreddit) constraints.push(where('subreddit', '==', subreddit));
  if (sort === 'new') constraints.push(orderBy('createdAt', 'desc'));
  else if (sort === 'top') constraints.push(orderBy('voteScore', 'desc'));
  else if (sort === 'hot') constraints.push(orderBy('hotScore', 'desc'));
  else constraints.push(orderBy('voteScore', 'desc'));
  constraints.push(limit(pageSize));
  if (cursor) constraints.push(startAfter(cursor));
  const q = query(base, ...constraints);
  const snap = await getDocs(q);
  const posts: ForumPost[] = [];
  snap.forEach((d) => posts.push({ id: d.id, ...(d.data() as any) } as ForumPost));
  const last = snap.docs[snap.docs.length - 1];
  return { items: posts, cursor: last ?? null };
}

export async function createPost(post: Omit<ForumPost, 'id' | 'createdAt' | 'updatedAt' | 'voteScore' | 'commentCount'>) {
  const db = getDb();
  const ref = await addDoc(collection(db, POSTS), {
    ...post,
    voteScore: 0,
    commentCount: 0,
    titleLower: (post.title || '').toLowerCase(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hotScore: computeHotScore(0, Date.now()),
  });
  return ref.id;
}

export async function fetchPostById(postId: string): Promise<ForumPost | null> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, POSTS), where('__name__', '==', postId)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as any) } as ForumPost;
}

export async function fetchComments(postId: string): Promise<ForumComment[]> {
  const db = getDb();
  const q = query(collection(db, COMMENTS), where('postId', '==', postId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  const comments: ForumComment[] = [];
  snap.forEach((d) => comments.push({ id: d.id, ...(d.data() as any) } as ForumComment));
  return comments;
}

export async function addComment(comment: Omit<ForumComment, 'id' | 'createdAt' | 'updatedAt' | 'voteScore'>) {
  const db = getDb();
  const ref = await addDoc(collection(db, COMMENTS), {
    ...comment,
    voteScore: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    path: comment.parentId ? `${comment.parentId}/${Date.now()}` : `root/${Date.now()}`,
  });
  // denormalize
  await updateDoc(doc(db, POSTS, comment.postId), { commentCount: increment(1), updatedAt: Date.now() });
  return ref.id;
}

export async function vote(targetType: 'post' | 'comment', targetId: string, userId: string, value: VoteValue) {
  const db = getDb();
  const voteId = `${userId}_${targetType}_${targetId}`;
  const voteRef = doc(db, VOTES, voteId);
  const targetRef = doc(db, targetType === 'post' ? POSTS : COMMENTS, targetId);

  await runTransaction(db, async (tx) => {
    const voteSnap = await tx.get(voteRef);
    let delta = value;
    if (voteSnap.exists()) {
      const prev = (voteSnap.data() as ForumVote).value;
      if (prev === value) {
        // undo vote
        delta = (0 - prev) as VoteValue;
        tx.delete(voteRef);
      } else {
        // switch vote
        delta = (value - prev) as VoteValue;
        tx.set(voteRef, { id: voteId, userId, targetType, targetId, value, createdAt: Date.now() } as ForumVote);
      }
    } else {
      tx.set(voteRef, { id: voteId, userId, targetType, targetId, value, createdAt: Date.now() } as ForumVote);
    }
    tx.update(targetRef, { voteScore: increment(delta) });
  });
  if (targetType === 'post') {
    const snap = await getDoc(doc(db, POSTS, targetId));
    if (snap.exists()) {
      const p = snap.data() as ForumPost;
      const newScore = computeHotScore(p.voteScore || 0, (p.createdAt as any) as number);
      await updateDoc(doc(db, POSTS, targetId), { hotScore: newScore, updatedAt: Date.now() });
    }
  }
}

export async function getUserVote(targetType: 'post' | 'comment', targetId: string, userId: string): Promise<VoteValue | null> {
  const db = getDb();
  const voteId = `${userId}_${targetType}_${targetId}`;
  const snap = await getDoc(doc(db, VOTES, voteId));
  if (!snap.exists()) return null;
  const data = snap.data() as ForumVote;
  return data.value ?? null;
}

export async function deletePost(postId: string, requesterUid: string): Promise<void> {
  const db = getDb();
  const postRef = doc(db, POSTS, postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) return;
  const post = postSnap.data() as ForumPost;
  const authorUid = (post as any)?.author?.uid;
  if (!authorUid || authorUid !== requesterUid) {
    throw new Error('Not authorized to delete this post');
  }
  // Best-effort delete comments belonging to the post
  const commentsSnap = await getDocs(query(collection(db, COMMENTS), where('postId', '==', postId)));
  await Promise.all(commentsSnap.docs.map((d) => deleteDoc(doc(db, COMMENTS, d.id))));
  await deleteDoc(postRef);
}

export async function deleteComment(commentId: string, postId: string, requesterUid: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COMMENTS, commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const comment = snap.data() as ForumComment;
  const authorUid = (comment as any)?.author?.uid;
  if (!authorUid || authorUid !== requesterUid) {
    throw new Error('Not authorized to delete this comment');
  }
  await deleteDoc(ref);
  await updateDoc(doc(db, POSTS, postId), { commentCount: increment(-1), updatedAt: Date.now() });
}

// Subscriptions
export async function subscribe(uid: string, subreddit: string) {
  const db = getDb();
  const id = `${uid}_${subreddit}`;
  await setDoc(doc(db, SUBSCRIPTIONS, id), { id, uid, subreddit, createdAt: Date.now() } as ForumUserSubscription);
}

export async function unsubscribe(uid: string, subreddit: string) {
  const db = getDb();
  const id = `${uid}_${subreddit}`;
  await deleteDoc(doc(db, SUBSCRIPTIONS, id));
}

export async function fetchSubscriptions(uid: string): Promise<string[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, SUBSCRIPTIONS), where('uid', '==', uid)));
  return snap.docs.map((d) => (d.data() as ForumUserSubscription).subreddit);
}

// Saves / Hides
export async function savePost(uid: string, postId: string) {
  const db = getDb();
  const id = `${uid}_${postId}`;
  await setDoc(doc(db, SAVES, id), { id, uid, postId, createdAt: Date.now() } as ForumUserSave);
}
export async function unsavePost(uid: string, postId: string) {
  const db = getDb();
  const id = `${uid}_${postId}`;
  await deleteDoc(doc(db, SAVES, id));
}
export async function isSaved(uid: string, postId: string): Promise<boolean> {
  const db = getDb();
  const id = `${uid}_${postId}`;
  const snap = await getDoc(doc(db, SAVES, id));
  return snap.exists();
}

// Hide feature removed

// Communities
export async function fetchCommunities(): Promise<ForumCommunity[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, COMMUNITIES));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ForumCommunity));
}
export async function fetchCommunity(slug: string): Promise<ForumCommunity | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, COMMUNITIES, slug));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as ForumCommunity) : null;
}

// Search (title prefix)
export async function searchPostsByTitlePrefix(prefix: string, subreddit?: string | null, pageSize = 25): Promise<ForumPost[]> {
  const db = getDb();
  const base = collection(db, POSTS);
  const start = prefix.toLowerCase();
  const end = start + '\uf8ff';
  const constraints: any[] = [orderBy('titleLower'), where('titleLower', '>=', start), where('titleLower', '<=', end), limit(pageSize)];
  if (subreddit) constraints.push(where('subreddit', '==', subreddit));
  const q = query(base, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ForumPost));
}

// Realtime watchers
export function watchPost(postId: string, cb: (post: ForumPost | null) => void) {
  const db = getDb();
  const ref = doc(db, POSTS, postId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ id: snap.id, ...(snap.data() as any) } as ForumPost);
  });
}

export function watchComments(postId: string, cb: (comments: ForumComment[]) => void) {
  const db = getDb();
  const qy = query(collection(db, COMMENTS), where('postId', '==', postId), orderBy('createdAt', 'asc'));
  return onSnapshot(qy, (snap) => {
    const list: ForumComment[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) } as ForumComment));
    cb(list);
  });
}

// Reports
export async function reportContent(input: Omit<ForumReport, 'id' | 'createdAt'>) {
  const db = getDb();
  await addDoc(collection(db, REPORTS), { ...input, createdAt: Date.now() } as ForumReport);
}

