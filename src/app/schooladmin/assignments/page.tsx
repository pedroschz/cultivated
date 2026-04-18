"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, app, db as appDb } from "@/lib/firebaseClient";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitle, DialogFooter } from "@/components";
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Loading } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";

type Claims = { role?: string; schoolId?: string };

export default function SchoolAssignmentsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(120);
  const [due, setDue] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [students, setStudents] = useState<Array<{ id: string; name?: string; email?: string; class?: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Array<any>>([]);
  const [type, setType] = useState<'minutes' | 'questions'>("minutes");
  const [questionsGoal, setQuestionsGoal] = useState<number>(0);
  const [minAccuracy, setMinAccuracy] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [progressTarget, setProgressTarget] = useState<any | null>(null);
  const [scopeMode, setScopeMode] = useState<'all'|'classes'|'students'>("all");
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());

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
      try {
        const qUsers = query(collection(appDb, 'users'), where('schoolId', '==', String(claims.schoolId)));
        const snap = await getDocs(qUsers).catch(() => null);
        const list: Array<{ id: string; name?: string; email?: string; class?: string }> = [];
        if (snap) {
          for (const d of snap.docs) {
            const u = d.data() as any;
            const role = String(u?.role || '').toLowerCase();
            if (role === 'schooladmin' || role === 'teacher') continue;
            list.push({ id: d.id, name: String(u?.name || ''), email: String(u?.email || ''), class: typeof u?.class === 'string' ? String(u.class) : undefined });
          }
        }
        setStudents(list);
        const aSnap = await getDocs(collection(appDb, 'schools', String(claims.schoolId), 'assignments')).catch(() => null);
        setAssignments(aSnap ? aSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) : []);
        try {
          const cSnap = await getDocs(collection(appDb, 'schools', String(claims.schoolId), 'classes'));
          const names = cSnap.docs.map((d) => String(((d.data() as any)?.name || '')).trim()).filter(Boolean);
          setClasses(Array.from(new Set(names)));
        } catch {}
      } catch {}
    });
    return () => unsub?.();
  }, [router]);

  const createAssignment = async () => {
    try {
      if (!auth || !schoolId) return;
      setCreating(true);
      const idToken = await auth.currentUser?.getIdToken(true);
      const dueAt = due ? Date.parse(due) : null;
      let scope: any = { type: 'all' };
      let studentIds: string[] = [];
      if (scopeMode === 'students' && selectedIds.size > 0) {
        scope = { type: 'subset' };
        studentIds = Array.from(selectedIds);
      } else if (scopeMode === 'classes' && selectedClasses.size > 0) {
        scope = { type: 'classes', classes: Array.from(selectedClasses) };
        const classSet = new Set(Array.from(selectedClasses));
        studentIds = students.filter((s) => s.class && classSet.has(String(s.class))).map((s) => s.id);
      }
      const payload: any = {
        title,
        type,
        minutesGoal: type === 'minutes' ? minutes : null,
        questionsGoal: type === 'questions' ? questionsGoal : null,
        minAccuracy: minAccuracy || null,
        criteria: {},
        dueAt,
        assignedScope: scope,
        studentIds,
      };
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (!projectId) {
        throw new Error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID env var. Set it in .env.local — see .env.example.');
      }
      const functionsBase = `https://us-central1-${projectId}.cloudfunctions.net`;
      const resp = await fetch(`${functionsBase}/createAssignment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, schoolId, assignment: payload }) });
      const body = await resp.json().catch(() => ({} as any));
      if (!resp.ok) throw new Error(String((body as any)?.error || 'Failed'));
      setCreatedId(String((body as any)?.id || ''));
      setTitle("");
      setMinutes(120);
      setQuestionsGoal(0);
      setMinAccuracy(0);
      setDue("");
      setSelectedIds(new Set());
      const aSnap = await getDocs(collection(appDb, 'schools', String(schoolId), 'assignments')).catch(() => null);
      setAssignments(aSnap ? aSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) : []);
      toast.success("Assignment created successfully");
    } catch (e: any) {
      alert(e?.message || 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const deleteAssignmentClient = async () => {
    if (!schoolId || !deleteTarget) return;
    try {
      await deleteDoc(doc(appDb, 'schools', String(schoolId), 'assignments', String(deleteTarget)));
      setAssignments((prev) => prev.filter((a) => a.id !== deleteTarget));
      toast.success('Assignment deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setDeleteTarget(null);
    }
  };

  const closeAssignment = async (id: string) => {
    if (!schoolId) return;
    try {
      await updateDoc(doc(appDb, 'schools', String(schoolId), 'assignments', id), { status: 'closed' } as any);
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'closed' } : a));
      toast.success('Assignment closed');
    } catch (e: any) { 
      toast.error(e?.message || 'Failed to close'); 
    }
  };

  const cloneAssignment = async (a: any) => {
    if (!schoolId) return;
    try {
      const ref = doc(collection(appDb, 'schools', String(schoolId), 'assignments'));
      const payload = { ...a };
      delete payload.id; payload.createdAt = Date.now(); payload.status = 'active';
      await setDoc(ref, payload as any);
      setAssignments((prev) => [{ id: (ref as any).id, ...payload }, ...prev]);
      toast.success('Assignment cloned');
    } catch (e: any) { 
      toast.error(e?.message || 'Clone failed'); 
    }
  };

  const saveEdit = async () => {
    if (!schoolId || !editTarget) return;
    try {
      const ref = doc(appDb, 'schools', String(schoolId), 'assignments', String(editTarget.id));
      await updateDoc(ref, { title: editTarget.title, minAccuracy: editTarget.minAccuracy || null, minutesGoal: editTarget.minutesGoal || null, questionsGoal: editTarget.questionsGoal || null, dueAt: editTarget.dueAt || null } as any);
      setAssignments((prev) => prev.map((x) => x.id === editTarget.id ? { ...x, ...editTarget } : x));
      toast.success('Assignment updated');
      setEditTarget(null);
    } catch (e: any) { 
      toast.error(e?.message || 'Update failed'); 
    }
  };

  if (checking) return <div className="flex h-[50vh] items-center justify-center"><Loading /></div>;
  if (!authorized) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Assignments</h1>
        <p className="text-muted-foreground mb-6">Create study assignments for your students.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New assignment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 3: Algebra practice" />
            </div>
            <div className="space-y-2">
              <Label>Goal type</Label>
              <div className="flex items-center gap-4 text-sm pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="atype" className="accent-primary" checked={type==='minutes'} onChange={() => setType('minutes')} /> Minutes
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="atype" className="accent-primary" checked={type==='questions'} onChange={() => setType('questions')} /> Questions
                </label>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{type === 'minutes' ? 'Minutes goal' : 'Questions goal'}</Label>
              {type === 'minutes' ? (
                <Input type="number" value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value || '0', 10) || 0)} />
              ) : (
                <Input type="number" value={questionsGoal} onChange={(e) => setQuestionsGoal(parseInt(e.target.value || '0', 10) || 0)} />
              )}
            </div>
            <div className="space-y-2">
              <Label>Minimum accuracy (optional, %)</Label>
              <Input type="number" value={minAccuracy} onChange={(e) => setMinAccuracy(parseInt(e.target.value || '0', 10) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Due date (optional)</Label>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign to</Label>
            <div className="flex items-center gap-4 text-sm pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="scope" className="accent-primary" checked={scopeMode==='all'} onChange={() => setScopeMode('all')} /> Everyone
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="scope" className="accent-primary" checked={scopeMode==='classes'} onChange={() => setScopeMode('classes')} /> Classes
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="scope" className="accent-primary" checked={scopeMode==='students'} onChange={() => setScopeMode('students')} /> Specific students
              </label>
            </div>
            {scopeMode === 'classes' && (
              <div className="max-h-48 overflow-auto border rounded-md p-2 bg-muted/20">
                {classes.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">No classes yet. Create classes on the Students page.</div>
                ) : (
                  <ul className="space-y-1">
                    {classes.map((c) => {
                      const checked = selectedClasses.has(c);
                      return (
                        <li key={c} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-sm">
                          <input type="checkbox" className="rounded border-input" checked={checked} onChange={(e) => setSelectedClasses((prev) => { const next = new Set(prev); if (e.target.checked) next.add(c); else next.delete(c); return next; })} />
                          <div className="text-sm">{c}</div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            {scopeMode === 'students' && (
              <div className="max-h-64 overflow-auto border rounded-md p-2 bg-muted/20">
                {students.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">No students yet.</div>
                ) : (
                  <ul className="space-y-1">
                    {students.map((s) => {
                      const checked = selectedIds.has(s.id);
                      return (
                        <li key={s.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-sm border-b last:border-b-0 border-border/40">
                          <input
                            type="checkbox"
                            className="rounded border-input"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(s.id); else next.delete(s.id);
                                return next;
                              });
                            }}
                          />
                          <div>
                            <div className="text-sm font-medium">{s.name || 'Unnamed'}</div>
                            <div className="text-xs text-muted-foreground">{s.email || ''}{s.class ? ` • ${s.class}` : ''}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
          <Button onClick={createAssignment} disabled={creating}>{creating ? 'Creating…' : 'Create assignment'}</Button>
        </CardContent>
      </Card>

      <div className="mt-8">
        <Card>
          <CardHeader><CardTitle>Current assignments</CardTitle></CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">No assignments yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-muted-foreground border-b border-border/50">
                      <th className="text-left p-3 font-medium">Title</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Goal</th>
                      <th className="text-left p-3 font-medium">Due</th>
                      <th className="text-left p-3 font-medium">Scope</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {assignments.map((a) => {
                      const goal = a.type === 'questions' ? (a.questionsGoal || 0) + ' q' : (a.minutesGoal || 0) + ' min';
                      const due = a.dueAt ? new Date(Number(a.dueAt)).toLocaleDateString() : '—';
                      let scope = 'Everyone';
                      if (a.assignedScope && a.assignedScope.type === 'subset') {
                        scope = `${Array.isArray(a.studentIds) ? a.studentIds.length : 0} students`;
                      } else if (a.assignedScope && a.assignedScope.type === 'classes') {
                        const arr = Array.isArray(a.assignedScope.classes) ? a.assignedScope.classes : [];
                        scope = `${arr.length} classes`;
                      }
                      const isClosed = (a.status||'active') === 'closed';
                      return (
                        <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{a.title}</td>
                          <td className="p-3 capitalize text-muted-foreground">{a.type}</td>
                          <td className="p-3">{goal}</td>
                          <td className="p-3">{due}</td>
                          <td className="p-3">{scope}</td>
                          <td className="p-3 capitalize">
                            <Badge variant={isClosed ? "secondary" : "default"}>{a.status || 'active'}</Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setEditTarget({ ...a })}>Edit</Button>
                              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setProgressTarget(a)}>Progress</Button>
                              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => cloneAssignment(a)}>Clone</Button>
                              <Button variant="outline" size="sm" className="h-7 px-2" disabled={isClosed} onClick={() => closeAssignment(a.id)}>{isClosed ? 'Closed' : 'Close'}</Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(a.id)}>Delete</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><UIDialogTitle>Delete assignment?</UIDialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">This action cannot be undone.</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteAssignmentClient}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader><UIDialogTitle>Edit assignment</UIDialogTitle></DialogHeader>
          {editTarget && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={editTarget.title || ''} onChange={(e) => setEditTarget((p: any) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                  <Label>Minimum accuracy (%)</Label>
                  <Input type="number" value={editTarget.minAccuracy || 0} onChange={(e) => setEditTarget((p: any) => ({ ...p, minAccuracy: parseInt(e.target.value || '0', 10) || 0 }))} />
                </div>
                {String(editTarget.type) === 'minutes' ? (
                  <div className="space-y-1">
                    <Label>Minutes goal</Label>
                    <Input type="number" value={editTarget.minutesGoal || 0} onChange={(e) => setEditTarget((p: any) => ({ ...p, minutesGoal: parseInt(e.target.value || '0', 10) || 0 }))} />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label>Questions goal</Label>
                    <Input type="number" value={editTarget.questionsGoal || 0} onChange={(e) => setEditTarget((p: any) => ({ ...p, questionsGoal: parseInt(e.target.value || '0', 10) || 0 }))} />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input type="date" value={editTarget.dueAt ? new Date(Number(editTarget.dueAt)).toISOString().slice(0,10) : ''} onChange={(e) => setEditTarget((p: any) => ({ ...p, dueAt: e.target.value ? Date.parse(e.target.value) : null }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {progressTarget && schoolId && (
        <AssignmentProgressDialog 
          assignment={progressTarget} 
          open={!!progressTarget} 
          onClose={() => setProgressTarget(null)} 
          schoolId={schoolId}
          allStudents={students}
        />
      )}
    </div>
  );
}

function AssignmentProgressDialog({ assignment, open, onClose, schoolId, allStudents }: { assignment: any, open: boolean, onClose: () => void, schoolId: string, allStudents: any[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !assignment) return;
    setLoading(true);
    (async () => {
      try {
        // Determine target students
        let targets: any[] = [];
        const scope = assignment.assignedScope || { type: 'all' };
        if (scope.type === 'subset' && Array.isArray(assignment.studentIds)) {
          const ids = new Set(assignment.studentIds);
          targets = allStudents.filter(s => ids.has(s.id));
        } else if (scope.type === 'classes' && Array.isArray(scope.classes)) {
          const classes = new Set(scope.classes);
          targets = allStudents.filter(s => s.class && classes.has(s.class));
        } else {
          targets = allStudents;
        }

        // Fetch metrics for each student
        // This can be heavy, so we limit to top 50 or paginated in a real app, but here we just fetch all
        const results = await Promise.all(targets.map(async (student) => {
          // Fetch daily metrics within range
          const startMs = Number(assignment.createdAt || 0);
          const endMs = Number(assignment.dueAt || Date.now());
          
          let progress = 0;
          let completed = false;
          
          try {
            // Optimization: if we had a consolidated 'assignment_progress' subcollection, we'd use that.
            // Fallback: fetch days. limiting to last 30 days if assignment is old to save reads? 
            // Better: fetch days >= start date.
            // Since day keys are YYYY-MM-DD, we can't easily range query on ID string without care.
            // But we can just fetch all days and filter in memory since days doc count is usually low (<365).
             
            const daysRef = collection(appDb, 'users', student.id, 'metrics', 'daily', 'days');
            const snap = await getDocs(daysRef);
            
            snap.docs.forEach((d) => {
              const parts = d.id.split('-');
              const date = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
              const ts = date.getTime();
              // A very rough approximation: if the day is within the assignment window, count it.
              // Note: This counts ALL study time in that window towards the assignment, which is the current logic.
              if (ts >= startMs - 86400000 && ts <= endMs + 86400000) { 
                 const data = d.data() as any;
                 if (assignment.type === 'questions') {
                    progress += Number(data.questionsAnswered || 0);
                 } else {
                    progress += Math.round(Number(data.secondsStudied || 0) / 60);
                 }
              }
            });
          } catch {}

          const goal = assignment.type === 'questions' ? (assignment.questionsGoal || 0) : (assignment.minutesGoal || 0);
          const percent = goal > 0 ? Math.min(100, Math.round((progress / goal) * 100)) : 0;
          
          return {
            ...student,
            progress,
            percent,
            goal
          };
        }));
        
        results.sort((a, b) => b.percent - a.percent);
        setRows(results);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [assignment, open, allStudents]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <UIDialogTitle>Progress: {assignment.title}</UIDialogTitle>
        </DialogHeader>
        <div className="space-y-4">
           {loading ? (
             <div className="text-center py-8">Loading student progress...</div>
           ) : rows.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground">No students found for this assignment.</div>
           ) : (
             <div className="border rounded-md overflow-hidden">
               <table className="w-full text-sm">
                 <thead className="bg-muted/50">
                   <tr className="border-b">
                     <th className="text-left p-3 font-medium">Student</th>
                     <th className="text-left p-3 font-medium">Progress</th>
                     <th className="text-left p-3 font-medium">%</th>
                     <th className="text-left p-3 font-medium">Status</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {rows.map((r) => (
                     <tr key={r.id}>
                       <td className="p-3">
                         <div className="font-medium">{r.name}</div>
                         <div className="text-xs text-muted-foreground">{r.email}</div>
                       </td>
                       <td className="p-3">
                         {r.progress} / {r.goal} {assignment.type}
                       </td>
                       <td className="p-3">
                         <div className="flex items-center gap-2">
                           <div className="h-2 w-16 bg-secondary rounded-full overflow-hidden">
                             <div className="h-full bg-primary" style={{ width: `${r.percent}%` }} />
                           </div>
                           <span className="text-xs">{r.percent}%</span>
                         </div>
                       </td>
                       <td className="p-3">
                         {r.percent >= 100 ? (
                           <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>
                         ) : (
                           <Badge variant="secondary">In Progress</Badge>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
