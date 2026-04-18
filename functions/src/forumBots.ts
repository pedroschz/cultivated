import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

type ForumBot = {
  id: string;
  name: string;
  username: string;
  persona: string;
  style: string;
  topics: string[];
  avatarIcon?: string | null;
  avatarColor?: string | null;
  createdAt?: number;
  updatedAt?: number;
};

type ForumPostLite = {
  id: string;
  title: string;
  body?: string | null;
  subreddit?: string | null;
  voteScore?: number;
  commentCount?: number;
  createdAt?: number;
  author?: {
    uid?: string;
    username?: string | null;
    name?: string | null;
    isBot?: boolean;
    botId?: string | null;
  };
  isBot?: boolean;
  botId?: string | null;
};

type ForumCommentLite = {
  id: string;
  postId: string;
  body: string;
  createdAt?: number;
  author?: {
    uid?: string;
    username?: string | null;
    name?: string | null;
    isBot?: boolean;
    botId?: string | null;
  };
  isBot?: boolean;
  botId?: string | null;
};

type ForumAction =
  | { action: 'skip'; botId: string }
  | { action: 'post'; botId: string; title: string; body?: string | null; subreddit?: string | null }
  | { action: 'comment'; botId: string; targetId: string; comment: string }
  | { action: 'upvote' | 'downvote'; botId: string; targetType: 'post' | 'comment'; targetId: string };

type BotJobContext = {
  jobId?: string | null;
  triggerType?: 'post' | 'comment';
  triggerId?: string | null;
  triggerPostId?: string | null;
  triggerIsBot?: boolean;
  triggerSubreddit?: string | null;
};

type ForumBotSettings = {
  enabled: boolean;
  minMinutesBetweenRuns: number;
  minMinutesBetweenJobs: number;
  maxActionsPerRun: number;
  maxJobsPerRun: number;
  maxDailyActions: number;
  lockTtlMinutes: number;
  maxCandidatePosts: number;
  maxCandidateComments: number;
  maxPostAgeDays: number;
  maxCommentAgeDays: number;
  maxTitleChars: number;
  maxBodyChars: number;
  maxCommentChars: number;
  postProbability: number;
  commentProbability: number;
  voteProbability: number;
  downvoteProbability: number;
  model: string;
};

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const SCHEDULE_TZ = defineString('TIME_ZONE');

const FORUM_POSTS = 'forum_posts';
const FORUM_COMMENTS = 'forum_comments';
const FORUM_VOTES = 'forum_votes';
const FORUM_COMMUNITIES = 'forum_communities';
const FORUM_BOTS = 'forum_bots';
const FORUM_BOT_SETTINGS = 'forum_bot_settings';
const FORUM_BOT_STATE = 'forum_bot_state';
const FORUM_BOT_JOBS = 'forum_bot_jobs';
const FORUM_BOT_ACTIONS = 'forum_bot_actions';

const DEFAULT_SETTINGS: ForumBotSettings = {
  enabled: true,
  minMinutesBetweenRuns: 0,
  minMinutesBetweenJobs: 0,
  maxActionsPerRun: 2,
  maxJobsPerRun: 1,
  maxDailyActions: 18,
  lockTtlMinutes: 9,
  maxCandidatePosts: 12,
  maxCandidateComments: 10,
  maxPostAgeDays: 30,
  maxCommentAgeDays: 14,
  maxTitleChars: 90,
  maxBodyChars: 600,
  maxCommentChars: 360,
  postProbability: 0.25,
  commentProbability: 0.45,
  voteProbability: 0.85,
  downvoteProbability: 0.15,
  model: 'gemini-2.0-flash', // Default model as of 2026
};

