"use client";

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebaseClient';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Bug } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

/**
 * @file This component provides a dialog interface for users to report bugs or issues
 * they encounter while using the application. It handles user authentication, form
 * validation, and submission to Firebase Firestore.
 */

/**
 * Programmatically submit a bug report using the same logic as the dialog.
 */
export async function submitBugReport({ description, questionId }: { description: string; questionId?: string | null }) {
  const trimmed = (description || '').trim();
  if (!trimmed) {
    toast.error('Please enter a description of the bug.');
    throw new Error('Missing description');
  }
  if (!auth || !auth.currentUser) {
    toast.error('You must be logged in to report a bug.');
    throw new Error('Not authenticated');
  }
  if (!db) {
    toast.error('Firebase is not initialized.');
    throw new Error('Firebase not initialized');
  }

  const reportData = {
    userId: auth.currentUser.uid,
    description: trimmed,
    questionId: questionId || null,
    createdAt: serverTimestamp(),
    status: 'new',
    url: typeof window !== 'undefined' ? window.location.href : '',
  } as const;

  const reportsRef = collection(db, 'reports');
  await addDoc(reportsRef, reportData);

  if (questionId) {
    const questionRef = doc(db, 'questions', questionId);
    await updateDoc(questionRef, { reported: true });
  }

  toast.success('Your bug report has been submitted. Thank you!');
}

/**
 * Props for the ReportBugDialog component.
 */
interface ReportBugDialogProps {
  /** Optional question ID if the bug is related to a specific question. */
  questionId?: string;
  /** Custom trigger element to open the dialog. */
  trigger?: React.ReactNode;
  /** Callback function called after a successful report submission. */
  onReport?: () => void;
  /** Optional default description to prefill the report with when opening. */
  defaultDescription?: string;
}

/**
 * A dialog component that allows users to report bugs or issues they encounter.
 * It includes form validation, user authentication checks, and submission to Firebase.
 * 
 * @param questionId - Optional ID of the question if the bug is question-specific.
 * @param trigger - Custom trigger element to open the dialog.
 * @param onReport - Callback function called after successful submission.
 * @returns A React component with the bug reporting dialog.
 */
export function ReportBugDialog({ questionId, trigger, onReport, defaultDescription }: ReportBugDialogProps) {
  // State for dialog visibility, form data, submission status, and user authentication
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('other');

  const REASONS = [
    { value: 'table', label: 'Table has an issue/no visible table' },
    { value: 'typo', label: 'Typo' },
    { value: 'equation_misplaced', label: 'One of the equations is misplaced (not centered)' },
    { value: 'answer_wrong', label: 'I think the answer is wrong' },
    { value: 'other', label: 'Something else' },
  ] as const;

  // Listen for authentication state changes
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Prefill description when dialog opens if a defaultDescription is provided
  useEffect(() => {
    if (isOpen && defaultDescription && !description) {
      setDescription(defaultDescription);
      setSelectedReason('other');
    }
  }, [isOpen, defaultDescription, description]);

  /**
   * Handles the submission from within the dialog by delegating to submitBugReport.
   */
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Prefer typed reason when provided; fall back to freeform text
      let finalDescription = (description || '').trim();
      if (!finalDescription) {
        const match = REASONS.find(r => r.value === selectedReason);
        finalDescription = match ? match.label : '';
      }
      await submitBugReport({ description: finalDescription, questionId });
      setIsOpen(false);
      setDescription('');
      setSelectedReason('other');
      onReport?.();
    } catch (error: any) {
      console.error('Failed to submit bug report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Bug className="mr-2 h-4 w-4" />
            Report a Bug
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full gap-2">
            <Label>What seems wrong?</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem id={`reason-${r.value}`} value={r.value} />
                  <Label htmlFor={`reason-${r.value}`}>{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          {selectedReason === 'other' && (
            <div className="grid w-full gap-1.5">
              <Label htmlFor="description">
                Please describe the issue you're experiencing. The more detail, the better!
              </Label>
              <Textarea
                id="description"
                placeholder="I was on the practice page and..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 