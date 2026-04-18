"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, app, db } from "@/lib/firebaseClient";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@/components";
import { satScoreToMasteryPercent } from "../../../lib/utils/satToMastery";
import { Loading } from "@/components/ui/loading";

type Claims = { role?: string; schoolId?: string };

type Preset = 'usage' | 'engagement' | 'mastery';

export default function SchoolReportsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [preset, setPreset] = useState<Preset>('usage');
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('daily');
  const [anonymize, setAnonymize] = useState(false);
  const [comparePrev, setComparePrev] = useState(false);
  const [compareClass, setCompareClass] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth as any, async (user) => {
      if (!user) { router.replace('/login'); return; }
      const t = await user.getIdTokenResult(true);
      const claims = (t.claims || {}) as Claims;
      if (!claims.schoolId || !['schoolAdmin','teacher'].includes(String(claims.role || ''))) { router.replace('/dashboard'); return; }
      setSchoolId(String(claims.schoolId));
      setAuthorized(true);
      setChecking(false);
    });
    return () => unsub?.();
  }, [router]);

  const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const handleGenerateCsv = async () => {
    try {
      if (!auth || !app || !schoolId) return;
      setGenerating(true);
      // using exported db instance
      const usersSnap = await getDocs(query(collection(db, 'users'), where('schoolId', '==', schoolId)));
      const rows: string[] = [];
      const fromDate = from ? new Date(from) : new Date(Date.now() - 30*24*60*60*1000);
      const toDate = to ? new Date(to) : new Date();
      // Headers vary by preset
      const baseHeader = anonymize ? ['User #'] : ['User ID','Name','Email'];
      let header: string[] = [];
      if (preset === 'usage' || preset === 'engagement') {
        header = [...baseHeader, 'Seconds (range)','Questions (range)','Correct (range)'];
      } else if (preset === 'mastery') {
        header = [...baseHeader, 'Latest Math','Latest R&W','Mastery%'];
      }
      rows.push(header.join(','));
      let userIndex = 1;
      for (const u of usersSnap.docs) {
        const data = u.data() as any;
        const role = String(data?.role || '').toLowerCase();
        if (role === 'schooladmin' || role === 'teacher') continue;
        if (preset === 'usage' || preset === 'engagement') {
          let seconds = 0, questions = 0, correct = 0;
          try {
            const daysSnap = await getDocs(collection(db, 'users', u.id, 'metrics', 'daily', 'days'));
            daysSnap.docs.forEach((ds) => {
              const key = ds.id;
              const parts = key.split('-');
              if (parts.length === 3) {
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                if (d >= fromDate && d <= toDate) {
                  const v = ds.data() as any;
                  seconds += Number(v?.secondsStudied || 0);
                  questions += Number(v?.questionsAnswered || 0);
                  correct += Number(v?.correct || 0);
                }
              }
            });
          } catch {}
          const idCol = anonymize ? `User ${userIndex++}` : u.id;
          const nameCol = anonymize ? '' : JSON.stringify(String(data?.name || ''));
          const emailCol = anonymize ? '' : JSON.stringify(String(data?.email || ''));
          rows.push([idCol, nameCol, emailCol, String(seconds), String(questions), String(correct)].join(','));
        } else {
          // mastery preset: use latest scores when available
          const scores: any[] = Array.isArray(data?.scores) ? data.scores : [];
          const latest = scores.length > 0 ? scores[scores.length - 1] : {};
          const math = Number(latest?.math || 0);
          const rw = Number(latest?.readingAndWriting || 0);
          let mastery = '';
          try {
            if (math || rw) {
              const m1 = satScoreToMasteryPercent(Math.max(200, Math.min(800, math || 0)) * 2);
              const m2 = satScoreToMasteryPercent(Math.max(200, Math.min(800, rw || 0)) * 2);
              mastery = String(Math.round((m1 + m2) / 2));
            }
          } catch {}
          const idCol = anonymize ? `User ${userIndex++}` : u.id;
          const nameCol = anonymize ? '' : JSON.stringify(String(data?.name || ''));
          const emailCol = anonymize ? '' : JSON.stringify(String(data?.email || ''));
          rows.push([idCol, nameCol, emailCol, String(math||''), String(rw||''), mastery].join(','));
        }
      }
      // TODO: comparePrev, compareClass could be appended as separate summary rows if needed
      const csv = rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `school-report-${preset}-${schoolId}-${toKey(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || 'Failed to generate CSV');
    } finally {
      setGenerating(false);
    }
  };

  if (checking) return <div className="flex h-[50vh] items-center justify-center"><Loading /></div>;
  if (!authorized) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Reports</h1>
        <p className="text-muted-foreground mb-6">Use presets or build a custom CSV.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Report builder</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Preset</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
                <SelectTrigger><SelectValue placeholder="Select preset" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usage">Usage (seconds/questions)</SelectItem>
                  <SelectItem value="engagement">Engagement (same as usage)</SelectItem>
                  <SelectItem value="mastery">Mastery growth (latest scores)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Granularity</Label>
              <Select value={granularity} onValueChange={(v) => setGranularity(v as 'daily'|'weekly')}>
                <SelectTrigger><SelectValue placeholder="Daily" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>From (optional)</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To (optional)</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="flex items-center space-x-2">
              <Switch id="anonymize" checked={anonymize} onCheckedChange={setAnonymize} />
              <Label htmlFor="anonymize">Anonymize student identity</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="compare" checked={comparePrev} onCheckedChange={setComparePrev} />
              <Label htmlFor="compare">Compare to previous period</Label>
            </div>
          </div>
          <div className="pt-4">
             <Button onClick={handleGenerateCsv} disabled={generating} className="w-full md:w-auto">
               {generating ? 'Generating…' : 'Download CSV'}
             </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
