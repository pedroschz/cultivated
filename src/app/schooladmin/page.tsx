"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, app, db } from "@/lib/firebaseClient";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SchoolLogoUploader } from "@/components/school-admin/school-logo-uploader";
import { InviteTeacherDialog } from "@/components/school-admin/invite-teacher-dialog";
import { DailyActivityChart } from "@/components/school-admin/dashboard-charts";
import { Settings, Users, UserPlus, Upload, Activity, AlertTriangle, School } from "lucide-react";
import Link from "next/link";

type Claims = { role?: string; schoolId?: string };

export default function SchoolAdminPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  
  // KPIs
  const [kpis, setKpis] = useState<{ todaySeconds: number; weekSeconds: number; uniqueToday: number } | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [suspiciousCount, setSuspiciousCount] = useState(0);
  const [chartData, setChartData] = useState<{ date: string; minutes: number }[]>([]);
  const [recentStudents, setRecentStudents] = useState<{ id: string; name: string; lastSeen: number }[]>([]);

  // Dialog states
  const [inviteOpen, setInviteOpen] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth as any, async (user) => {
      if (!user) { router.replace('/login'); return; }
      const idTokenResult = await user.getIdTokenResult(true);
      const claims = (idTokenResult.claims || {}) as Claims;
      if (!claims.schoolId || !['schoolAdmin','teacher'].includes(String(claims.role || ''))) {
        router.replace('/dashboard');
        return;
      }
      setIsAuthorized(true);
      setIsChecking(false);
      setSchoolId(String(claims.schoolId));
      setRole(String(claims.role));

      if (app) {
        const sRef = doc(db, 'schools', String(claims.schoolId));
        const sSnap = await getDoc(sRef).catch(() => null);
        if (sSnap && sSnap.exists()) {
          const sdata = sSnap.data() as any;
          setSchoolName((sdata?.name as string) || null);
          setLogoUrl((sdata?.logoUrl as string) || null);
        }

        // Fetch online students count
        const usersRef = collection(db, 'users');
        const onlineSnap = await getDocs(query(usersRef, where('schoolId', '==', String(claims.schoolId))));
        let online = 0;
        let suspicious = 0;
        const recent: { id: string; name: string; lastSeen: number }[] = [];
        const now = Date.now();
        const SUSPICIOUS_THRESHOLD = 5;

        // Note: For large schools this N+1 fetch might be slow, but valid for MVP
        await Promise.all(onlineSnap.docs.map(async (d) => {
            const data = d.data();
            if (data.role === 'schoolAdmin' || data.role === 'teacher') return;
            
            // Check online status
            const lastSeen = data.lastSeen?.toMillis ? data.lastSeen.toMillis() : (data.lastSeen?.seconds * 1000 || 0);
            if (now - lastSeen < 5 * 60 * 1000) { // 5 minutes
                online++;
            }
            if (now - lastSeen < 24 * 60 * 60 * 1000 && lastSeen > 0) { // 24 hours
                recent.push({ id: d.id, name: String(data.name || 'Student'), lastSeen });
            }

            // Check suspicious activity in active session
            try {
              const sessionRef = doc(db, 'users', d.id, 'practice', 'session');
              const sessionSnap = await getDoc(sessionRef);
              if (sessionSnap.exists()) {
                 const sData = sessionSnap.data();
                 if (sData.isActive && (sData.session?.tabSwitches || 0) > SUSPICIOUS_THRESHOLD) {
                    suspicious++;
                 }
              }
            } catch {}
        }));
        
        setOnlineCount(online);
        setSuspiciousCount(suspicious);
        
        recent.sort((a, b) => b.lastSeen - a.lastSeen);
        setRecentStudents(recent.slice(0, 10));

        // Metrics Fetching
        const today = new Date();
        const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const todayKey = dateKey(today);
        
        // Generate last 7 days keys
        const last7DaysKeys: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          last7DaysKeys.push(dateKey(d));
        }

        // Fetch last 7 days for KPIs and Chart
        const daysRef = collection(db, 'schools', String(claims.schoolId), 'metrics', 'daily', 'days');
        // Fetch matching specific keys to avoid getting old data if recent data is missing
        const snap = await getDocs(query(daysRef, where('__name__', 'in', last7DaysKeys))).catch(() => null);
        
        let weekSeconds = 0;
        let todaySeconds = 0;
        let uniqueToday = 0;
        const dataMap = new Map<string, number>();

        if (snap) {
          snap.docs.forEach((d) => {
            const val = d.data() as any;
            const secs = Number(val?.secondsStudied || 0);
            weekSeconds += secs;
            if (d.id === todayKey) {
              todaySeconds = secs;
              uniqueToday = Number(val?.uniqueStudentsCount || 0);
            }
            dataMap.set(d.id, Math.round(secs / 60));
          });
        }
        
        // Construct full 7-day chart data (filling gaps with 0)
        const chartDataPoints = last7DaysKeys.map(key => ({
          date: key,
          minutes: dataMap.get(key) || 0
        }));

        setChartData(chartDataPoints);
        setKpis({ todaySeconds, weekSeconds, uniqueToday });
      }
    });
    return () => unsub?.();
  }, [router]);

  const fmtDuration = (seconds: number) => {
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m`;
  };

  if (isChecking) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        Checking access...
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <div className="h-16 flex items-center pr-4 border-r mr-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={schoolName || "School Logo"} className="h-full w-auto max-w-[180px] object-contain" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-lg border bg-muted/50 flex items-center justify-center mr-2">
               <School className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-display font-bold">{schoolName || 'School Admin'}</h1>
            <p className="text-muted-foreground">Dashboard & Overview</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {role === 'schoolAdmin' && (
             <>
               <Button onClick={() => setInviteOpen(true)} className="gap-2">
                 <UserPlus className="h-4 w-4" />
                 Invite Teacher
               </Button>
               <Button variant="outline" onClick={() => setLogoOpen(true)} className="gap-2">
                 <Upload className="h-4 w-4" />
                 {logoUrl ? 'Update Logo' : 'Upload Logo'}
               </Button>
             </>
           )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              Online Now
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">{onlineCount}</div>
          </CardContent>
        </Card>
        
        {suspiciousCount > 0 && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Suspicious Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{suspiciousCount}</div>
              <p className="text-xs text-red-500 mt-1">Students with high tab switching</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.uniqueToday || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time Studied Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis ? fmtDuration(kpis.todaySeconds) : '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time Studied (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">{kpis ? fmtDuration(kpis.weekSeconds) : '—'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DailyActivityChart data={chartData} className="col-span-1 lg:col-span-2" />
        
        {/* Quick Links / Status */}
        <div className="space-y-6">

           <Card>
             <CardHeader>
               <CardTitle>Recent Activity (24h)</CardTitle>
             </CardHeader>
             <CardContent>
               {recentStudents.length === 0 ? (
                 <p className="text-sm text-muted-foreground">No active students in the last 24h.</p>
               ) : (
                 <ul className="space-y-3">
                   {recentStudents.map((s) => (
                     <li key={s.id} className="flex items-center justify-between text-sm">
                       <span className="font-medium">{s.name}</span>
                       <span className="text-muted-foreground text-xs">
                         {Math.floor((Date.now() - s.lastSeen) / 60000)}m ago
                       </span>
                     </li>
                   ))}
                 </ul>
               )}
             </CardContent>
           </Card>
        </div>
      </div>

      {/* Dialogs */}
      <SchoolLogoUploader 
        isOpen={logoOpen} 
        onClose={() => setLogoOpen(false)} 
        schoolId={schoolId} 
        currentLogoUrl={logoUrl} 
        onLogoUpdated={(url) => setLogoUrl(url)} 
      />
      <InviteTeacherDialog 
        isOpen={inviteOpen} 
        onClose={() => setInviteOpen(false)} 
      />
    </div>
  );
}
