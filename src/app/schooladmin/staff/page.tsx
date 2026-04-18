"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, app } from "@/lib/firebaseClient";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Loading } from "@/components/ui/loading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Claims = { role?: string; schoolId?: string };

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "schoolAdmin" | "teacher";
  lastLogin?: number;
}

export default function StaffPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth as any, async (user) => {
      if (!user) { router.replace('/login'); return; }
      const idTokenResult = await user.getIdTokenResult(true);
      const claims = (idTokenResult.claims || {}) as Claims;
      
      // Only school admins can manage staff
      if (!claims.schoolId || String(claims.role) !== 'schoolAdmin') {
        router.replace('/schooladmin');
        return;
      }

      setAuthorized(true);
      setChecking(false);
      setSchoolId(String(claims.schoolId));
      setCurrentUserId(user.uid);
      fetchStaff(String(claims.schoolId));
    });
    return () => unsub?.();
  }, [router]);

  const fetchStaff = async (sid: string) => {
    try {
      setLoading(true);
      const fns = getFunctions(app as any, 'us-central1');
      const listSchoolUsers = httpsCallable(fns, 'listSchoolUsers');
      const res: any = await listSchoolUsers({ schoolId: sid });
      const allUsers: any[] = res?.data?.users || [];
      const list: StaffMember[] = [];
      for (const data of allUsers) {
        const role = String(data.role || '');
        if (role === 'schoolAdmin' || role === 'teacher') {
          const lastLoginRaw = data.lastLogin;
          const lastLogin = lastLoginRaw?.toMillis ? lastLoginRaw.toMillis()
            : lastLoginRaw?._seconds ? lastLoginRaw._seconds * 1000
            : lastLoginRaw?.seconds ? lastLoginRaw.seconds * 1000
            : undefined;
          list.push({
            id: data.id,
            name: data.name || 'Unknown',
            email: data.email || '',
            role: role as "schoolAdmin" | "teacher",
            lastLogin,
          });
        }
      }
      setStaff(list);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load staff list");
    } finally {
      setLoading(false);
    }
  };

  const removeStaff = async (uid: string) => {
    if (!schoolId) return;
    try {
      // Remove role and schoolId via Cloud Function (writes to another user's
      // private doc are denied by Firestore rules). Custom claims may persist
      // until the next token refresh.
      const fns = getFunctions(app as any, 'us-central1');
      const updateUser = httpsCallable(fns, 'schoolAdminUpdateUser');
      await updateUser({ uid, updates: { role: 'student', schoolId: null, schoolName: null } });
      
      setStaff(prev => prev.filter(s => s.id !== uid));
      toast.success("Staff member removed");
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove staff member");
    }
  };

  if (checking) return <div className="flex h-[50vh] items-center justify-center"><Loading /></div>;
  if (!authorized) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Staff Management</h1>
        <p className="text-muted-foreground mb-6">Manage teachers and other administrators for your school.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Current Staff
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : staff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No staff found.</TableCell>
                  </TableRow>
                ) : (
                  staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'schoolAdmin' ? 'default' : 'secondary'}>
                          {member.role === 'schoolAdmin' ? 'Admin' : 'Teacher'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.id !== currentUserId ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {member.name} from the school staff. They will lose access to the school admin dashboard immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeStaff(member.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <span className="text-xs text-muted-foreground italic pr-3">You</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