const DEFAULT_BOTS: ForumBot[] = [
  { id: 'bot_01', name: 'Nova Chen', username: 'nova', persona: 'curious high-achiever who loves sharing study tips and quick wins', style: 'energetic, concise, practical', topics: ['study habits', 'SAT strategy', 'time management'], avatarIcon: 'sparkles', avatarColor: '#f59e0b' },
  { id: 'bot_02', name: 'Eli Park', username: 'eli', persona: 'calm explainer who breaks down tricky math ideas', style: 'calm, step-by-step, reassuring', topics: ['math', 'algebra', 'geometry'], avatarIcon: 'calculator', avatarColor: '#3b82f6' },
  { id: 'bot_03', name: 'Maya Ortiz', username: 'maya', persona: 'empathetic mentor who encourages students who feel stuck', style: 'warm, supportive, motivating', topics: ['motivation', 'confidence', 'stress'], avatarIcon: 'heart', avatarColor: '#f97316' },
  { id: 'bot_04', name: 'Ravi Singh', username: 'ravi', persona: 'data-minded optimizer who loves measurable progress', style: 'analytical, bullet-pointed', topics: ['practice plans', 'tracking progress', 'analytics'], avatarIcon: 'bar-chart', avatarColor: '#10b981' },
  { id: 'bot_05', name: 'Lena Brooks', username: 'lena', persona: 'reading and writing nerd who spots patterns in passages', style: 'insightful, precise, friendly', topics: ['reading', 'writing', 'grammar'], avatarIcon: 'book-open', avatarColor: '#6366f1' },
  { id: 'bot_06', name: 'Omar Diaz', username: 'omar', persona: 'low-key comedian who keeps the vibe light', style: 'playful, brief, upbeat', topics: ['mindset', 'study breaks', 'routine'], avatarIcon: 'smile', avatarColor: '#f43f5e' },
  { id: 'bot_07', name: 'Priya Nair', username: 'priya', persona: 'organized planner who builds routines and checklists', style: 'structured, practical', topics: ['planning', 'checklists', 'weekly goals'], avatarIcon: 'check-square', avatarColor: '#0ea5e9' },
  { id: 'bot_08', name: 'Theo Grant', username: 'theo', persona: 'test-day strategist who focuses on pacing and stamina', style: 'direct, tactical', topics: ['test day', 'pacing', 'strategy'], avatarIcon: 'timer', avatarColor: '#14b8a6' },
  { id: 'bot_09', name: 'Zara Malik', username: 'zara', persona: 'creative explainer who uses analogies to make concepts stick', style: 'creative, vivid, short', topics: ['conceptual math', 'analogies', 'memory'], avatarIcon: 'lightbulb', avatarColor: '#a855f7' },
  { id: 'bot_10', name: 'Cole Rivers', username: 'cole', persona: 'no-nonsense coach who pushes for consistency', style: 'firm, encouraging, concise', topics: ['consistency', 'habits', 'discipline'], avatarIcon: 'flag', avatarColor: '#16a34a' },
  { id: 'bot_11', name: 'Jules Carter', username: 'jules', persona: 'experimental learner who tries new tools and techniques', style: 'curious, exploratory', topics: ['study tools', 'techniques', 'experiments'], avatarIcon: 'flask', avatarColor: '#0f766e' },
  { id: 'bot_12', name: 'Ari Kim', username: 'ari', persona: 'minimalist helper who keeps advice simple', style: 'minimal, gentle, clear', topics: ['focus', 'simplifying', 'clarity'], avatarIcon: 'dot', avatarColor: '#6b7280' },
  { id: 'bot_13', name: 'Sana Qureshi', username: 'sana', persona: 'supportive peer who shares realistic expectations', style: 'honest, supportive', topics: ['balance', 'realistic goals', 'wellness'], avatarIcon: 'sun', avatarColor: '#f59e0b' },
  { id: 'bot_14', name: 'Miles Reed', username: 'miles', persona: 'quick math-checker who loves shortcuts', style: 'fast, crisp', topics: ['math shortcuts', 'estimation', 'number sense'], avatarIcon: 'zap', avatarColor: '#ef4444' },
  { id: 'bot_15', name: 'Nina Patel', username: 'nina', persona: 'detail-oriented editor who corrects tiny grammar slips', style: 'polite, precise', topics: ['grammar', 'editing', 'style'], avatarIcon: 'edit-3', avatarColor: '#8b5cf6' },
];

function getTimeZone(): string {
  const tz = SCHEDULE_TZ.value();
  return tz && tz.trim().length > 0 ? tz : 'Etc/UTC';
}

function computeHotScore(voteScore: number, createdAtMs: number): number {
  const order = Math.log10(Math.max(Math.abs(voteScore), 1));
  const seconds = createdAtMs / 1000;
  return Number((order + seconds / 45000).toFixed(6));
}

function dayKeyUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function clampText(input: string, maxLen: number): string {
  const trimmed = input.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen).trim();
}

function stripUnsafeText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function containsDisallowed(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes('http://') || lower.includes('https://') || lower.includes('www.')) return true;
  if (/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(text)) return true;
  return false;
}

async function logBotAction(db: FirebaseFirestore.Firestore, payload: Record<string, any>) {
  try {
    await db.collection(FORUM_BOT_ACTIONS).add(payload);
  } catch (e) {
    console.warn('[forum-bots] Failed to log bot action', e);
  }
}

async function ensureBots(db: FirebaseFirestore.Firestore): Promise<Record<string, ForumBot>> {
  const ref = db.collection(FORUM_BOTS);
  const snap = await ref.get();
  const existing = new Map<string, ForumBot>();
  snap.forEach((docSnap) => {
    existing.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as any) } as ForumBot);
  });

  const batch = db.batch();
  let needsWrite = false;
  const now = Date.now();
  for (const bot of DEFAULT_BOTS) {
    if (!existing.has(bot.id)) {
      needsWrite = true;
      batch.set(ref.doc(bot.id), {
        ...bot,
        createdAt: now,
        updatedAt: now,
      });
      existing.set(bot.id, bot);
    }
  }
  if (needsWrite) await batch.commit();
  return Object.fromEntries(existing.entries());
}

async function getSettings(db: FirebaseFirestore.Firestore): Promise<ForumBotSettings> {
  const ref = db.collection(FORUM_BOT_SETTINGS).doc('default');
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...DEFAULT_SETTINGS }, { merge: true });
    return { ...DEFAULT_SETTINGS };
  }
  const data = snap.data() as Partial<ForumBotSettings>;
  return { ...DEFAULT_SETTINGS, ...data };
}

