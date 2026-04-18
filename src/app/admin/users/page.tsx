"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, app, db as defaultDb, labsDb } from "@/lib/firebaseClient";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { Button, Card, CardContent, CardHeader, CardTitle, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Loading, Badge } from "@/components";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


interface UserRow {
  uid: string;
  name: string;
  username: string;
  email: string;
  minutesPracticed: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);
  const [migrateUid, setMigrateUid] = useState<string>("");
  const [migrateDirection, setMigrateDirection] = useState<"toLabs" | "toCultivated">("toLabs");
  const [isMigrating, setIsMigrating] = useState<boolean>(false);

  // Gate access by admin email
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

  // Fetch all users from Firestore
  useEffect(() => {
    (async () => {
      if (!app) return;
      try {
        const db = getFirestore(app);
        const snap = await getDocs(collection(db, "users"));
        const rows: UserRow[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const seconds = Number(data?.adaptiveLearning?.totalTimeSpent || 0);
          const minutes = Math.floor(seconds / 60);
          return {
            uid: d.id,
            name: data?.name || "",
            username: data?.username || "",
            email: data?.email || data?.userEmail || "",
            minutesPracticed: minutes,
          };
        });
        // Sort by name for consistency
        rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setUsers(rows);
      } catch (e) {
        console.error("Failed to list users", e);
        toast.error("Failed to load users");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (uid: string) => {
    if (!auth || !app) return;
    try {
      setDeletingUid(uid);
      const functions = getFunctions(app);
      const deleteFn = httpsCallable(functions, 'adminDeleteUser');
      await deleteFn({ uid });
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      toast.success("User deleted successfully");
    } catch (e: any) {
      console.error("Delete user failed", e);
      toast.error(e?.message || "Failed to delete user");
    } finally {
      setDeletingUid(null);
      setUserToDelete(null);
    }
  };

  const handleMigrate = async () => {
    if (!migrateUid.trim()) {
      toast.error("Enter a UID to migrate");
      return;
    }
    if (!defaultDb) {
      toast.error("Default database not initialized");
      return;
    }
    if (!labsDb) {
      toast.error("Labs database not initialized");
      return;
    }

    const uid = migrateUid.trim();
    const isToLabs = migrateDirection === "toLabs";
    const source = isToLabs ? defaultDb : labsDb;
    const dest = isToLabs ? labsDb : defaultDb;

    try {
      setIsMigrating(true);
      // Read source doc
      const sourceRef = doc(source, "users", uid);
      const sourceSnap = await getDoc(sourceRef);
      if (!sourceSnap.exists()) {
        toast.error(isToLabs ? "No CultivatED user found with that UID" : "No Labs user found with that UID");
        return;
      }

      // Check destination doesn't already exist
      const destRef = doc(dest, "users", uid);
      const destSnap = await getDoc(destRef);
      if (destSnap.exists()) {
        toast.error("Destination already has a user with that UID");
        return;
      }

      const data = sourceSnap.data();

      // Write destination
      await setDoc(destRef, data, { merge: false });

      // Delete source
      await deleteDoc(sourceRef);

      // Update local table if we are viewing CultivatED users and moved one out
      if (isToLabs) {
        setUsers((prev) => prev.filter((u) => u.uid !== uid));
      }

      toast.success(isToLabs ? "Migrated user to 1600Labs" : "Migrated user to CultivatED");
    } catch (e: any) {
      console.error("Migration failed", e);
      toast.error(e?.message || "Failed to migrate user");
    } finally {
      setIsMigrating(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen ambient-bg flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Checking admin access…</div>
      </div>
    );
  }
  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen ambient-bg">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-display font-bold">Manage Users</h1>
          <Badge variant="outline">Admin only</Badge>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Migrate User Between Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">User UID</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-background"
                  placeholder="Enter UID"
                  value={migrateUid}
                  onChange={(e) => setMigrateUid(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Direction</label>
                <select
                  className="w-full border rounded px-3 py-2 bg-background"
                  value={migrateDirection}
                  onChange={(e) => setMigrateDirection(e.target.value as any)}
                >
                  <option value="toLabs">CultivatED ➜ 1600Labs</option>
                  <option value="toCultivated">1600Labs ➜ CultivatED</option>
                </select>
              </div>
              <div>
                <Button onClick={handleMigrate} disabled={isMigrating}>
                  {isMigrating ? "Migrating…" : "Migrate"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This moves the user document between databases. Subcollections are not copied.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 flex justify-center"><Loading /></div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Username</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Minutes Practiced</th>
                      <th className="py-2 pr-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.uid} className="border-t border-border/50">
                        <td className="py-2 pr-4 whitespace-nowrap">{u.name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{u.username || <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{u.email || <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-2 pr-4">{u.minutesPracticed}</td>
                        <td className="py-2 pr-2 text-right">
                          <AlertDialog open={userToDelete?.uid === u.uid} onOpenChange={(open) => setUserToDelete(open ? u : null)}>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete user?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the user's Firestore data and their Firebase Authentication account.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(u.uid)} disabled={deletingUid === u.uid}>
                                  {deletingUid === u.uid ? "Deleting…" : "Delete"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


