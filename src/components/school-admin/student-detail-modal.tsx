"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { app, db } from "@/lib/firebaseClient";
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface TabSwitchEvent {
  timestamp: number;
}

interface HistoryEntry {
  id: string;
  questionId: string;
  answeredAtTs: number;
  timeSpent: number;
  correct: boolean;
  topic?: string;
  difficulty?: string;
}

interface StudentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  studentName: string;
}

export function StudentDetailModal({ isOpen, onClose, studentId, studentName }: StudentDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [tabSwitches, setTabSwitches] = useState<number>(0);
  const [events, setEvents] = useState<TabSwitchEvent[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleRemoveStudent = async () => {
    if (!studentId || !app) return;
    setIsRemoving(true);
    try {
      const functions = getFunctions(app);
      const leaveFn = httpsCallable(functions, 'leaveSchoolCallable');
      await leaveFn({ studentId });
      toast.success(`Removed ${studentName} from school`);
      onClose();
      // We should ideally refresh the parent list, but a reload or letting the real-time listener (if any) handle it is okay.
      // The parent component uses onAuthStateChanged to fetch, so it won't auto-refresh unless triggered.
      // We can force a reload of the page or pass a callback.
      window.location.reload(); 
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to remove student");
    } finally {
      setIsRemoving(false);
      setShowRemoveConfirm(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !studentId || !app) return;

    const fetchDetails = async () => {
      setLoading(true);
      setHistoryLoading(true);
      try {
        // Fetch session details
        const sessionRef = doc(db, 'users', studentId, 'practice', 'session');
        const sessionSnap = await getDoc(sessionRef);
        
        if (sessionSnap.exists()) {
          const data = sessionSnap.data();
          const sessionData = data.session || {};
          setTabSwitches(sessionData.tabSwitches || 0);
          setEvents(sessionData.tabSwitchEvents || []);
        } else {
            setTabSwitches(0);
            setEvents([]);
        }

        // Fetch recent history
        const historyRef = collection(db, 'users', studentId, 'history');
        const q = query(historyRef, orderBy('answeredAtTs', 'desc'), limit(50));
        const historySnap = await getDocs(q);
        const historyData = historySnap.docs.map(d => ({ id: d.id, ...d.data() })) as HistoryEntry[];
        setHistory(historyData);

      } catch (err) {
        console.error("Error fetching student details:", err);
      } finally {
        setLoading(false);
        setHistoryLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, studentId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{studentName}</DialogTitle>
          <DialogDescription>Student details and recent activity.</DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">Recent Questions</TabsTrigger>
            <TabsTrigger value="monitor">Live Session Monitor</TabsTrigger>
          </TabsList>
          
          <TabsContent value="history" className="space-y-4 pt-4">
             <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Question ID</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Time Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">Loading history...</TableCell>
                    </TableRow>
                  ) : history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No recent history found.</TableCell>
                    </TableRow>
                  ) : (
                    history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(entry.answeredAtTs).toLocaleString(undefined, { 
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                          })}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{entry.questionId}</TableCell>
                        <TableCell>
                          <Badge variant={entry.correct ? "default" : "destructive"}>
                            {entry.correct ? "Correct" : "Incorrect"}
                          </Badge>
                        </TableCell>
                        <TableCell>{Math.round(entry.timeSpent || 0)}s</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="monitor" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg bg-muted/20">
                <div className="text-sm text-muted-foreground">Tab Switches (Current Session)</div>
                <div className="text-2xl font-bold">{loading ? '...' : tabSwitches}</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Tab Switch Events</h4>
              <div className="border rounded-md max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Event</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : events.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">No tab switches recorded in current session.</TableCell>
                      </TableRow>
                    ) : (
                      events.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell>{new Date(e.timestamp).toLocaleTimeString()}</TableCell>
                          <TableCell>Switched Tab / Minimized</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 flex justify-between sm:justify-between items-center border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Student ID: <span className="font-mono">{studentId}</span>
          </div>
          <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Remove from School
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Student</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove <strong>{studentName}</strong> from the school?
                  <br /><br />
                  They will lose access to school assignments and classes. They can rejoin later with an invite code.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveStudent} disabled={isRemoving} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  {isRemoving ? "Removing..." : "Yes, Remove"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