async function acquireLock(db: FirebaseFirestore.Firestore, settings: ForumBotSettings, now: number): Promise<boolean> {
  const ref = db.collection(FORUM_BOT_STATE).doc('state');
  let acquired = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as any) : {};
    const lockUntil = Number(data.lockUntil || 0);
    const lastRunAt = Number(data.lastRunAt || 0);
    if (lockUntil > now) return;
    if (lastRunAt && now - lastRunAt < settings.minMinutesBetweenRuns * 60 * 1000) return;
    tx.set(ref, {
      lockUntil: now + settings.lockTtlMinutes * 60 * 1000,
      lockBy: `run_${now}_${Math.floor(Math.random() * 100000)}`,
      lastAttemptAt: now,
    }, { merge: true });
    acquired = true;
  });
  return acquired;
}

async function releaseLock(db: FirebaseFirestore.Firestore, updates: Record<string, any>) {
  const ref = db.collection(FORUM_BOT_STATE).doc('state');
  await ref.set({ ...updates, lockUntil: 0 }, { merge: true });
}

async function fetchRecentPosts(db: FirebaseFirestore.Firestore, settings: ForumBotSettings, now: number): Promise<ForumPostLite[]> {
  const snap = await db.collection(FORUM_POSTS)
    .orderBy('createdAt', 'desc')
    .limit(settings.maxCandidatePosts * 2)
    .get();
  const maxAgeMs = settings.maxPostAgeDays * 24 * 60 * 60 * 1000;
  const posts: ForumPostLite[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const createdAt = Number(data.createdAt || 0);
    if (!createdAt || now - createdAt > maxAgeMs) return;
    posts.push({
      id: docSnap.id,
      title: String(data.title || '').trim(),
      body: data.body ? String(data.body).trim() : null,
      subreddit: data.subreddit ?? null,
      voteScore: Number(data.voteScore || 0),
      commentCount: Number(data.commentCount || 0),
      createdAt,
      author: data.author || {},
      isBot: !!data.isBot || !!data?.author?.isBot,
      botId: data.botId || data?.author?.botId || null,
    });
  });
  return posts.filter((p) => p.title && p.title.length > 0);
}

async function fetchRecentComments(db: FirebaseFirestore.Firestore, settings: ForumBotSettings, now: number): Promise<ForumCommentLite[]> {
  const snap = await db.collection(FORUM_COMMENTS)
    .orderBy('createdAt', 'desc')
    .limit(settings.maxCandidateComments * 2)
    .get();
  const maxAgeMs = settings.maxCommentAgeDays * 24 * 60 * 60 * 1000;
  const comments: ForumCommentLite[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const createdAt = Number(data.createdAt || 0);
    if (!createdAt || now - createdAt > maxAgeMs) return;
    const body = String(data.body || '').trim();
    if (!body) return;
    comments.push({
      id: docSnap.id,
      postId: String(data.postId || ''),
      body,
      createdAt,
      author: data.author || {},
      isBot: !!data.isBot || !!data?.author?.isBot,
      botId: data.botId || data?.author?.botId || null,
    });
  });
  return comments;
}

async function fetchPostById(db: FirebaseFirestore.Firestore, postId: string): Promise<ForumPostLite | null> {
  try {
    const snap = await db.collection(FORUM_POSTS).doc(postId).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    return {
      id: snap.id,
      title: String(data.title || '').trim(),
      body: data.body ? String(data.body).trim() : null,
      subreddit: data.subreddit ?? null,
      voteScore: Number(data.voteScore || 0),
      commentCount: Number(data.commentCount || 0),
      createdAt: Number(data.createdAt || 0),
      author: data.author || {},
      isBot: !!data.isBot || !!data?.author?.isBot,
      botId: data.botId || data?.author?.botId || null,
    };
  } catch {
    return null;
  }
}

async function fetchCommentById(db: FirebaseFirestore.Firestore, commentId: string): Promise<ForumCommentLite | null> {
  try {
    const snap = await db.collection(FORUM_COMMENTS).doc(commentId).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    return {
      id: snap.id,
      postId: String(data.postId || ''),
      body: String(data.body || '').trim(),
      createdAt: Number(data.createdAt || 0),
      author: data.author || {},
      isBot: !!data.isBot || !!data?.author?.isBot,
      botId: data.botId || data?.author?.botId || null,
    };
  } catch {
    return null;
  }
}

async function fetchCommunities(db: FirebaseFirestore.Firestore): Promise<string[]> {
  try {
    const snap = await db.collection(FORUM_COMMUNITIES).get();
    const list: string[] = [];
    snap.forEach((docSnap) => {
      const id = docSnap.id;
      if (id) list.push(id);
    });
    return list;
  } catch {
    return [];
  }
}

