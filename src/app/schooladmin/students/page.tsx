"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, app, db } from "@/lib/firebaseClient";
import { collection, getDocs, query, where, doc, getDoc, setDoc } from "firebase/firestore";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge } from "@/components";
import { StudentDetailModal } from "@/components/school-admin/student-detail-modal";
import { satScoreToMasteryPercent } from "../../../lib/utils/satToMastery";
import { toast } from "sonner";
import { Loading } from "@/components/ui/loading";
import { getFunctions, httpsCallable } from "firebase/functions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


type Claims = { role?: string; schoolId?: string };

type Row = {
  id: string;
  name?: string;
  email?: string;
  minutesThisWeek?: number;
  lastActive?: string; // YYYY-MM-DD
  accuracy7d?: number; // 0..1
  streak?: number; // consecutive days including today
  mastery?: number; // 0..100 if derivable
  classSection?: string | null;
  activeOnDate?: boolean;
};

function StudentsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [schoolSlug, setSchoolSlug] = useState<string>("");
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [schoolId, setSchoolId] = useState<string | null>(null);

  // Column chooser state
  const [visibleCols, setVisibleCols] = useState<{ [k: string]: boolean }>({
    name: true,
    email: true,
    minutes: true,
    lastActive: true,
    accuracy: true,
    streak: true,
    mastery: true,
    classSection: true,
  });
  const [sortKey, setSortKey] = useState<keyof Row | 'minutesThisWeek'>("minutesThisWeek");
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [qrOpen, setQrOpen] = useState(false);
  const [joinCount, setJoinCount] = useState<number | null>(null);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [origin, setOrigin] = useState<string>('');
  const [classes, setClasses] = useState<string[]>([]);
  const [manageClassesOpen, setManageClassesOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [assignClassName, setAssignClassName] = useState<string>('');
  
  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [detailStudentName, setDetailStudentName] = useState("");
  
  // Bulk actions
  const [showBulkRemove, setShowBulkRemove] = useState(false);
  const [isBulkRemoving, setIsBulkRemoving] = useState(false);

  useEffect(() => { setOrigin(typeof window !== 'undefined' ? window.location.origin : ''); }, []);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth as any, async (user) => {
      if (!user) { router.replace('/login'); return; }
      const idTok = await user.getIdTokenResult(true);
      const claims = (idTok.claims || {}) as Claims;
      if (!claims.schoolId || !['schoolAdmin','teacher'].includes(String(claims.role || ''))) { router.replace('/dashboard'); return; }
      setSchoolId(String(claims.schoolId));
      setAuthorized(true);
      setChecking(false);
      if (!app) return;
      const qUsers = query(collection(db, 'users'), where('schoolId', '==', String(claims.schoolId)));
      const snap = await getDocs(qUsers).catch(() => null);
      // Load declared classes list (schools/{sid}/classes)
      try {
        const cSnap = await getDocs(collection(db, 'schools', String(claims.schoolId), 'classes'));
        const names = cSnap.docs.map((d) => String(((d.data() as any)?.name || '')).trim()).filter(Boolean);
        setClasses(Array.from(new Set(names)));
      } catch {}
      // Resolve school slug and exclusion lists for admins/teachers
      let excludedLocal = new Set<string>();
      try {
        const schoolDoc = await getDoc(doc(db, 'schools', String(claims.schoolId)));
        const sdata = schoolDoc.exists() ? (schoolDoc.data() as any) : {};
        setSchoolSlug(typeof sdata?.slug === 'string' ? sdata.slug : '');
        const adminUids: string[] = Array.isArray(sdata?.adminUids) ? sdata.adminUids : [];
        const teacherUids: string[] = Array.isArray(sdata?.teacherUids) ? sdata.teacherUids : [];
        excludedLocal = new Set<string>([...adminUids, ...teacherUids].map((x) => String(x)));
        setExcludedIds(excludedLocal);
      } catch {}
      const today = new Date();
      const start = new Date(today); start.setDate(today.getDate() - 6);
      const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const keys = Array.from({ length: 7 }).map((_, i) => { const d = new Date(start); d.setDate(start.getDate()+i); return toKey(d); });
      const out: Row[] = [];
      if (snap) {
        for (const d of snap.docs) {
          const u = d.data() as any;
          // Exclude school admins and teachers from the students list
          const role = String(u?.role || '').toLowerCase();
          if (role === 'schooladmin' || role === 'teacher') continue;
          if (excludedLocal.has(d.id)) continue;
          let minutes = 0;
          let q = 0, c = 0;
          let lastActiveKey: string | null = null;
          // streak: count consecutive days (up to 30) ending today
          let streak = 0;
          try {
            const daysCol = collection(db, 'users', d.id, 'metrics', 'daily', 'days');
            const ds = await getDocs(daysCol).catch(() => null);
            if (ds) {
              const allKeys = ds.docs.map((s) => s.id).sort();
              ds.docs.forEach((doc) => {
                const id = doc.id;
                const data = doc.data() as any;
                if (keys.includes(id)) {
                  minutes += Math.round((Number(data?.secondsStudied || 0))/60);
                  q += Number(data?.questionsAnswered || 0);
                  c += Number(data?.correct || 0);
                }
                if (Number(data?.secondsStudied || 0) > 0) {
                  if (!lastActiveKey || id > lastActiveKey) lastActiveKey = id;
                }
              });
              // compute streak
              const todayKey = toKey(today);
              const backDays: string[] = [];
              for (let i = 0; i < 30; i++) {
                const d0 = new Date(today); d0.setDate(today.getDate() - i);
                backDays.push(toKey(d0));
              }
              for (const k of backDays) {
                const found = allKeys.includes(k) && (Number(((ds.docs.find(x => x.id === k)?.data() as any)?.secondsStudied || 0)) > 0);
                if (found) streak += 1; else break;
              }
            }
          } catch {}
          // mastery from latest score, if present
          let mastery: number | undefined = undefined;
          try {
            const scores: any[] = Array.isArray(u?.scores) ? u.scores : [];
            if (scores.length > 0) {
              const latest = scores[scores.length - 1];
              const math = Number(latest?.math || 0);
              const rw = Number(latest?.readingAndWriting || 0);
              if (math || rw) {
                const m1 = satScoreToMasteryPercent(Math.max(200, Math.min(800, math || 0)) * 2);
                const m2 = satScoreToMasteryPercent(Math.max(200, Math.min(800, rw || 0)) * 2);
                mastery = Math.round((m1 + m2) / 2);
              }
            }
          } catch {}
          const acc = q > 0 ? c / q : undefined;
          const classSection = typeof u?.class === 'string' && u.class ? u.class : (typeof u?.section === 'string' ? u.section : null);
          // active on specific date filter
          let activeOnDate = false;
          const dateParam = (searchParams?.get('date') || '').trim();
          if (dateParam) {
            try {
              const ds = await getDocs(collection(db, 'users', d.id, 'metrics', 'daily', 'days')).catch(() => null);
              if (ds) {
                const match = ds.docs.find((x) => x.id === dateParam);
                if (match) activeOnDate = Number(((match.data() as any)?.secondsStudied || 0)) > 0;
              }
            } catch {}
          }
          out.push({ id: d.id, name: String(u?.name || ''), email: String(u?.email || ''), minutesThisWeek: minutes, accuracy7d: acc, lastActive: lastActiveKey || undefined as any, streak, mastery, classSection, activeOnDate });
        }
      }
      setRows(out);

      // Join count via slug
      try {
        if (schoolSlug) {
          const joinedSnap = await getDocs(query(collection(db, 'users'), where('referrerUsername', '==', schoolSlug), where('schoolId', '==', String(claims.schoolId))));
          const count = joinedSnap.docs.filter((d) => {
            const u = d.data() as any; const role = String(u?.role || '').toLowerCase();
            return role !== 'schooladmin' && role !== 'teacher';
          }).length;
          setJoinCount(count);
        }
      } catch {}
    });
    return () => unsub?.();
  }, [router]);

  // Apply preset filters from overview links
  const preset = (searchParams?.get('preset') || '').toLowerCase();
  const today = new Date();
  const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayKey = toKey(today);

  const filtered = rows
    .filter((r) => (r.name || '').toLowerCase().includes(filter.toLowerCase()) || (r.email || '').toLowerCase().includes(filter.toLowerCase()))
    .filter((r) => {
      if (!preset) return true;
      if (preset === 'inactive7') {
        if (!r.lastActive) return true;
        const [y, m, d] = String(r.lastActive).split('-').map((n) => parseInt(n, 10));
        const last = new Date(y, (m || 1) - 1, d || 1);
        const diffDays = Math.floor((Date.now() - last.getTime()) / 86400000);
        return diffDays >= 7;
      }
      if (preset === 'lowaccuracy') {
        return (r.accuracy7d ?? 1) < 0.6;
      }
      if (preset === 'missingtoday') {
        // we don't have per-day seconds here, approximate: minutesThisWeek == 0 implies missing today as well
        return (r.minutesThisWeek || 0) === 0;
      }
      return true;
    })
    .filter((r) => classFilter === 'all' ? true : String(r.classSection || 'Unknown') === classFilter);

  const classOptions = useMemo(() => {
    const set = new Set<string>(classes);
    rows.forEach((r) => set.add(String(r.classSection || 'Unknown')));
    return ['all', ...Array.from(set)];
  }, [rows, classes]);

  const classSubtotalsBadges = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => { const k = String(r.classSection || 'Unknown'); map.set(k, (map.get(k) || 0) + (r.minutesThisWeek || 0)); });
    return Array.from(map.entries()).map(([k, v]) => (
      <Badge key={k} className="bg-card border">{k}: {v}m</Badge>
    ));
  }, [filtered]);

  if (checking) return <div className="flex h-[50vh] items-center justify-center"><Loading /></div>;
  if (!authorized) return null;

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const get = (r: Row) => {
      switch (sortKey) {
        case 'minutesThisWeek': return r.minutesThisWeek || 0;
        case 'name': return (r.name || '').toLowerCase();
        case 'email': return (r.email || '').toLowerCase();
        case 'lastActive': return r.lastActive || '';
        case 'streak': return r.streak || 0;
        case 'accuracy7d': return r.accuracy7d || 0;
        case 'mastery': return r.mastery || 0;
        case 'classSection': return (r.classSection || '').toLowerCase();
        default: return (r as any)[sortKey] || 0;
      }
    };
    const va = get(a); const vb = get(b);
    if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb);
    return dir * String(va).localeCompare(String(vb));
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = sorted.slice((page - 1) * pageSize, page * pageSize);

  const joinLink = schoolSlug ? `${origin}/signup?ref=${schoolSlug}` : '';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Students</h1>
        <p className="text-muted-foreground mb-2">Roster of students in your school</p>
      </div>
      
      {schoolSlug && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm border border-border/50">
          <span className="font-medium">Student signup link:</span>
          <code className="px-2 py-0.5 rounded bg-muted font-mono text-xs select-all">{origin}/signup?ref={schoolSlug}</code>
          <Button size="sm" variant="ghost" className="h-7" onClick={async () => {
            try { await navigator.clipboard.writeText(joinLink); toast.success('Link copied'); } catch {}
          }}>Copy</Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setQrOpen(true)}>Show QR</Button>
          {typeof joinCount === 'number' && <span className="ml-auto text-muted-foreground text-xs">Joined via link: {joinCount}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Search</Label>
          <Input value={filter} onChange={(e) => { setPage(1); setFilter(e.target.value); }} placeholder="Filter by name or email" />
        </div>
        <div className="space-y-2">
          <Label>Class</Label>
          <Select value={classFilter} onValueChange={(v) => { setPage(1); setClassFilter(v); }}>
            <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              {classOptions.map((c) => (
                <SelectItem key={c} value={c}>{c === 'all' ? 'All' : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Page size</Label>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v, 10) || 25); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Page size" /></SelectTrigger>
            <SelectContent>
              {[10,25,50,100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
           {classSubtotalsBadges}
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-2">
             <Select value={assignClassName} onValueChange={setAssignClassName}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Assign class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!assignClassName || selectedRowIds.size===0} onClick={async () => {
              if (!app) return;
              const ids = Array.from(selectedRowIds);
              try {
                const fns = getFunctions(app as any, 'us-central1');
                const updateUser = httpsCallable(fns, 'schoolAdminUpdateUser');
                await Promise.all(ids.map((id) => updateUser({ uid: id, updates: { class: assignClassName } }).catch(() => null)));
              } catch {}
              // Refresh local state
              setRows((prev) => prev.map((r) => selectedRowIds.has(r.id) ? { ...r, classSection: assignClassName } : r));
              setSelectedRowIds(new Set());
              toast.success('Assigned to class');
            }}>Assign</Button>
          </div>
          
          <div className="flex items-center gap-2">
             <Button size="sm" variant="outline" onClick={() => {
                const target = selectedRowIds.size > 0 ? filtered.filter(r => selectedRowIds.has(r.id)) : filtered;
                const selectedEmails = target.filter(r => r.email).map(r => r.email);
                if (selectedEmails.length === 0) { toast.error("No emails found"); return; }
                window.location.href = `mailto:?bcc=${selectedEmails.join(',')}`;
             }}>
               Email {selectedRowIds.size > 0 ? 'Selected' : 'All'}
             </Button>
             <Button size="sm" variant="outline" onClick={() => {
                const header = ['Name', 'Email', 'Class', 'Minutes (7d)', 'Last Active', 'Accuracy (7d)', 'Streak', 'Mastery'];
                const csvRows = [header.join(',')];
                const target = selectedRowIds.size > 0 ? filtered.filter(r => selectedRowIds.has(r.id)) : filtered;
                target.forEach(r => {
                  const row = [
                    JSON.stringify(r.name || ''),
                    JSON.stringify(r.email || ''),
                    JSON.stringify(r.classSection || ''),
                    r.minutesThisWeek || 0,
                    r.lastActive || '',
                    r.accuracy7d ? (r.accuracy7d * 100).toFixed(1) + '%' : '',
                    r.streak || 0,
                    r.mastery ? r.mastery + '%' : ''
                  ];
                  csvRows.push(row.join(','));
                });
                const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `students-roster-${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
             }}>
               Download CSV
             </Button>
             <Button size="sm" variant="outline" onClick={() => setManageClassesOpen(true)}>Manage classes</Button>
             
             <Button 
               size="sm" 
               variant="destructive" 
               disabled={selectedRowIds.size === 0}
               onClick={() => setShowBulkRemove(true)}
             >
               Remove Selected
             </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showBulkRemove} onOpenChange={setShowBulkRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedRowIds.size} Students?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the selected students from the school?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (!app) return;
                setIsBulkRemoving(true);
                try {
                  const functions = getFunctions(app);
                  const leaveFn = httpsCallable(functions, 'leaveSchoolCallable');
                  const ids = Array.from(selectedRowIds);
                  // Execute in parallel (limit concurrency if needed, but <100 ok)
                  await Promise.allSettled(ids.map(id => leaveFn({ studentId: id })));
                  toast.success(`Removed ${ids.length} students`);
                  setSelectedRowIds(new Set());
                  setShowBulkRemove(false);
                  window.location.reload();
                } catch (e) {
                  console.error(e);
                  toast.error("Failed to remove some students");
                } finally {
                  setIsBulkRemoving(false);
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={isBulkRemoving}
            >
              {isBulkRemoving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Roster</CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground mt-2">
            {Object.keys(visibleCols).map((key) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                <input type="checkbox" className="rounded border-input" checked={!!visibleCols[key]} onChange={(e) => setVisibleCols((prev) => ({ ...prev, [key]: e.target.checked }))} />
                <span className="capitalize">{key === 'minutes' ? 'Minutes (7d)' : key.replace(/([A-Z])/g, ' $1').trim()}</span>
              </label>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left p-3 w-10"><input type="checkbox" checked={selectedRowIds.size>0 && current.every(r=>selectedRowIds.has(r.id))} onChange={(e)=>{
                      if (e.target.checked) setSelectedRowIds((prev)=> new Set([...prev, ...current.map(r=>r.id)])); else setSelectedRowIds((prev)=> { const next = new Set(prev); current.forEach(r=>next.delete(r.id)); return next; });
                    }} /></th>
                    {visibleCols.name && (
                      <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50" onClick={() => { setSortKey('name'); setSortDir(sortKey==='name' && sortDir==='asc' ? 'desc' : 'asc'); }}>Name</th>
                    )}
                    {visibleCols.email && (
                      <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50" onClick={() => { setSortKey('email'); setSortDir(sortKey==='email' && sortDir==='asc' ? 'desc' : 'asc'); }}>Email</th>
                    )}
                    {visibleCols.classSection && (
                      <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50" onClick={() => { setSortKey('classSection'); setSortDir(sortKey==='classSection' && sortDir==='asc' ? 'desc' : 'asc'); }}>Class</th>
                    )}
                    {visibleCols.minutes && (
                      <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50" onClick={() => { setSortKey('minutesThisWeek'); setSortDir(sortKey==='minutesThisWeek' && sortDir==='asc' ? 'desc' : 'asc'); }}>Minutes (7d)</th>
                    )}
                    {visibleCols.lastActive && (
                      <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50" onClick={() => { setSortKey('lastActive'); setSortDir(sortKey==='lastActive' && sortDir==='asc' ? 'desc' : 'asc'); }}>Last Active</th>
                    )}
                    {visibleCols.accuracy && (
                      <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50" onClick={() => { setSortKey('accuracy7d'); setSortDir(sortKey==='accuracy7d' && sortDir==='asc' ? 'desc' : 'asc'); }}>Accuracy (7d)</th>
                    )}
                    {visibleCols.streak && (
                      <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50" onClick={() => { setSortKey('streak'); setSortDir(sortKey==='streak' && sortDir==='asc' ? 'desc' : 'asc'); }}>Streak</th>
                    )}
                    {visibleCols.mastery && (
                      <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50" onClick={() => { setSortKey('mastery'); setSortDir(sortKey==='mastery' && sortDir==='asc' ? 'desc' : 'asc'); }}>Mastery</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {current.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-muted-foreground">
                        No students found matching your filters.
                      </td>
                    </tr>
                  ) : current.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={(e) => {
                      // Don't open if clicking checkbox
                      if ((e.target as HTMLElement).tagName === 'INPUT') return;
                      setDetailStudentId(r.id);
                      setDetailStudentName(r.name || 'Student');
                      setDetailOpen(true);
                    }}>
                      <td className="p-3"><input type="checkbox" checked={selectedRowIds.has(r.id)} onChange={(e) => setSelectedRowIds((prev) => { const next = new Set(prev); if (e.target.checked) next.add(r.id); else next.delete(r.id); return next; })} /></td>
                      {visibleCols.name && <td className="p-3 font-medium text-blue-600 hover:underline">{r.name || '—'}</td>}
                      {visibleCols.email && <td className="p-3 text-muted-foreground">{r.email || '—'}</td>}
                      {visibleCols.classSection && <td className="p-3"><Badge variant="secondary" className="font-normal">{r.classSection || 'Unassigned'}</Badge></td>}
                      {visibleCols.minutes && <td className="p-3 font-mono">{r.minutesThisWeek ?? 0}</td>}
                      {visibleCols.lastActive && <td className="p-3 text-muted-foreground">{r.lastActive || '—'}</td>}
                      {visibleCols.accuracy && <td className="p-3">{typeof r.accuracy7d === 'number' ? Math.round((r.accuracy7d || 0) * 100) + '%' : '—'}</td>}
                      {visibleCols.streak && <td className="p-3">{r.streak ?? 0}</td>}
                      {visibleCols.mastery && <td className="p-3">{typeof r.mastery === 'number' ? r.mastery + '%' : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <div>Showing {(page-1)*pageSize + 1}–{Math.min(page*pageSize, sorted.length)} of {sorted.length}</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page<=1} onClick={() => setPage((p) => Math.max(1, p-1))}>Prev</Button>
              <div className="min-w-[4rem] text-center">Page {page} / {totalPages}</div>
              <Button size="sm" variant="outline" disabled={page>=totalPages} onClick={() => setPage((p) => Math.min(totalPages, p+1))}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* QR Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader><UIDialogTitle>Join via QR</UIDialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            {joinLink ? (
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinLink)}`} alt="Join QR" className="border rounded-lg shadow-sm" />
            ) : (
              <div className="text-sm text-muted-foreground">No link available</div>
            )}
            <div className="text-xs text-muted-foreground break-all max-w-full text-center px-4">{joinLink}</div>
          </div>
          <DialogFooter>
            <Button onClick={() => setQrOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Manage Classes Dialog */}
      <Dialog open={manageClassesOpen} onOpenChange={setManageClassesOpen}>
        <DialogContent>
          <DialogHeader><UIDialogTitle>Manage classes</UIDialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New class name</Label>
              <div className="flex gap-2">
                <Input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="e.g., Algebra I - Period 2" />
                <Button disabled={!newClassName.trim()} onClick={async () => {
                  if (!app || !schoolId) return;
                  try {
                    const id = newClassName.trim();
                    await setDoc(doc(collection(db, 'schools', String(schoolId), 'classes')), { name: id, createdAt: Date.now() } as any);
                    setClasses((prev) => Array.from(new Set([...prev, id])));
                    setNewClassName('');
                    toast.success('Class added');
                  } catch {}
                }}>Add</Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Existing classes</div>
              <div className="text-sm text-muted-foreground border rounded-md p-3 min-h-[3rem] bg-muted/30">
                {classes.length === 0 ? 'No classes created yet.' : (
                  <div className="flex flex-wrap gap-2">
                    {classes.map(c => <Badge key={c} variant="secondary">{c}</Badge>)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setManageClassesOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StudentDetailModal 
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        studentId={detailStudentId}
        studentName={detailStudentName}
      />
    </div>
  );
}

export default function SchoolAdminStudentsPage() {
  return (
    <Suspense fallback={<div className="flex h-[50vh] items-center justify-center"><Loading /></div>}>
      <StudentsInner />
    </Suspense>
  );
}
