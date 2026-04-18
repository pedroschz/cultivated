"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, app } from "@/lib/firebaseClient";
import { collection, getFirestore, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import Link from "next/link";


type BotActionRow = {
  id: string;
  botId?: string | null;
  botUsername?: string | null;
  botName?: string | null;
  action?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  title?: string | null;
  bodyPreview?: string | null;
  commentPreview?: string | null;
  subreddit?: string | null;
  triggerType?: string | null;
  triggerId?: string | null;
  createdAt?: number | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [botActions, setBotActions] = useState<BotActionRow[]>([]);
  const [botActionsLoading, setBotActionsLoading] = useState(true);
  const [botJobs, setBotJobs] = useState<any[]>([]);
  const [botJobsLoading, setBotJobsLoading] = useState(true);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth as any, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const tokenResult = await user.getIdTokenResult();
        if (tokenResult.claims.admin !== true) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        router.replace("/dashboard");
        return;
      }
      setIsAuthorized(true);
      setIsChecking(false);
    });

    return () => unsubscribe?.();
  }, [router]);

  useEffect(() => {
    if (!isAuthorized || !app) return;
    setBotActionsLoading(true);
    const db = getFirestore(app);
    const q = query(collection(db, "forum_bot_actions"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const rows: BotActionRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setBotActions(rows);
      setBotActionsLoading(false);
    }, (err) => {
      console.error("Failed to load bot actions", err);
      setBotActionsLoading(false);
    });
    return () => unsubscribe();
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized || !app) return;
    setBotJobsLoading(true);
    const db = getFirestore(app);
    const q = query(collection(db, "forum_bot_jobs"), orderBy("runAt", "asc"), limit(25));
    const unsubscribe = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setBotJobs(rows);
      setBotJobsLoading(false);
    }, (err) => {
      console.error("Failed to load bot queue", err);
      setBotJobsLoading(false);
    });
    return () => unsubscribe();
  }, [isAuthorized]);

  const formatActionTime = (ts?: number | null) => {
    if (!ts) return "";
    const date = new Date(ts);
    return isNaN(date.getTime()) ? "" : date.toLocaleString();
  };

  const formatMinutesUntil = (ts?: number | null) => {
    if (!ts) return "";
    const diffMs = ts - Date.now();
    const mins = Math.max(0, Math.ceil(diffMs / 60000));
    return `${mins} min`;
  };

  const botActionsList = useMemo(() => botActions, [botActions]);

  if (isChecking) {
    return (
      <div className="min-h-screen ambient-bg flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Checking admin access…</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-display font-bold mb-2">Admin</h1>
        <p className="text-muted-foreground mb-6">Welcome. Only the authorized account can access this page.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/admin/schools"
            className="block rounded-xl border border-border/50 bg-card/70 backdrop-blur p-4 hover:bg-card transition-colors"
          >
            <div className="font-semibold mb-1">Schools</div>
            <div className="text-sm text-muted-foreground">Create schools and get admin invite codes.</div>
          </a>
          <a
            href="/admin/upload-question"
            className="block rounded-xl border border-border/50 bg-card/70 backdrop-blur p-4 hover:bg-card transition-colors"
          >
            <div className="font-semibold mb-1">Upload Questions</div>
            <div className="text-sm text-muted-foreground">Create or import new questions into the system.</div>
          </a>
          <a
            href="/onboarding?demo=true"
            className="block rounded-xl border border-border/50 bg-card/70 backdrop-blur p-4 hover:bg-card transition-colors"
          >
            <div className="font-semibold mb-1">Demo Onboarding</div>
            <div className="text-sm text-muted-foreground">Open a sandbox version of onboarding with no validation or data writes.</div>
          </a>
          <a
            href="/admin/users"
            className="block rounded-xl border border-border/50 bg-card/70 backdrop-blur p-4 hover:bg-card transition-colors"
          >
            <div className="font-semibold mb-1">Manage Users</div>
            <div className="text-sm text-muted-foreground">View all users and perform administrative actions.</div>
          </a>
          <a
            href="/admin/email"
            className="block rounded-xl border border-border/50 bg-card/70 backdrop-blur p-4 hover:bg-card transition-colors"
          >
            <div className="font-semibold mb-1">Email Creator</div>
            <div className="text-sm text-muted-foreground">Compose and send branded emails to users.</div>
          </a>
          <a
            href="/admin/blog"
            className="block rounded-xl border border-border/50 bg-card/70 backdrop-blur p-4 hover:bg-card transition-colors"
          >
            <div className="font-semibold mb-1">Blog Manager</div>
            <div className="text-sm text-muted-foreground">Create and edit blog posts.</div>
          </a>
        </div>

        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Bot Viewer</h2>
            <span className="text-xs text-muted-foreground">Latest 50 actions</span>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur p-4">
            {botActionsLoading && (
              <div className="text-sm text-muted-foreground">Loading bot activity…</div>
            )}
            {!botActionsLoading && botActionsList.length === 0 && (
              <div className="text-sm text-muted-foreground">No bot actions yet.</div>
            )}
            {!botActionsLoading && botActionsList.length > 0 && (
              <div className="space-y-3">
                {botActionsList.map((action) => {
                  const isPostTarget = action.targetType === "post";
                  const postId = action.postId || (isPostTarget ? action.targetId : null);
                  return (
                    <div key={action.id} className="border-b border-border/40 last:border-none pb-3 last:pb-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-semibold">
                          {action.botUsername ? `@${action.botUsername}` : action.botName || "Bot"}
                        </span>
                        <span className="text-muted-foreground">{action.action || "action"}</span>
                        {action.targetType && (
                          <span className="text-muted-foreground">({action.targetType})</span>
                        )}
                        {postId && (
                          <Link className="text-primary underline" href={`/forum/post?id=${encodeURIComponent(postId)}`}>
                            View
                          </Link>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatActionTime(action.createdAt)}
                        {action.subreddit ? ` • r/${action.subreddit}` : ""}
                        {action.triggerType ? ` • trigger: ${action.triggerType}` : ""}
                      </div>
                      {action.title && (
                        <div className="text-sm mt-2">{action.title}</div>
                      )}
                      {action.bodyPreview && (
                        <div className="text-sm text-muted-foreground mt-1">{action.bodyPreview}</div>
                      )}
                      {action.commentPreview && (
                        <div className="text-sm text-muted-foreground mt-1">"{action.commentPreview}"</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Bot Queue</h2>
            <span className="text-xs text-muted-foreground">Next 25 jobs</span>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur p-4">
            {botJobsLoading && (
              <div className="text-sm text-muted-foreground">Loading bot queue…</div>
            )}
            {!botJobsLoading && botJobs.length === 0 && (
              <div className="text-sm text-muted-foreground">No queued jobs.</div>
            )}
            {!botJobsLoading && botJobs.length > 0 && (
              <div className="space-y-3">
                {botJobs.map((job) => {
                  const runAtLabel = formatMinutesUntil(job.runAt);
                  const postId = job.triggerPostId || (job.triggerType === "post" ? job.triggerId : null);
                  return (
                    <div key={job.id} className="border-b border-border/40 last:border-none pb-3 last:pb-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-semibold">Job</span>
                        <span className="text-muted-foreground">{job.triggerType || "trigger"}</span>
                        {postId && (
                          <Link className="text-primary underline" href={`/forum/post?id=${encodeURIComponent(postId)}`}>
                            View
                          </Link>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {job.runAt ? `Respond in ${runAtLabel}` : "Pending"}
                        {job.triggerSubreddit ? ` • r/${job.triggerSubreddit}` : ""}
                        {job.triggerIsBot ? " • from bot" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