function pickBotsForRun(bots: Record<string, ForumBot>, count: number): ForumBot[] {
  const list = Object.values(bots);
  if (list.length <= count) return list;
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function callGeminiJSON(apiKey: string, model: string, prompt: string): Promise<any | null> {
  // Normalize model name - remove models/ prefix if present
  let cleanModel = model.startsWith('models/') ? model.slice('models/'.length) : model;
  
  // Map old/deprecated model names to current 2026 models
  // Current models: gemini-2.0-flash (default), gemini-2.0-flash-lite, gemini-3-flash (preview), gemini-3-pro (preview)
  const modelMap: Record<string, string> = {
    // Old models -> current models
    'gemini-1.5-flash': 'gemini-2.0-flash',
    'gemini-1.5-pro': 'gemini-2.0-flash',
    'gemini-2.5-flash-lite': 'gemini-2.0-flash-lite',
    'gemini-2.5-flash': 'gemini-2.0-flash',
    'gemini-pro': 'gemini-2.0-flash',
    // Ensure current models are used as-is
    'gemini-2.0-flash': 'gemini-2.0-flash',
    'gemini-2.0-flash-lite': 'gemini-2.0-flash-lite',
    'gemini-3-flash': 'gemini-3-flash-exp', // Preview models may need -exp suffix
    'gemini-3-pro': 'gemini-3-pro-exp',
  };
  
  if (modelMap[cleanModel]) {
    cleanModel = modelMap[cleanModel];
  }
  
  // Use v1beta API for current 2026 models (v1 may not support newer models)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 700,
      },
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    console.warn('[forum-bots] Gemini error', res.status, msg.slice(0, 200));
    // Try fallback to gemini-2.0-flash (default) if original failed with 404
    if (res.status === 404 && cleanModel !== 'gemini-2.0-flash') {
      console.log('[forum-bots] trying fallback model gemini-2.0-flash');
      return callGeminiJSON(apiKey, 'gemini-2.0-flash', prompt);
    }
    return null;
  }
  const data = await res.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildActionPrompt(params: {
  bots: ForumBot[];
  posts: ForumPostLite[];
  comments: ForumCommentLite[];
  communities: string[];
  settings: ForumBotSettings;
  trigger?: { type: 'post' | 'comment'; post?: ForumPostLite | null; comment?: ForumCommentLite | null };
}): string {
  const { bots, posts, comments, communities, settings, trigger } = params;
  const postLines = posts.slice(0, settings.maxCandidatePosts).map((p, idx) => {
    const body = p.body ? clampText(stripUnsafeText(p.body), 180) : '';
    return [
      `${idx + 1}) id=${p.id}`,
      `title=${clampText(stripUnsafeText(p.title), 120)}`,
      body ? `body=${body}` : 'body=',
      `subreddit=${p.subreddit ?? 'all'}`,
      `voteScore=${p.voteScore ?? 0}`,
      `commentCount=${p.commentCount ?? 0}`,
      `author=${p.author?.username || p.author?.name || 'anonymous'}`,
      `isBot=${p.isBot ? 'yes' : 'no'}`,
    ].join(' | ');
  });
  const commentLines = comments.slice(0, settings.maxCandidateComments).map((c, idx) => {
    const body = clampText(stripUnsafeText(c.body), 160);
    return [
      `${idx + 1}) id=${c.id}`,
      `postId=${c.postId}`,
      `body=${body}`,
      `author=${c.author?.username || c.author?.name || 'anonymous'}`,
      `isBot=${c.isBot ? 'yes' : 'no'}`,
    ].join(' | ');
  });
  const botLines = bots.map((b) => `- ${b.id} (${b.username}): ${b.persona}. Style: ${b.style}. Topics: ${b.topics.join(', ')}`);
  const communityLine = communities.length ? communities.join(', ') : 'none';
  const triggerLine = (() => {
    if (!trigger) return '';
    if (trigger.type === 'post') {
      const post = trigger.post;
      if (!post) return 'Trigger: new post (details unavailable).';
      const body = post.body ? clampText(stripUnsafeText(post.body), 200) : '';
      return [
        'Trigger: new post.',
        `postId=${post.id}`,
        `title=${clampText(stripUnsafeText(post.title), 140)}`,
        body ? `body=${body}` : 'body=',
        `subreddit=${post.subreddit ?? 'all'}`,
        `author=${post.author?.username || post.author?.name || 'anonymous'}`,
        `isBot=${post.isBot ? 'yes' : 'no'}`,
      ].join(' ');
    }
    const comment = trigger.comment;
    if (!comment) return 'Trigger: new comment (details unavailable).';
    return [
      'Trigger: new comment.',
      `commentId=${comment.id}`,
      `postId=${comment.postId}`,
      `comment=${clampText(stripUnsafeText(comment.body), 200)}`,
      `author=${comment.author?.username || comment.author?.name || 'anonymous'}`,
      `isBot=${comment.isBot ? 'yes' : 'no'}`,
    ].join(' ');
  })();

  return [
    'You are coordinating forum bot actions for a student community.',
    'Return STRICT JSON with this shape: {"actions":[{...}]}. No extra text.',
    'Allowed actions: "skip", "post", "comment", "upvote", "downvote".',
    'Rules:',
    `- Max actions: ${settings.maxActionsPerRun}.`,
    '- Only use botIds from the list.',
    '- Only reference post/comment ids from the lists below.',
    '- Avoid sensitive topics, personal data, medical/legal advice, or anything unsafe.',
    '- Avoid external links or emails.',
    '- Keep tone supportive and helpful.',
    '- You MAY interact with posts/comments by bots or humans.',
    '- For votes, set targetType to "post" or "comment".',
    `- Title <= ${settings.maxTitleChars} chars. Body <= ${settings.maxBodyChars} chars. Comment <= ${settings.maxCommentChars} chars.`,
    `- Aim for mix: posts ~${Math.round(settings.postProbability * 100)}%, comments ~${Math.round(settings.commentProbability * 100)}%, votes ~${Math.round(settings.voteProbability * 100)}%.`,
    `- If you choose "post", pick subreddit from: ${communityLine}. Use null or "all" if none.`,
    trigger ? '- Most of the time, choose "skip" unless there is a strong reason to engage.' : '- PROACTIVE MODE: You are waking up to keep the community active. Do NOT skip. CREATE A NEW POST (action="post") about 40% of the time, or comment on an existing post.',
    'Preferred topics: SAT practice, math, reading & writing, test strategies, study habits, motivation, plus occasional light/organic topics (school life, hobbies, music, fun observations) to keep things engaging.',
    !trigger ? 'Instructions: The forum is quiet. Pick a bot persona and start a new discussion thread or share a tip. If recent posts are sparse, definitely create a post.' : '',
    triggerLine ? `\n${triggerLine}` : '',
    '',
    'Bots:',
    ...botLines,
    '',
    'Recent posts (use id):',
    ...postLines,
    '',
    'Recent comments (use id for votes; comments are only allowed on posts):',
    ...commentLines,
    '',
    'Output JSON only.',
  ].filter(Boolean).join('\n');
}

