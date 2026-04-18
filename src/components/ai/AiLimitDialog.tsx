"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UsageBar } from './UsageBar';
import { onAiLimitPopup } from '@/lib/ai/usageClient';
import { useUser } from '@/lib/context/UserContext';
import { KeyRound } from 'lucide-react';

export function AiLimitDialog() {
  const [open, setOpen] = useState(false);
  const { userData } = useUser();
  const router = useRouter();

  useEffect(() => {
    return onAiLimitPopup(() => setOpen(true));
  }, []);

  const usage = userData?.aiUsage ?? { voiceCalls: 0, chatMessages: 0, totalCostCents: 0 };
  const hasByok = !!userData?.geminiApiKey;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Free AI quota reached
          </DialogTitle>
          <DialogDescription>
            You&apos;ve used your free AI allocation on CultivatED. To keep using AI
            features, add your own Gemini API key in Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <UsageBar usage={usage} hasByok={hasByok} />
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              setOpen(false);
              router.push('/settings#ai-key');
            }}
          >
            Go to Settings
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
