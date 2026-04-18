"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebaseClient";
import { Copy, RefreshCw } from "lucide-react";

interface InviteTeacherDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteTeacherDialog({ isOpen, onClose }: InviteTeacherDialogProps) {
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const generateLink = async () => {
    try {
      if (!app) return;
      setLoading(true);
      const functions = getFunctions(app, 'us-central1');
      const inviteTeacher = httpsCallable(functions, 'inviteTeacherCallable');
      const res: any = await inviteTeacher({});
      const link = String(res?.data?.link || '');
      if (link) {
        setInviteLink(link);
        copyToClipboard(link);
      } else {
        toast.error("Failed to generate link");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error generating invite");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a Teacher</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Generate a unique invite link for a teacher to join your school.
          </p>
          
          {inviteLink ? (
            <div className="flex flex-col gap-2 p-3 bg-muted rounded-md">
              <div className="text-xs font-mono break-all">{inviteLink}</div>
              <Button size="sm" variant="secondary" className="w-full mt-2" onClick={() => copyToClipboard(inviteLink)}>
                <Copy className="h-3 w-3 mr-2" />
                Copy Link
              </Button>
            </div>
          ) : (
            <div className="flex justify-center p-4">
               <Button onClick={generateLink} disabled={loading}>
                 {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                 Generate Invite Link
               </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