function validateActions(input: any, settings: ForumBotSettings, bots: Record<string, ForumBot>, posts: ForumPostLite[], comments: ForumCommentLite[]): ForumAction[] {
  const actions: ForumAction[] = [];
  if (!input || !Array.isArray(input.actions)) return actions;
  const postIds = new Set(posts.map((p) => p.id));
  const commentIds = new Set(comments.map((c) => c.id));
  for (const raw of input.actions) {
    if (!raw || typeof raw !== 'object') continue;
    const botId = String(raw.botId || '');
    if (!botId || !bots[botId]) continue;
    const action = String(raw.action || '').toLowerCase();
    if (action === 'skip') {
      actions.push({ action: 'skip', botId });
      continue;
    }
    if (action === 'post') {
      const title = clampText(String(raw.title || ''), settings.maxTitleChars);
      const body = clampText(String(raw.body || ''), settings.maxBodyChars);
      if (!title || title.length < 4) continue;
      if (containsDisallowed(title) || containsDisallowed(body)) continue;
      const subredditRaw = raw.subreddit ? String(raw.subreddit) : null;
      const subreddit = subredditRaw && subredditRaw.toLowerCase() !== 'all' ? subredditRaw : null;
      actions.push({ action: 'post', botId, title, body, subreddit });
      continue;
    }
    if (action === 'comment') {
      const targetId = String(raw.targetId || '');
      const comment = clampText(String(raw.comment || ''), settings.maxCommentChars);
      if (!targetId || !postIds.has(targetId)) continue;
      if (!comment || comment.length < 6) continue;
      if (containsDisallowed(comment)) continue;
      actions.push({ action: 'comment', botId, targetId, comment });
      continue;
    }
    if (action === 'upvote' || action === 'downvote') {
      const targetId = String(raw.targetId || '');
      const targetType = String(raw.targetType || 'post');
      if (!targetId) continue;
      if (targetType !== 'post' && targetType !== 'comment') continue;
      if (targetType === 'post' && !postIds.has(targetId)) continue;
      if (targetType === 'comment' && !commentIds.has(targetId)) continue;
      actions.push({ action: action as 'upvote' | 'downvote', botId, targetType: targetType as 'post' | 'comment', targetId });
    }
  }
  return actions.slice(0, settings.maxActionsPerRun);
}

async function applyVote(db: FirebaseFirestore.Firestore, botId: string, targetType: 'post' | 'comment', targetId: string, value: 1 | -1): Promise<boolean> {
  const voteId = `${botId}_${targetType}_${targetId}`;
  const voteRef = db.collection(FORUM_VOTES).doc(voteId);
  const targetRef = db.collection(targetType === 'post' ? FORUM_POSTS : FORUM_COMMENTS).doc(targetId);
  const existingVote = await voteRef.get();
  if (existingVote.exists) {
    const prevValue = Number((existingVote.data() as any)?.value || 0);
    if (prevValue === value) return false;
  }
  await db.runTransaction(async (tx) => {
    const voteSnap = await tx.get(voteRef);
    let delta = value;
    if (voteSnap.exists) {
      const prev = Number((voteSnap.data() as any)?.value || 0);
      if (prev === value) return;
      delta = (value - prev) as 1 | -1;
      tx.set(voteRef, { id: voteId, userId: botId, targetType, targetId, value, createdAt: Date.now(), isBot: true, botId });
    } else {
      tx.set(voteRef, { id: voteId, userId: botId, targetType, targetId, value, createdAt: Date.now(), isBot: true, botId });
    }
    tx.update(targetRef, { voteScore: FieldValue.increment(delta) });
  });
  if (targetType === 'post') {
    const snap = await db.collection(FORUM_POSTS).doc(targetId).get();
    if (snap.exists) {
      const p = snap.data() as any;
      const createdAt = Number(p.createdAt || Date.now());
      const voteScore = Number(p.voteScore || 0);
      const newScore = computeHotScore(voteScore, createdAt);
      await db.collection(FORUM_POSTS).doc(targetId).set({ hotScore: newScore, updatedAt: Date.now() }, { merge: true });
    }
  }
  return true;
}

