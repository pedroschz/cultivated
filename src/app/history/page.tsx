"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  getDoc,
} from "firebase/firestore";
import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, History as HistoryIcon, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { QuestionDisplay } from "@/components/QuestionDisplay";
import { LatexRenderer } from "@/components/ui/latex";

interface HistoryEntry {
  id: string;
  questionId: string;
  selected: number | string;
  correct: boolean;
  timeSpent?: number;
  answeredAt?: string;
  answeredAtTs: number;
}

type GroupedHistory = Record<string, HistoryEntry[]>;

function formatDayLabel(epochMs: number): string {
  const d = new Date(epochMs);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getDateKey(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function HistoryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string | null>(null);
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null);

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [questionsById, setQuestionsById] = useState<Record<string, any>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState<boolean>(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setUserName(currentUser?.displayName || null);
      // Avatar/profile fields are optional; best-effort fetch handled elsewhere in Sidebar
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadInitial = async () => {
      if (!user || !db) {
        setEntries([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const historyRef = collection(db, "users", user.uid, "history");
        const q = query(historyRef, orderBy("answeredAtTs", "desc"));
        const snap = await getDocs(q);
        const docs = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) })) as HistoryEntry[];
        setEntries(docs);
      } catch (e) {
        console.error("Failed to load history:", e);
      } finally {
        setLoading(false);
      }
    };
    loadInitial();
  }, [user]);

  // Fetch user's bookmarked question IDs
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        if (!user || !db) {
          setBookmarks(new Set());
          return;
        }
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          const ids: string[] = Array.isArray(data?.bookmarks) ? data.bookmarks : [];
          setBookmarks(new Set(ids.filter(Boolean)));
        } else {
          setBookmarks(new Set());
        }
      } catch (e) {
        console.error("Failed to fetch bookmarks:", e);
        setBookmarks(new Set());
      }
    };
    fetchBookmarks();
  }, [user, db]);

  // No pagination: load all entries in one query

  const toggleExpand = async (entry: HistoryEntry) => {
    const isExpanding = !expanded[entry.id];
    setExpanded((prev) => ({ ...prev, [entry.id]: isExpanding }));
    if (isExpanding && user && db && entry.questionId && !questionsById[entry.questionId]) {
      try {
        const ref = doc(db, "questions", entry.questionId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setQuestionsById((prev) => ({ ...prev, [entry.questionId]: { id: snap.id, ...snap.data() } }));
        }
      } catch (e) {
        console.error("Failed to fetch question", entry.questionId, e);
      }
    }
  };

  const handleToggleDay = async (key: string, items: HistoryEntry[]) => {
    const isExpanding = !expandedDays[key];
    setExpandedDays((prev) => ({ ...prev, [key]: isExpanding }));
    if (!isExpanding) return;
    try {
      if (!db) return;
      const missingIds = Array.from(new Set(items.map((e) => e.questionId))).filter((id) => !questionsById[id]);
      for (const qid of missingIds) {
        try {
          const ref = doc(db, "questions", qid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setQuestionsById((prev) => ({ ...prev, [qid]: { id: snap.id, ...snap.data() } }));
          }
        } catch {
          // ignore individual failures
        }
      }
    } catch {
      // ignore
    }
  };

  // Removed prefetching of question docs; questions are now loaded only when a user expands a specific entry

  const visibleEntries: HistoryEntry[] = useMemo(() => {
    if (!showBookmarkedOnly) return entries;
    if (!bookmarks || bookmarks.size === 0) return [];
    return entries.filter((e) => bookmarks.has(e.questionId));
  }, [entries, showBookmarkedOnly, bookmarks]);

  const grouped: GroupedHistory = useMemo(() => {
    const map: GroupedHistory = {};
    for (const entry of visibleEntries) {
      const ts = typeof entry.answeredAtTs === "number" ? entry.answeredAtTs : Date.parse(entry.answeredAt || "");
      if (!ts || Number.isNaN(ts)) continue;
      const key = getDateKey(ts);
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    }
    return map;
  }, [visibleEntries]);

  const dayKeysSortedDesc = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  }, [grouped]);

  // Auto-expand and scroll to a day anchor if present in URL hash (e.g., #day-2025-03-14)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (!hash.startsWith("#day-")) return;
    const key = hash.slice(5);
    if (!key) return;
    setExpandedDays((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      const el = document.getElementById(`day-${key}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    // Also load the questions for that day if available in the grouped map
    (async () => {
      try {
        if (!db) return;
        const items = grouped[key] || [];
        const missingIds = Array.from(new Set(items.map((e) => e.questionId))).filter((id) => !questionsById[id]);
        for (const qid of missingIds) {
          try {
            const ref = doc(db, "questions", qid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
              setQuestionsById((prev) => ({ ...prev, [qid]: { id: snap.id, ...snap.data() } }));
            }
          } catch {}
        }
      } catch {}
    })();
  }, [dayKeysSortedDesc.length, grouped, db, questionsById]);

  const formatDuration = (seconds?: number) => {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) return "";
    if (seconds >= 60) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}m ${s}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar
        user={user}
        userName={userName}
        userUsername={userUsername}
        userAvatarIcon={userAvatarIcon}
        userAvatarColor={userAvatarColor}
      />
      <div className={cn("transition-all duration-300 ease-in-out", "ml-0 md:ml-64")}> 
        <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
          <PageHeader
            title="Practice History"
            description="Your answered questions, grouped by day."
          />

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading history…</div>
          ) : entries.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No history yet</CardTitle>
              </CardHeader>
              <CardContent>
                Start a practice session to see your answered questions here.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between pt-3">
                <div className="text-sm text-muted-foreground">
                  {showBookmarkedOnly ? "Showing bookmarked questions only" : "Showing all answered questions"}
                </div>
                <Button
                  variant={showBookmarkedOnly ? "default" : "outline"}
                  onClick={() => setShowBookmarkedOnly((v) => !v)}
                  size="sm"
                >
                  {showBookmarkedOnly ? "Bookmarked only: ON" : "Bookmarked only"}
                </Button>
              </div>

              {visibleEntries.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>No bookmarked questions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    You have no bookmarked questions in your history.
                  </CardContent>
                </Card>
              )}

              {dayKeysSortedDesc.map((key, idx) => {
                const sampleTs = grouped[key][0]?.answeredAtTs || Date.parse(grouped[key][0]?.answeredAt || "");
                const label = formatDayLabel(sampleTs);
                const items = grouped[key];
                const monthLabel = (() => {
                  const [y, m] = key.split('-');
                  const d = new Date(Number(y), Number(m) - 1, 1);
                  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
                })();
                const prevMonth = idx > 0 ? dayKeysSortedDesc[idx - 1].slice(0, 7) : null;
                const thisMonth = key.slice(0, 7);
                const showMonthDivider = idx === 0 || thisMonth !== prevMonth;
                return (
                  <div key={key} className="space-y-3" id={`day-${key}`}>
                    {showMonthDivider && (
                      <div className="flex items-center gap-3 mt-6">
                        <div className="text-sm font-semibold text-muted-foreground">{monthLabel}</div>
                        <Separator className="flex-1" />
                      </div>
                    )}

                    <button
                      type="button"
                      className="w-full text-left flex items-center justify-between px-3 py-2 rounded-md border bg-card hover:bg-muted/40 transition-colors"
                      onClick={() => handleToggleDay(key, items)}
                      aria-expanded={!!expandedDays[key]}
                    >
                      <div className="flex items-center gap-2">
                        <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">{label}</h2>
                      </div>
                      {expandedDays[key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    {expandedDays[key] && (
                      <div className="grid grid-cols-1 gap-2">
                        {items.map((h) => {
                          const ts = typeof h.answeredAtTs === "number" ? h.answeredAtTs : Date.parse(h.answeredAt || "");
                          const timeStr = ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                          return (
                            <div key={h.id} className="rounded-lg border bg-card">
                              <button
                                type="button"
                                className={cn(
                                  "w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-muted/40 transition-colors",
                                  expanded[h.id] && "rounded-b-none border-b"
                                )}
                                onClick={() => toggleExpand(h)}
                                aria-expanded={!!expanded[h.id]}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {h.correct ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-xs text-muted-foreground leading-tight">
                                      {questionsById[h.questionId]?.skill || 'Question'}
                                    </div>
                                    <div className="text-sm font-medium leading-tight truncate max-w-[52vw] sm:max-w-[40vw]">
                                      {questionsById[h.questionId]?.question ? (
                                        (() => {
                                          const raw = String(questionsById[h.questionId].question);
                                          const noTables = raw.replace(/<table[\s\S]*?<\/table>/gi, "");
                                          // Collapse line breaks and <br> into spaces for compact single-line preview
                                          const singleLine = noTables
                                            .replace(/<br\s*\/?>(\s*)/gi, ' ')
                                            .replace(/\n|\r/g, ' ')
                                            .replace(/\s+/g, ' ')
                                            .trim();
                                          return <LatexRenderer compactInline>{singleLine}</LatexRenderer>;
                                        })()
                                      ) : (
                                        h.questionId
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <Badge variant={h.correct ? "default" : "secondary"} className="text-xs py-0">{h.correct ? "Correct" : "Incorrect"}</Badge>
                                  <div className="text-xs text-muted-foreground">
                                    Ans: {(() => {
                                      const q = questionsById[h.questionId];
                                      const hasOptions = Array.isArray(q?.options) && q.options.length > 0;
                                      const idx = typeof h.selected === 'number' ? h.selected : Number(h.selected);
                                      const isIndex = Number.isInteger(idx) && idx >= 0 && idx < (hasOptions ? q.options.length : Infinity);
                                      const label = hasOptions && isIndex ? String.fromCharCode(65 + idx) : String(h.selected);
                                      return <span className="text-foreground">{label}</span>;
                                    })()}
                                  </div>
                                  {typeof h.timeSpent === "number" && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {formatDuration(h.timeSpent)}</div>
                                  )}
                                  <div className="text-xs text-muted-foreground">{timeStr}</div>
                                </div>
                              </button>

                              {expanded[h.id] && (
                                <div className="px-3 pb-3 pt-2">
                                  {questionsById[h.questionId] ? (
                                    (() => {
                                      const q = questionsById[h.questionId];
                                      const hasOptions = Array.isArray(q?.options) && q.options.length > 0;
                                      const hasExplanation = typeof q?.explanation === 'string' && q.explanation.trim().length > 0;
                                      return (
                                        <div className="space-y-4">
                                          {/* Top: question, passage, image (full width) */}
                                          <QuestionDisplay
                                            question={q}
                                            showExplanation={false}
                                            showPassage={true}
                                            imageClassName="max-h-64 md:max-h-80 object-contain"
                                          />

                                          {/* Row: options (1/3) and explanation (2/3) */}
                                          {(hasOptions || hasExplanation) && (
                                            <div className={cn(hasOptions ? "grid grid-cols-3 gap-4" : "")}> 
                                              {hasOptions && (
                                                <div className="col-span-1 space-y-2">
                                                  <div className="text-sm font-medium">Options</div>
                                                  <ul className="space-y-1">
                                                    {q.options.map((opt: any, idx: number) => {
                                                      const optionText = typeof opt === "string" ? opt : (opt?.text ?? String(opt));
                                                      const correctIndex = typeof q.answer === "number" ? q.answer : -1;
                                                      const isCorrectOpt = idx === correctIndex;
                                                      const isSelectedOpt = String(h.selected) === String(idx);
                                                      return (
                                                        <li key={idx} className={cn(
                                                          "text-sm px-3 py-2 rounded-md border",
                                                          isCorrectOpt ? "border-[#93d333] bg-[#93d333]/10" : isSelectedOpt ? "border-primary/40 bg-primary/5" : "border-transparent bg-muted/30"
                                                        )}>
                                                          <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs w-5">{String.fromCharCode(65 + idx)}</span>
                                                            <div className="flex-1">
                                                              <LatexRenderer>{optionText}</LatexRenderer>
                                                            </div>
                                                            {isCorrectOpt && <Badge className="text-[10px]" variant="default">Correct</Badge>}
                                                            {isSelectedOpt && !isCorrectOpt && <Badge className="text-[10px]" variant="secondary">Your Answer</Badge>}
                                                          </div>
                                                        </li>
                                                      );
                                                    })}
                                                  </ul>
                                                </div>
                                              )}
                                              <div className={cn(hasOptions ? "col-span-2" : "")}>
                                                {hasExplanation && (
                                                  <div className="mt-1 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                                                    <h4 className="font-semibold text-blue-900 mb-2">Explanation:</h4>
                                                    <div className="prose prose-sm max-w-none text-blue-800">
                                                      <LatexRenderer>{q.explanation}</LatexRenderer>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading question…</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}


