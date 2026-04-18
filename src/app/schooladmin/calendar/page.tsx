"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, app, db } from "@/lib/firebaseClient";
import { getFirestore, collection, getDocs, doc, getDoc, where, query, orderBy } from "firebase/firestore";
import { Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitle, DialogFooter, Input, Label, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";
import { Loading } from "@/components/ui/loading";
import { toast } from "sonner";

type Claims = { role?: string; schoolId?: string };

type DayRow = { id: string; seconds: number; uniques: number };

export default function SchoolCalendarPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [days, setDays] = useState<DayRow[]>([]);
  const [granularity, setGranularity] = useState<'week' | 'month'>("week");
  const [selectedDay, setSelectedDay] = useState<DayRow | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [breaks, setBreaks] = useState<Set<string>>(new Set());
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [hourly, setHourly] = useState<Array<{ hour: number; minutes: number }>>([]);
  const [classMinutes, setClassMinutes] = useState<Array<{ name: string; minutes: number }>>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth as any, async (user) => {
      if (!user) { router.replace('/login'); return; }
      const idTok = await user.getIdTokenResult(true);
      const claims = (idTok.claims || {}) as Claims;
      if (!claims.schoolId || !['schoolAdmin','teacher'].includes(String(claims.role || ''))) { router.replace('/dashboard'); return; }
      setAuthorized(true);
      setChecking(false);
      setSchoolId(String(claims.schoolId));
      if (!app) return;
      const daysCol = collection(db, 'schools', String(claims.schoolId), 'metrics', 'daily', 'days');
      const snap = await getDocs(daysCol).catch(() => null);
      const rows: DayRow[] = [];
      if (snap) {
        snap.docs.forEach((d) => {
          const v = d.data() as any;
          rows.push({ id: d.id, seconds: Number(v?.secondsStudied || 0), uniques: Number(v?.uniqueStudentsCount || 0) });
        });
      }
      rows.sort((a, b) => a.id.localeCompare(b.id));
      setDays(rows);

      // Load any saved overlays (notes/breaks) from school doc
      try {
        const sSnap = await getDoc(doc(db, 'schools', String(claims.schoolId)));
        const data = sSnap.exists() ? (sSnap.data() as any) : {};
        const n = (data?.calendarNotes || {}) as Record<string, string>;
        const b = Array.isArray(data?.calendarBreaks) ? new Set<string>(data.calendarBreaks) : new Set<string>();
        setNotes(n);
        setBreaks(b);
      } catch {}
    });
    return () => unsub?.();
  }, [router]);

  useEffect(() => {
    (async () => {
      if (!selectedDay || !app || !schoolId) return;
      try {
        setLoadingDay(true);
        // Fetch all students in the school
        const usersSnap = await getDocs(query(collection(db, 'users'), where('schoolId', '==', schoolId)));
        const start = new Date(selectedDay.id);
        const parts = selectedDay.id.split('-').map((n) => parseInt(n, 10));
        const dayStart = new Date(parts[0], (parts[1]||1)-1, parts[2]||1, 0, 0, 0, 0).getTime();
        const dayEnd = new Date(parts[0], (parts[1]||1)-1, parts[2]||1, 23, 59, 59, 999).getTime();
        const hourMap = new Map<number, number>();
        const classMap = new Map<string, number>();
        for (let h = 0; h < 24; h++) hourMap.set(h, 0);
        // Iterate users and read history for the day
        for (const u of usersSnap.docs) {
          const data = u.data() as any;
          const role = String(data?.role || '').toLowerCase();
          if (role === 'schooladmin' || role === 'teacher') continue;
          const klass = (typeof data?.class === 'string' && data.class) ? data.class : (typeof data?.section === 'string' ? data.section : 'Unknown');
          const histCol = collection(db, 'users', u.id, 'history');
          const qy = query(histCol, where('answeredAtTs', '>=', dayStart), where('answeredAtTs', '<=', dayEnd), orderBy('answeredAtTs', 'asc'));
          const hs = await getDocs(qy).catch(() => null);
          if (!hs) continue;
          let minutesForClass = 0;
          hs.docs.forEach((docSnap) => {
            const d = docSnap.data() as any;
            const ts = Number(d?.answeredAtTs || 0);
            const spent = Math.max(0, Number(d?.timeSpent || 0));
            if (!ts || spent <= 0) return;
            const hour = new Date(ts).getHours();
            hourMap.set(hour, (hourMap.get(hour) || 0) + Math.round(spent/60));
            minutesForClass += Math.round(spent/60);
          });
          classMap.set(klass, (classMap.get(klass) || 0) + minutesForClass);
        }
        setHourly(Array.from(hourMap.entries()).map(([hour, minutes]) => ({ hour, minutes })));
        setClassMinutes(Array.from(classMap.entries()).map(([name, minutes]) => ({ name, minutes })).sort((a,b) => b.minutes - a.minutes));
      } finally {
        setLoadingDay(false);
      }
    })();
  }, [selectedDay, app, schoolId]);

  const chartData = useMemo(() => days.map((d) => ({ date: d.id, minutes: Math.round(d.seconds/60), actives: d.uniques })), [days]);
  const weekly = useMemo(() => {
    // group by ISO week (YYYY-WW)
    const group = new Map<string, { week: string; minutes: number; actives: number }>();
    chartData.forEach((d) => {
      const [y, m, day] = d.date.split('-').map(n => parseInt(n, 10));
      const ww = weekKey(new Date(y, (m||1)-1, day||1));
      const prev = group.get(ww) || { week: ww, minutes: 0, actives: 0 };
      group.set(ww, { week: ww, minutes: prev.minutes + d.minutes, actives: prev.actives + d.actives });
    });
    return Array.from(group.values()).sort((a,b) => a.week.localeCompare(b.week));
  }, [chartData]);

  if (checking) return <div className="flex h-[50vh] items-center justify-center"><Loading /></div>;
  if (!authorized) return null;

  const fmt = (s: number) => {
    const m = Math.round(s/60);
    const h = Math.floor(m/60);
    const mm = m%60;
    return h>0 ? `${h}h ${mm}m` : `${m}m`;
  };

  function weekKey(date: Date) {
    const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = tmp.getUTCDay() || 7; tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((tmp as any) - (yearStart as any)) / 86400000 + 1)/7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`;
  }

  const config = {
    minutes: { label: 'Minutes', color: 'hsl(142, 70%, 45%)' },
    actives: { label: 'Active students', color: 'hsl(210, 70%, 50%)' },
  } as const;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Calendar</h1>
        <p className="text-muted-foreground mb-6">Minutes and active students over time, with drill-down.</p>
      </div>

      {/* Toggle granularity */}
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" variant={granularity==='week'?'default':'outline'} onClick={() => setGranularity('week')}>Week</Button>
        <Button size="sm" variant={granularity==='month'?'default':'outline'} onClick={() => setGranularity('month')}>Month</Button>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>{granularity==='week' ? 'Weekly totals' : 'Daily totals'}</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={config as any} className="h-64 w-full">
            {granularity === 'week' ? (
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend content={<ChartLegendContent />} />
                <Bar dataKey="minutes" fill={config.minutes.color} yAxisId="left" name="Minutes" />
                <Bar dataKey="actives" fill={config.actives.color} yAxisId="right" name="Active students" />
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="minutes" stroke={config.minutes.color} yAxisId="left" dot={false} name="Minutes" />
                <Line type="monotone" dataKey="actives" stroke={config.actives.color} yAxisId="right" dot={false} name="Active students" />
              </LineChart>
            )}
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Heatmap-like month grid */}
      <Card>
        <CardHeader><CardTitle>Heatmap</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const minutes = Math.round(d.seconds/60);
              const level = minutes === 0 ? 'bg-muted/30' : minutes < 10 ? 'bg-emerald-50 dark:bg-emerald-950/30' : minutes < 30 ? 'bg-emerald-100 dark:bg-emerald-900/40' : minutes < 60 ? 'bg-emerald-200 dark:bg-emerald-800/50' : 'bg-emerald-300 dark:bg-emerald-700/60';
              const isBreak = breaks.has(d.id);
              return (
              <div key={d.id} className={`p-2 rounded border transition-all hover:scale-105 cursor-pointer ${level} ${isBreak ? 'ring-2 ring-amber-400' : ''}`} title={`${d.id}: ${minutes}m, ${d.uniques} active`}
                onClick={() => setSelectedDay(d)}>
                  <div className="text-[10px] text-muted-foreground">{d.id.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Drill-down dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent>
          <DialogHeader><UIDialogTitle>Details for {selectedDay?.id}</UIDialogTitle></DialogHeader>
          {selectedDay && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
                 <div>Minutes: <strong>{fmt(selectedDay.seconds)}</strong></div>
                 <div>Active students: <strong>{selectedDay.uniques}</strong></div>
              </div>
              {/* Hourly distribution */}
              <div>
                <div className="text-xs text-muted-foreground mb-1 font-medium">Hourly distribution</div>
                <ChartContainer config={{ minutes: { label: 'Minutes', color: 'hsl(142, 70%, 45%)' } } as any} className="h-40 w-full">
                  <BarChart data={hourly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hour" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="minutes" fill={'hsl(142, 70%, 45%)'} name="Minutes" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
              {/* Top/bottom classes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-md p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Top classes</div>
                  <ul className="text-sm space-y-1">
                    {classMinutes.slice(0,3).map((c) => <li key={c.name} className="flex justify-between"><span className="truncate mr-2 max-w-[120px]">{c.name || 'Unknown'}</span><span className="font-mono text-xs">{c.minutes}m</span></li>)}
                    {classMinutes.length === 0 && <li className="text-xs text-muted-foreground italic">No data</li>}
                  </ul>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Bottom classes</div>
                  <ul className="text-sm space-y-1">
                    {[...classMinutes].reverse().slice(0,3).map((c) => <li key={c.name+':b'} className="flex justify-between"><span className="truncate mr-2 max-w-[120px]">{c.name || 'Unknown'}</span><span className="font-mono text-xs">{c.minutes}m</span></li>)}
                    {classMinutes.length === 0 && <li className="text-xs text-muted-foreground italic">No data</li>}
                  </ul>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Note for this day</Label>
                <Input value={notes[selectedDay.id] || ''} onChange={(e) => setNotes((p) => ({ ...p, [selectedDay.id!]: e.target.value }))} placeholder="Add a note (local only)" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="rounded border-input" checked={breaks.has(selectedDay.id)} onChange={(e) => setBreaks((prev) => {
                    const n = new Set(prev); if (e.target.checked) n.add(selectedDay.id!); else n.delete(selectedDay.id!); return n; })} />
                  Mark as school break/testing day
                </label>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setSelectedDay(null)}>Close</Button>
            <Button variant="outline" onClick={async () => {
              if (!app || !schoolId || !selectedDay) return;
              try {
                // Persist overlays to school doc
                await (await import('firebase/firestore')).updateDoc(doc(db, 'schools', String(schoolId)), {
                  calendarNotes: notes,
                  calendarBreaks: Array.from(breaks),
                } as any);
                toast.success('Saved');
              } catch {}
            }}>Save overlays</Button>
            <Button onClick={() => { if (selectedDay) router.push(`/schooladmin/students?preset=all&date=${selectedDay.id}`); }}>View Students</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
