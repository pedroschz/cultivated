"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { PageHeader } from '@/components/layout/page-header';
import { auth, app } from '@/lib/firebaseClient';
import { DEFAULT_AVATAR } from '@/lib/constants/avatar';
import { cn } from '@/lib/utils';
// Replaced shadcn calendar with a custom month grid below
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Star, Pencil, Save, X, Bell, Download, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

export default function CalendarPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string | null>(null);
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null);
  const [userSchoolId, setUserSchoolId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [userScores, setUserScores] = useState<any[]>([]);
  const [isSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const [practiceDays, setPracticeDays] = useState<boolean[]>(Array(7).fill(false));
  const [practiceTimes, setPracticeTimes] = useState<string[]>(Array(7).fill('20:00'));
  const [goalDate, setGoalDate] = useState<string | undefined>(undefined);
  const [goalScore, setGoalScore] = useState<number | ''>('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  type DayStats = { sessions: number; totalSeconds: number; correct: number; total: number };
  const [dayStats, setDayStats] = useState<Record<string, DayStats>>({});
  const [registrationStartMs, setRegistrationStartMs] = useState<number | null>(null);

  const notificationTimers = useRef<number[]>([]);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && app) {
        try {
          const db = getFirestore(app);
          const userRef = doc(db, 'users', u.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            setUserName(data.name || u.displayName || 'Valued User');
            setUserUsername(data.username || null);
            setUserAvatarIcon(data.avatarIcon || DEFAULT_AVATAR.icon);
            setUserAvatarColor(data.avatarColor || DEFAULT_AVATAR.color);
            setUserSchoolId(data.schoolId || null);
            setUserScores(Array.isArray(data.scores) ? data.scores : []);

            // Determine registration date; if missing, set it now
            const toMs = (val: any): number | null => {
              if (!val) return null;
              if (typeof val === 'number') return val;
              if (typeof val === 'string') {
                const t = Date.parse(val);
                return isNaN(t) ? null : t;
              }
              if (val instanceof Date) return val.getTime();
              if (typeof val === 'object' && 'toDate' in val && typeof (val as any).toDate === 'function') {
                try { return (val as any).toDate().getTime(); } catch { return null; }
              }
              return null;
            };
            const createdAtMs = toMs(data.createdAt);
            const createdStartMs = (() => {
              const base = createdAtMs ?? Date.now();
              const d = new Date(base);
              return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            })();
            setRegistrationStartMs(createdAtMs ? createdStartMs : null);

            if (!createdAtMs) {
              try {
                await updateDoc(userRef, { createdAt: new Date() } as any);
                setRegistrationStartMs(createdStartMs);
              } catch {}
            }
            // Read study plan from top-level or fallback to nested studyCommitment
            const commit = (data.studyCommitment || {}) as any;
            const pd = Array.isArray(data.practiceDays) && data.practiceDays.length === 7
              ? data.practiceDays
              : (Array.isArray(commit.practiceDays) && commit.practiceDays.length === 7 ? commit.practiceDays : undefined);
            const pt = Array.isArray(data.practiceTimes) && data.practiceTimes.length === 7
              ? data.practiceTimes
              : (Array.isArray(commit.practiceTimes) && commit.practiceTimes.length === 7 ? commit.practiceTimes : undefined);
            const gDate = typeof data.goalDate === 'string' && data.goalDate
              ? data.goalDate
              : (typeof commit.goalDate === 'string' ? commit.goalDate : undefined);
            const gScore = typeof data.goalScore === 'number'
              ? data.goalScore
              : (typeof commit.goalScore === 'number' ? commit.goalScore : undefined);
            if (pd) setPracticeDays(pd);
            if (pt) setPracticeTimes(pt);
            if (gDate) setGoalDate(gDate);
            if (typeof gScore === 'number') setGoalScore(gScore);
          } else {
            setUserName(u.displayName || 'Valued User');
            setUserUsername(null);
            setUserAvatarIcon(DEFAULT_AVATAR.icon);
            setUserAvatarColor(DEFAULT_AVATAR.color);
          }
        } catch {
          setUserName(u.displayName || 'Valued User');
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      if (!user || !app || !userSchoolId) {
        setAssignments([]);
        return;
      }
      try {
        const db = getFirestore(app);
        const assignmentsRef = collection(db, 'schools', userSchoolId, 'assignments');
        const snap = await getDocs(assignmentsRef);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const userId = user.uid;
        const filtered = list.filter((a: any) => {
             const scope = a?.assignedScope || { type: 'all' };
             if (String(scope?.type || 'all') === 'all') return true;
             const ids: string[] = Array.isArray(a?.studentIds) ? a.studentIds.map((x: any) => String(x)) : [];
             return ids.includes(userId);
        });
        setAssignments(filtered);
      } catch (e) {
        console.error("Failed to fetch assignments", e);
      }
    })();
  }, [user, app, userSchoolId]);

  const dateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    (async () => {
      if (!user || !app) return;
      try {
        const db = getFirestore(app);
        const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        const startMs = start.getTime();
        const endMs = end.getTime();
        const ref = collection(db, 'users', user.uid, 'history');
        const q = query(ref, where('answeredAtTs', '>=', startMs), where('answeredAtTs', '<', endMs), orderBy('answeredAtTs', 'asc'));
        const snap = await getDocs(q);
        const stats: Record<string, DayStats> = {};
        snap.docs.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const ts = d?.answeredAtTs;
          if (typeof ts !== 'number') return;
          const key = dateKey(new Date(ts));
          if (!stats[key]) stats[key] = { sessions: 0, totalSeconds: 0, correct: 0, total: 0 };
          stats[key].sessions += 1;
          stats[key].totalSeconds += typeof d?.timeSpent === 'number' ? d.timeSpent : 0;
          stats[key].correct += d?.correct ? 1 : 0;
          stats[key].total += 1;
        });
        setDayStats(stats);
      } catch {
        // ignore
      }
    })();
  }, [user, app, currentMonth]);

  const studiedDateKeys = useMemo(() => new Set(Object.keys(dayStats).filter(k => dayStats[k]?.sessions > 0)), [dayStats]);
  const studiedDateKeysSinceRegistration = useMemo(() => {
    const keys = Object.keys(dayStats).filter(k => dayStats[k]?.sessions > 0);
    if (!registrationStartMs) return new Set(keys);
    const filtered = keys.filter((k) => {
      const [y, m, d] = k.split('-').map((n) => parseInt(n, 10));
      const t = new Date(y, (m || 1) - 1, d || 1).getTime();
      return t >= registrationStartMs;
    });
    return new Set(filtered);
  }, [dayStats, registrationStartMs]);

  const goalDateKey = useMemo(() => {
    if (!goalDate) return undefined;
    const d = new Date(goalDate);
    if (isNaN(d.getTime())) return undefined;
    return dateKey(d);
  }, [goalDate]);

  const mtdSessions = useMemo(() => {
    if (!registrationStartMs) return Object.values(dayStats).reduce((a, b) => a + (b?.sessions || 0), 0);
    return Object.entries(dayStats).reduce((sum, [k, v]) => {
      const [y, m, d] = k.split('-').map((n) => parseInt(n, 10));
      const t = new Date(y, (m || 1) - 1, d || 1).getTime();
      return sum + (t >= registrationStartMs ? (v?.sessions || 0) : 0);
    }, 0);
  }, [dayStats, registrationStartMs]);
  const mtdMinutes = useMemo(() => {
    if (!registrationStartMs) return Math.round(Object.values(dayStats).reduce((a, b) => a + (b?.totalSeconds || 0), 0) / 60);
    const totalSeconds = Object.entries(dayStats).reduce((sum, [k, v]) => {
      const [y, m, d] = k.split('-').map((n) => parseInt(n, 10));
      const t = new Date(y, (m || 1) - 1, d || 1).getTime();
      return sum + (t >= registrationStartMs ? (v?.totalSeconds || 0) : 0);
    }, 0);
    return Math.round(totalSeconds / 60);
  }, [dayStats, registrationStartMs]);

  const activeStreak = useMemo(() => {
    // Count consecutive days up to today with at least one session
    let streak = 0;
    const today = new Date();
    const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    while (true) {
      const key = dateKey(cursor);
      if (studiedDateKeysSinceRegistration.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [studiedDateKeysSinceRegistration]);

  const daysToGoal = useMemo(() => {
    if (!goalDate) return undefined;
    const today = new Date();
    const goal = new Date(goalDate);
    const ms = goal.getTime() - today.getTime();
    return Math.max(0, Math.ceil(ms / 86400000));
  }, [goalDate]);

  const plannedDaysPerWeek = useMemo(() => practiceDays.filter(Boolean).length, [practiceDays]);
  const suggestedWeeklyMinutes = useMemo(() => plannedDaysPerWeek * 45, [plannedDaysPerWeek]);

  const formatMinutes = (m?: number) => {
    if (!m || m <= 0) return '0 min';
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return h > 0 ? `${h}h ${mins}m` : `${mins}m`;
  };

  const intensityClass = (seconds?: number) => {
    const s = seconds || 0;
    if (s === 0) return '';
    if (s < 600) return 'bg-emerald-50';        // <10 min
    if (s < 1800) return 'bg-emerald-100';      // <30 min
    if (s < 3600) return 'bg-emerald-200';      // <60 min
    return 'bg-emerald-300';                    // 60+ min
  };

  // Custom Month Grid
  const MonthGrid: React.FC = useCallback(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: Array<{ date: Date; inMonth: boolean }>[] = [];
    let current = 1;
    let nextMonthCurrent = 1;
    // Build 6 weeks (rows)
    for (let week = 0; week < 6; week++) {
      const row: Array<{ date: Date; inMonth: boolean }> = [];
      for (let dow = 0; dow < 7; dow++) {
        let dayNum: number;
        let inMonth = true;
        let cellDate: Date;
        if (week === 0 && dow < firstDow) {
          dayNum = prevMonthDays - (firstDow - dow - 1);
          inMonth = false;
          cellDate = new Date(year, month - 1, dayNum);
        } else if (current > daysInMonth) {
          dayNum = nextMonthCurrent++;
          inMonth = false;
          cellDate = new Date(year, month + 1, dayNum);
        } else {
          dayNum = current++;
          cellDate = new Date(year, month, dayNum);
        }
        row.push({ date: cellDate, inMonth });
      }
      cells.push(row);
    }

    const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    const AdherenceBadge: React.FC<{ planned: boolean; studied: boolean }> = ({ planned, studied }) => {
      if (planned && studied) return <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5">Completed</span>;
      if (planned && !studied) return <span className="text-[10px] font-medium text-rose-700 bg-rose-100 rounded px-1.5 py-0.5">Missed</span>;
      if (!planned && studied) return <span className="text-[10px] font-medium text-sky-700 bg-sky-100 rounded px-1.5 py-0.5">Bonus</span>;
      return null;
    };

    const renderCell = (d: Date, inMonth: boolean) => {
      const key = dateKey(d);
      const studied = studiedDateKeysSinceRegistration.has(key);
      const isGoal = goalDateKey === key;
      const stats = dayStats[key];
      const weekday = d.getDay();
      const planned = !!practiceDays[weekday];
      const time = practiceTimes[weekday] || '';
      const accuracy = stats?.total ? Math.round((stats.correct / stats.total) * 100) : 0;
      const minutes = Math.round((stats?.totalSeconds || 0) / 60);
      const today = new Date();
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isFuture = d.getTime() > todayMid.getTime();
      const isBeforeRegistration = registrationStartMs ? (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() < registrationStartMs) : false;
      const treatAsFuture = isFuture || isBeforeRegistration;
      
      const dueAssignments = assignments.filter((a: any) => {
        if (!a.dueAt) return false;
        // Adjust for timezone if necessary, but assuming dateKey uses local time and dueAt is UTC timestamp or similar
        const dObj = new Date(a.dueAt);
        return dateKey(dObj) === key;
      });

      const scoresOnDate = userScores.filter((s: any) => s.testDate === key);

      const content = (
        <div className={cn(
          'relative h-24 rounded-xl border p-2 overflow-hidden transition-shadow hover:shadow-md flex flex-col',
          inMonth ? 'bg-card' : 'bg-muted/40',
        )}>
          <div className={cn('absolute inset-0 pointer-events-none rounded-xl', intensityClass(treatAsFuture ? 0 : stats?.totalSeconds))} />
          <div className="relative z-10 flex flex-col gap-1 w-full h-full">
            <div className="flex items-center justify-between text-xs shrink-0">
              <span className={cn(
                'font-medium inline-flex items-center justify-center',
                new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === todayMid.getTime()
                  ? 'h-5 w-5 rounded-full bg-red-600 text-white'
                  : (inMonth ? '' : 'text-muted-foreground')
              )}>{d.getDate()}</span>
              <div className="flex items-center gap-1">
                {planned && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" />{time}</span>
                )}
                {studied && <Check className="h-3 w-3 text-emerald-600" />}
                {isGoal && <Star className="h-3 w-3 text-amber-500" />}
              </div>
            </div>
            
            <div className="mt-1 shrink-0">
              {treatAsFuture ? (
                planned ? <span className="text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">Planned</span> : null
              ) : (
                <AdherenceBadge planned={planned} studied={studied} />
              )}
            </div>

            <div className="mt-auto flex flex-col gap-1 overflow-hidden">
              {scoresOnDate.map((s, idx) => (
                <div key={`score-${idx}`} className="text-[10px] truncate bg-amber-100 text-amber-800 px-1 py-0.5 rounded border border-amber-200 font-medium" title={`Score: ${s.math + s.readingAndWriting} (${s.testType})`}>
                  {s.math + s.readingAndWriting} {s.testType === 'official' ? 'SAT' : 'Prac'}
                </div>
              ))}
              {dueAssignments.slice(0, 2).map((a) => (
                <div key={a.id} className="text-[10px] truncate bg-primary/10 text-primary px-1 py-0.5 rounded border border-primary/20" title={a.title}>
                  {a.title}
                </div>
              ))}
              {dueAssignments.length > 2 && (
                <div className="text-[10px] text-muted-foreground pl-1">+{dueAssignments.length - 2} more</div>
              )}
            </div>
          </div>
        </div>
      );

      const goToHistory = () => {
        // Navigate to history with anchor for this day
        const url = `/history#day-${key}`;
        router.push(url);
      };

      if (!inMonth && !stats && !planned && !isGoal) return (
        <div onClick={goToHistory} className="cursor-pointer">{content}</div>
      );
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div onClick={goToHistory} className="cursor-pointer">{content}</div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1">
                <div className="font-medium">{d.toLocaleDateString()}</div>
                {!treatAsFuture && (
                  <>
                    <div>Sessions: {stats?.sessions || 0}</div>
                    <div>Time: {formatMinutes(minutes)}</div>
                    <div>Accuracy: {accuracy}%</div>
                  </>
                )}
                {planned && <div>Planned time: {time || '—'}</div>}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    };

    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xl font-semibold">{currentMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 mb-1">
          {weekdays.map((w) => (
            <div key={w} className="text-xs text-muted-foreground text-center uppercase tracking-wide">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((row, i) => (
            <div key={`week-${i}`} className="contents">
              {row.map(({ date, inMonth }, j) => (
                <div key={`cell-${i}-${j}-${date.getTime()}`}>{renderCell(date, inMonth)}</div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-600" /> Studied</span>
          <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" /> SAT Goal</span>
          <span className="flex items-center gap-2">
            Intensity:
            <span className="h-2.5 w-4 rounded bg-emerald-50 border" />
            <span className="h-2.5 w-4 rounded bg-emerald-100 border" />
            <span className="h-2.5 w-4 rounded bg-emerald-200 border" />
            <span className="h-2.5 w-4 rounded bg-emerald-300 border" />
          </span>
        </div>
      </div>
    );
  }, [currentMonth, dayStats, studiedDateKeysSinceRegistration, goalDateKey, practiceDays, practiceTimes, registrationStartMs]);

  const buildIcs = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
    const uid = () => Math.random().toString(36).slice(2);

    const upcomingWeekStart = (() => {
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // Start next day to avoid past times today
      d.setDate(d.getDate() + 1);
      return d;
    })();

    const weekdayToIcs = ['SU','MO','TU','WE','TH','FR','SA'];
    const events: string[] = [];

    for (let i = 0; i < 7; i++) {
      if (!practiceDays[i]) continue;
      const time = practiceTimes[i] || '20:00';
      const [hh, mm] = time.split(':').map(n => parseInt(n, 10));
      // Find next date matching weekday i
      const start = new Date(upcomingWeekStart);
      while (start.getDay() !== i) start.setDate(start.getDate() + 1);
      start.setHours(hh || 20, mm || 0, 0, 0);
      const end = new Date(start.getTime() + 45 * 60000); // default 45 min

      const dtStart = fmt(start);
      const dtEnd = fmt(end);
      const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${weekdayToIcs[i]};COUNT=12`;
      events.push([
        'BEGIN:VEVENT',
        `UID:${uid()}@cultivated.study`,
        `DTSTAMP:${fmt(new Date())}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        'SUMMARY:CultivatED Study Session',
        rrule,
        'END:VEVENT',
      ].join('\n'));
    }

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CultivatED//Calendar//EN',
      ...events,
      'END:VCALENDAR',
    ].join('\n');
    return ics;
  };

  const downloadIcs = () => {
    const ics = buildIcs();
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cultivated-study-schedule.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const enableNotifications = async () => {
    try {
      if (!('Notification' in window)) return;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;

      // Clear previous timers
      notificationTimers.current.forEach((t) => window.clearTimeout(t));
      notificationTimers.current = [];

      // Schedule next practice for each planned day within next 7 days
      const now = new Date();
      for (let offset = 0; offset < 7; offset++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        const dow = d.getDay();
        if (!practiceDays[dow]) continue;
        const [hh, mm] = (practiceTimes[dow] || '20:00').split(':').map(n => parseInt(n, 10));
        d.setHours(hh || 20, mm || 0, 0);
        const delay = d.getTime() - now.getTime();
        if (delay <= 0) continue;
        const id = window.setTimeout(() => {
          new Notification('Study reminder', { body: 'Time for your CultivatED practice session.' });
        }, Math.min(delay, 2147483647)); // cap at max setTimeout
        notificationTimers.current.push(id);
      }
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="min-h-screen ambient-bg">
        <Sidebar 
          user={user}
          userName={userName}
          userUsername={userUsername}
          userAvatarIcon={userAvatarIcon}
          userAvatarColor={userAvatarColor}
        />
        <div className={cn(
          'transition-all duration-300 ease-in-out',
          isSidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
        )}>
          <div className="py-6 px-4 md:py-8 md:pr-8 md:pl-14 xl:pl-16">
            <PageHeader title="Calendar" />
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 py-4">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Study Calendar</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonthGrid />
                  <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-600" /> Studied</span>
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" /> SAT Goal</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Weekly Plan & Goal</CardTitle>
              </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">Loading…</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar 
        user={user}
        userName={userName}
        userUsername={userUsername}
        userAvatarIcon={userAvatarIcon}
        userAvatarColor={userAvatarColor}
      />

      <div className={cn(
        'transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
      )}>
        <div className="py-6 px-4 md:py-8 md:pr-8 md:pl-14 xl:pl-16">
          <PageHeader title="Calendar" />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Study Calendar</CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={downloadIcs}><Download className="h-4 w-4 mr-2" /> Add to Calendar (ICS)</Button>
                  <Button size="sm" variant="ghost" onClick={enableNotifications}><Bell className="h-4 w-4 mr-2" /> Enable reminders</Button>
                </div>
              </CardHeader>
              <CardContent>
                <MonthGrid />
              </CardContent>
            </Card>
            <div className="lg:col-span-1 space-y-4">
              {/* Compact metrics above weekly plan */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="py-3">
                    <div className="text-[10px] text-muted-foreground">Month-to-date Sessions</div>
                    <div className="text-xl font-semibold">{mtdSessions}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3">
                    <div className="text-[10px] text-muted-foreground">Month-to-date Minutes</div>
                    <div className="text-xl font-semibold">{formatMinutes(mtdMinutes)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3">
                    <div className="text-[10px] text-muted-foreground">Active Streak</div>
                    <div className="text-xl font-semibold">{activeStreak} day{activeStreak === 1 ? '' : 's'}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3">
                    <div className="text-[10px] text-muted-foreground">Days to Goal</div>
                    <div className="text-xl font-semibold">{daysToGoal ?? '—'}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Plan & Goal */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Weekly Plan & Goal</CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">Suggested weekly minutes: {suggestedWeeklyMinutes}</div>
                  </div>
                  {!editing ? (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="default" disabled={saving} onClick={async () => {
                        if (!user || !app) return;
                        setSaving(true);
                        try {
                          const db = getFirestore(app);
                          await updateDoc(doc(db, 'users', user.uid), {
                            practiceDays,
                            practiceTimes,
                            goalDate: goalDate || null,
                            goalScore: goalScore === '' ? null : Number(goalScore)
                          } as any);
                          setEditing(false);
                        } catch (e) {
                          // ignore for now
                        } finally {
                          setSaving(false);
                        }
                      }}>
                        <Save className="h-4 w-4 mr-2" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                        <X className="h-4 w-4 mr-2" /> Cancel
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {!editing ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-medium mb-1">Weekly Study Days</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
                            <div key={d} className="border rounded-md px-3 py-2">
                              <div className="flex items-center justify-between">
                                <span>{d}</span>
                                {practiceDays[i] && <Check className="h-3 w-3 text-emerald-600" />}
                              </div>
                              <div className="text-muted-foreground text-[11px] mt-0.5">{practiceDays[i] ? (practiceTimes[i] || '—') : '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-sm font-medium mb-1">SAT Goal Score</div>
                          <div className="text-muted-foreground">{goalScore || '—'}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium mb-1">SAT Goal Date</div>
                          <div className="text-muted-foreground">{goalDate || '—'}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div>
                        <div className="text-sm font-medium mb-2">Weekly Study Plan</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((label, i) => (
                            <div key={label} className="border rounded-md px-3 py-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={!!practiceDays[i]}
                                  onChange={(e) => {
                                    const next = [...practiceDays];
                                    next[i] = e.target.checked;
                                    setPracticeDays(next);
                                  }}
                                />
                                <Label className="text-sm">{label}</Label>
                              </div>
                              <div className="mt-2">
                                <Input
                                  type="time"
                                  value={practiceTimes[i] || ''}
                                  onChange={(e) => {
                                    const next = [...practiceTimes];
                                    next[i] = e.target.value;
                                    setPracticeTimes(next);
                                  }}
                                  className="w-28"
                                  disabled={!practiceDays[i]}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm" htmlFor="goalScore">SAT Goal Score</Label>
                          <Input id="goalScore" type="number" value={goalScore} onChange={(e) => setGoalScore(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g., 1400" />
                        </div>
                        <div>
                          <Label className="text-sm" htmlFor="goalDate">SAT Goal Date</Label>
                          <Input id="goalDate" type="date" value={goalDate || ''} onChange={(e) => setGoalDate(e.target.value)} />
                        </div>
                      </div>
              </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