async function applyAction(
  db: FirebaseFirestore.Firestore,
  action: ForumAction,
  bot: ForumBot,
  posts: ForumPostLite[],
  comments: ForumCommentLite[],
  settings: ForumBotSettings,
  context?: BotJobContext,
): Promise<{ ok: boolean; type: string }> {
  const now = Date.now();
  if (action.action === 'skip') return { ok: true, type: 'skip' };

  const author = {
    uid: bot.id,
    name: bot.name,
    username: bot.username,
    avatarIcon: bot.avatarIcon || null,
    avatarColor: bot.avatarColor || null,
    isBot: true,
    botId: bot.id,
  };

  if (action.action === 'post') {
    const title = clampText(stripUnsafeText(action.title), settings.maxTitleChars);
    const body = action.body ? clampText(stripUnsafeText(action.body), settings.maxBodyChars) : '';
    if (!title) return { ok: false, type: 'post' };
    const ref = await db.collection(FORUM_POSTS).add({
      title,
      body,
      author,
      subreddit: action.subreddit ?? null,
      voteScore: 0,
      commentCount: 0,
      titleLower: title.toLowerCase(),
      createdAt: now,
      updatedAt: now,
      hotScore: computeHotScore(0, now),
      isBot: true,
      botId: bot.id,
    });
    await logBotAction(db, {
      createdAt: now,
      botId: bot.id,
      botUsername: bot.username,
      botName: bot.name,
      action: 'post',
      targetType: 'post',
      targetId: ref.id,
      postId: ref.id,
      subreddit: action.subreddit ?? null,
      title,
      bodyPreview: body ? clampText(body, 220) : null,
      triggerType: context?.triggerType || null,
      triggerId: context?.triggerId || null,
      triggerPostId: context?.triggerPostId || null,
      triggerIsBot: context?.triggerIsBot ?? null,
      triggerSubreddit: context?.triggerSubreddit || null,
      jobId: context?.jobId || null,
    });
    await db.collection(FORUM_BOTS).doc(bot.id).set({ lastActionAt: now, updatedAt: now }, { merge: true });
    return { ok: !!ref.id, type: 'post' };
  }

  if (action.action === 'comment') {
    const targetId = action.targetId;
    const post = posts.find((p) => p.id === targetId);
    if (!post) return { ok: false, type: 'comment' };
    const commentText = clampText(stripUnsafeText(action.comment), settings.maxCommentChars);
    if (!commentText) return { ok: false, type: 'comment' };
    const commentsSnap = await db.collection(FORUM_COMMENTS)
      .where('postId', '==', targetId)
      .limit(50)
      .get();
    const alreadyCommented = commentsSnap.docs.some((d) => (d.data() as any)?.author?.botId === bot.id);
    if (alreadyCommented) return { ok: false, type: 'comment' };
    const ref = await db.collection(FORUM_COMMENTS).add({
      postId: targetId,
      body: commentText,
      author,
      voteScore: 0,
      createdAt: now,
      updatedAt: now,
      path: `root/${now}`,
      isBot: true,
      botId: bot.id,
    });
    await logBotAction(db, {
      createdAt: now,
      botId: bot.id,
      botUsername: bot.username,
      botName: bot.name,
      action: 'comment',
      targetType: 'comment',
      targetId: ref.id,
      commentId: ref.id,
      postId: targetId,
      commentPreview: clampText(commentText, 220),
      triggerType: context?.triggerType || null,
      triggerId: context?.triggerId || null,
      triggerPostId: context?.triggerPostId || null,
      triggerIsBot: context?.triggerIsBot ?? null,
      triggerSubreddit: context?.triggerSubreddit || null,
      jobId: context?.jobId || null,
    });
    await db.collection(FORUM_POSTS).doc(targetId).set({ commentCount: FieldValue.increment(1), updatedAt: now }, { merge: true });
    await db.collection(FORUM_BOTS).doc(bot.id).set({ lastActionAt: now, updatedAt: now }, { merge: true });
    return { ok: !!ref.id, type: 'comment' };
  }

  if (action.action === 'upvote' || action.action === 'downvote') {
    const changed = await applyVote(db, bot.id, action.targetType, action.targetId, action.action === 'upvote' ? 1 : -1);
    if (changed) {
      const commentTarget = action.targetType === 'comment'
        ? comments.find((c) => c.id === action.targetId)
        : null;
      await logBotAction(db, {
        createdAt: now,
        botId: bot.id,
        botUsername: bot.username,
        botName: bot.name,
        action: action.action,
        targetType: action.targetType,
        targetId: action.targetId,
        postId: action.targetType === 'post' ? action.targetId : (commentTarget?.postId || null),
        commentId: action.targetType === 'comment' ? action.targetId : null,
        triggerType: context?.triggerType || null,
        triggerId: context?.triggerId || null,
        triggerPostId: context?.triggerPostId || null,
        triggerIsBot: context?.triggerIsBot ?? null,
        triggerSubreddit: context?.triggerSubreddit || null,
        jobId: context?.jobId || null,
      });
      await db.collection(FORUM_BOTS).doc(bot.id).set({ lastActionAt: now, updatedAt: now }, { merge: true });
    }
    return { ok: changed, type: 'vote' };
  }

  return { ok: false, type: 'unknown' };
}

