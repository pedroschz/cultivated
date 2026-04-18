"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { Sidebar, PageHeader, Card, CardHeader, CardTitle, CardContent, Progress } from "@/components";
import { app, db } from "@/lib/firebaseClient";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/context/UserContext";

export default function SchoolPage() {
  const router = useRouter();
  const { user, userData, isLoading: isUserLoading } = useUser();
  const [isSidebarCollapsed] = useState(false);
  const [assignments, setAssignments] = useState<Array<{ id: string; title: string; minutesGoal?: number | null; dueAt?: number | null; progressMinutes?: number }>>([]);
  const [allowedProgram, setAllowedProgram] = useState<boolean>(false);
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null);
  const [isProgramCheckLoading, setIsProgramCheckLoading] = useState(true);

  const userSchoolId = userData?.schoolId ? String(userData.schoolId) : null;

  // Check if user is allowed in the program (referrerId matches schoolId)
  useEffect(() => {
    if (isUserLoading) return;
    
    if (!user) {
      router.replace('/login');
      return;
    }

    if (!userSchoolId) {
      setAllowedProgram(false);
      setIsProgramCheckLoading(false);
      router.replace('/dashboard');
      return;
    }

    const checkProgram = async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          const refId = String(data?.referrerId || '');
          const isAllowed = !!refId && String(userSchoolId) === refId;
          setAllowedProgram(isAllowed);
          if (!isAllowed) {
            router.replace('/dashboard');
          }
        } else {
          setAllowedProgram(false);
          router.replace('/dashboard');
        }
      } catch {
        setAllowedProgram(false);
        router.replace('/dashboard');
      } finally {
        setIsProgramCheckLoading(false);
      }
    };
    
    checkProgram();
  }, [user, userSchoolId, isUserLoading, router]);

  // Fetch assignments
  useEffect(() => {
    (async () => {
      try {
        if (!user || !app || !userSchoolId) { setAssignments([]); return; }
        // using exported db instance
        const assignmentsSnap = await getDocs(collection(db, "schools", String(userSchoolId), "assignments"));
        const listRaw = assignmentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const userId = user.uid;
        const list = listRaw.filter((a: any) => {
          const scope = a?.assignedScope || { type: 'all' };
          if (String(scope?.type || 'all') === 'all') return true;
          const ids: string[] = Array.isArray(a?.studentIds) ? a.studentIds.map((x: any) => String(x)) : [];
          return ids.includes(userId);
        });
        if (!list.length) { setAssignments([]); return; }
        const dailySnap = await getDocs(collection(db, "users", user.uid, "metrics", "daily", "days"));
        const dailyMap = new Map<string, number>();
        dailySnap.docs.forEach((ds) => {
          const sec = Number((ds.data() as any)?.secondsStudied || 0);
          dailyMap.set(ds.id, sec);
        });
        const enriched = list.map((a) => {
          const startMs = Number(a.createdAt || 0) || Date.now();
          const endMs = Number(a.dueAt || Date.now());
          let totalSec = 0;
          const cursor = new Date(startMs);
          const endDate = new Date(endMs);
          if (endDate < cursor) endDate.setTime(Date.now());
          while (cursor <= endDate) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${String(cursor.getDate()).padStart(2,"0")}`;
            totalSec += dailyMap.get(key) || 0;
            cursor.setDate(cursor.getDate() + 1);
          }
          const progressMinutes = Math.round(totalSec / 60);
          return { id: a.id, title: String(a.title || "Assignment"), minutesGoal: a.minutesGoal ?? null, dueAt: a.dueAt ?? null, progressMinutes };
        });
        setAssignments(enriched);
      } catch {
        setAssignments([]);
      }
    })();
  }, [user, app, userSchoolId]);

  // Fetch school logo
  useEffect(() => {
    (async () => {
      try {
        if (!app || !userSchoolId) { setSchoolLogoUrl(null); return; }
        const sRef = doc(db, 'schools', String(userSchoolId));
        const sSnap = await getDoc(sRef).catch(() => null);
        if (sSnap && sSnap.exists()) {
          const sdata = sSnap.data() as any;
          setSchoolLogoUrl((sdata?.logoUrl as string) || null);
        } else {
          setSchoolLogoUrl(null);
        }
      } catch {
        setSchoolLogoUrl(null);
      }
    })();
  }, [app, userSchoolId]);

  if (isUserLoading || isProgramCheckLoading) {
    return (
      <div className="min-h-screen ambient-bg">
        <Sidebar />
        <div className={cn("transition-all duration-300 ease-in-out", isSidebarCollapsed ? "ml-0 md:ml-16" : "ml-0 md:ml-64")}> 
          <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
            <PageHeader title="My School" />
            <div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !allowedProgram) return null;

  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar />
      <div className={cn("transition-all duration-300 ease-in-out", isSidebarCollapsed ? "ml-0 md:ml-16" : "ml-0 md:ml-64")}> 
        <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
          <PageHeader title="My School" />
          {schoolLogoUrl ? (
            <div className="mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={schoolLogoUrl} alt="School logo" className="max-h-36 w-auto h-auto" />
            </div>
          ) : null}

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>My Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                {(!userSchoolId || assignments.length === 0) && (
                  <div className="text-sm text-muted-foreground">No assignments yet.</div>
                )}
                {userSchoolId && assignments.length > 0 && (
                  <div className="space-y-4">
                    {assignments.map((a) => {
                      const goal = Number(a.minutesGoal || 0);
                      const progress = Math.max(0, Math.min(100, goal > 0 ? Math.round((a.progressMinutes || 0) / goal * 100) : 0));
                      return (
                        <div key={a.id} className="border rounded-md p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">{a.title}</div>
                            {a.dueAt ? <div className="text-sm text-muted-foreground">Due {new Date(a.dueAt).toLocaleDateString()}</div> : null}
                          </div>
                          {goal > 0 ? (
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>{a.progressMinutes || 0} min</span>
                                <span>{goal} min</span>
                              </div>
                              <Progress value={progress} />
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">Progress will update as you practice.</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