async function enqueueBotJob(params: { type: 'post' | 'comment'; triggerId: string; postId?: string | null; authorId?: string | null; isBot?: boolean; subreddit?: string | null }) {
  const db = getFirestore();
  const settings = await getSettings(db);
  if (!settings.enabled) return;
  const now = Date.now();
  const spacingMs = Math.max(0, settings.minMinutesBetweenJobs) * 60 * 1000;
  if (spacingMs > 0) {
    const latest = await db.collection(FORUM_BOT_JOBS).orderBy('runAt', 'desc').limit(1).get();
    if (!latest.empty) {
      const lastRunAt = Number((latest.docs[0].data() as any)?.runAt || 0);
      if (lastRunAt && lastRunAt - now < spacingMs) return;
    }
  }
  const delayMinutes = 0;
  const runAt = now;
  const ref = db.collection(FORUM_BOT_JOBS).doc();
  await ref.set({
    id: ref.id,
    triggerType: params.type,
    triggerId: params.triggerId,
    triggerPostId: params.postId || null,
    triggerAuthorId: params.authorId || null,
    triggerIsBot: !!params.isBot,
    triggerSubreddit: params.subreddit || null,
    createdAt: now,
    runAt,
    delayMinutes,
  });
  console.log('[forum-bots] enqueued job', { jobId: ref.id, type: params.type, triggerId: params.triggerId, runAt, delayMinutes });
}

export const queueForumBotJobOnPostCreate = onDocumentCreated({
  document: 'forum_posts/{postId}',
  region: 'us-central1',
}, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data() as any;
  console.log('[forum-bots] enqueue from post', { postId: event.params.postId, isBot: !!data?.isBot || !!data?.author?.isBot });
  await enqueueBotJob({
    type: 'post',
    triggerId: event.params.postId as string,
    authorId: data?.author?.uid || null,
    isBot: !!data?.isBot || !!data?.author?.isBot,
    subreddit: data?.subreddit ?? null,
  });
});

export const queueForumBotJobOnCommentCreate = onDocumentCreated({
  document: 'forum_comments/{commentId}',
  region: 'us-central1',
}, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data() as any;
  console.log('[forum-bots] enqueue from comment', { commentId: event.params.commentId, postId: data?.postId || null, isBot: !!data?.isBot || !!data?.author?.isBot });
  await enqueueBotJob({
    type: 'comment',
    triggerId: event.params.commentId as string,
    postId: data?.postId || null,
    authorId: data?.author?.uid || null,
    isBot: !!data?.isBot || !!data?.author?.isBot,
    subreddit: data?.subreddit ?? null,
  });
});

export const forumBotsTick = onSchedule({
  schedule: 'every 1 minutes',
  timeZone: getTimeZone(),
  secrets: [GEMINI_API_KEY],
  region: 'us-central1',
}, async () => {
  const db = getFirestore();
  const settings = await getSettings(db);
  if (!settings.enabled) {
    console.log('[forum-bots] disabled');
    return;
  }
  const now = Date.now();
  console.log('[forum-bots] tick', { now });

  const lockOk = await acquireLock(db, settings, now);
  if (!lockOk) {
    console.log('[forum-bots] lock skipped');
    return;
  }

  const stateRef = db.collection(FORUM_BOT_STATE).doc('state');
  let dailyCount = 0;
  let dayKey = dayKeyUtc(now);
  try {
    const snap = await stateRef.get();
    const data = snap.exists ? (snap.data() as any) : {};
    const prevDay = String(data.dayKey || '');
    dayKey = dayKeyUtc(now);
    if (prevDay === dayKey) {
      dailyCount = Number(data.dailyActionCount || 0);
    }
  } catch {}

  if (dailyCount >= settings.maxDailyActions) {
    console.log('[forum-bots] daily cap', { dailyCount, maxDailyActions: settings.maxDailyActions });
    await releaseLock(db, { lastRunAt: now, dayKey, dailyActionCount: dailyCount, lastRunResult: 'daily-cap' });
    return;
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    console.log('[forum-bots] missing api key');
    await releaseLock(db, { lastRunAt: now, dayKey, dailyActionCount: dailyCount, lastRunResult: 'missing-api-key' });
    return;
  }

  const nextJobSnap = await db.collection(FORUM_BOT_JOBS)
    .orderBy('runAt', 'asc')
    .limit(1)
    .get();
  if (!nextJobSnap.empty) {
    const nextJob = nextJobSnap.docs[0].data() as any;
    console.log('[forum-bots] next job', { runAt: nextJob?.runAt || null, now });
  } else {
    console.log('[forum-bots] no jobs in queue');
  }

  const dueJobsSnap = await db.collection(FORUM_BOT_JOBS)
    .where('runAt', '<=', now)
    .orderBy('runAt', 'asc')
    .limit(settings.maxJobsPerRun)
    .get();
  
  const bots = await ensureBots(db);
  let appliedTotal = 0;
  
  // Process queued jobs if any
  if (!dueJobsSnap.empty) {
    for (const jobDoc of dueJobsSnap.docs) {
    if (dailyCount + appliedTotal >= settings.maxDailyActions) break;
    const job = jobDoc.data() as any;
    console.log('[forum-bots] processing job', { jobId: jobDoc.id, triggerType: job?.triggerType, triggerId: job?.triggerId, runAt: job?.runAt });
    const posts = await fetchRecentPosts(db, settings, now);
    const comments = await fetchRecentComments(db, settings, now);
    const triggerType = job?.triggerType === 'comment' ? 'comment' : 'post';
    const triggerPost = triggerType === 'post'
      ? await fetchPostById(db, String(job?.triggerId || ''))
      : (job?.triggerPostId ? await fetchPostById(db, String(job.triggerPostId)) : null);
    const triggerComment = triggerType === 'comment'
      ? await fetchCommentById(db, String(job?.triggerId || ''))
      : null;
    if (triggerPost && !posts.some((p) => p.id === triggerPost.id)) {
      posts.unshift(triggerPost);
    }
    if (triggerComment && !comments.some((c) => c.id === triggerComment.id)) {
      comments.unshift(triggerComment);
    }
    if (!posts.length) {
      console.log('[forum-bots] no posts for job', { jobId: jobDoc.id });
      await jobDoc.ref.delete().catch(() => {});
      continue;
    }
    const communities = await fetchCommunities(db);
    const botsForRun = pickBotsForRun(bots, Math.max(settings.maxActionsPerRun, 3));
    const prompt = buildActionPrompt({
      bots: botsForRun,
      posts,
      comments,
      communities,
      settings,
      trigger: { type: triggerType, post: triggerPost, comment: triggerComment },
    });

    const result = await callGeminiJSON(apiKey, settings.model, prompt);
    const actions = validateActions(result, settings, bots, posts, comments);
    console.log('[forum-bots] action plan', { jobId: jobDoc.id, actionCount: actions.length, model: settings.model });
    let applied = 0;
    for (const action of actions) {
      if (dailyCount + appliedTotal + applied >= settings.maxDailyActions) break;
      const bot = bots[action.botId];
      if (!bot) continue;
      const context: BotJobContext = {
        jobId: jobDoc.id,
        triggerType,
        triggerId: String(job?.triggerId || ''),
        triggerPostId: job?.triggerPostId || null,
        triggerIsBot: !!job?.triggerIsBot,
        triggerSubreddit: job?.triggerSubreddit || null,
      };
      const res = await applyAction(db, action, bot, posts, comments, settings, context);
      console.log('[forum-bots] action result', { jobId: jobDoc.id, action: action.action, botId: action.botId, ok: res.ok, type: res.type });
      if (res.ok && action.action !== 'skip') {
        applied += 1;
      }
    }
    appliedTotal += applied;
    await jobDoc.ref.delete().catch(() => {});
    }
  }
  
  // If no jobs but under daily cap, run bots proactively on existing content
  if (dueJobsSnap.empty && dailyCount + appliedTotal < settings.maxDailyActions) {
    const posts = await fetchRecentPosts(db, settings, now);
    const comments = await fetchRecentComments(db, settings, now);
    
    // Run proactively (even if empty, to seed content)
    console.log('[forum-bots] running proactively', { posts: posts.length, comments: comments.length });
    const communities = await fetchCommunities(db);
    const botsForRun = pickBotsForRun(bots, Math.max(settings.maxActionsPerRun, 3));
    const prompt = buildActionPrompt({
      bots: botsForRun,
      posts,
      comments,
      communities,
      settings,
      trigger: undefined, // No trigger for proactive runs
    });
    
    const result = await callGeminiJSON(apiKey, settings.model, prompt);
    const actions = validateActions(result, settings, bots, posts, comments);
    console.log('[forum-bots] proactive action plan', { actionCount: actions.length, model: settings.model });
    let applied = 0;
    for (const action of actions) {
      if (dailyCount + appliedTotal + applied >= settings.maxDailyActions) break;
      const bot = bots[action.botId];
      if (!bot) continue;
      const context: BotJobContext = {
        jobId: null,
        triggerType: undefined,
        triggerId: null,
        triggerPostId: null,
        triggerIsBot: undefined,
        triggerSubreddit: null,
      };
      const res = await applyAction(db, action, bot, posts, comments, settings, context);
      console.log('[forum-bots] proactive action result', { action: action.action, botId: action.botId, ok: res.ok, type: res.type });
      if (res.ok && action.action !== 'skip') {
        applied += 1;
      }
    }
    appliedTotal += applied;
  }

  const finalCount = dailyCount + appliedTotal;
  await releaseLock(db, {
    lastRunAt: now,
    dayKey,
    dailyActionCount: finalCount,
    lastRunApplied: appliedTotal,
    lastRunResult: appliedTotal > 0 ? 'ok' : 'no-actions',
  });
});
