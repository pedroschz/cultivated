"use client";

import React from 'react';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface ProcedureConnectButtonProps {
  className?: string;
}

/**
 * A floating button that opens a dialog with a QR code linking to the procedure canvas page.
 * Uses an external QR image service to avoid adding new dependencies.
 */
export function ProcedureConnectButton({ className }: ProcedureConnectButtonProps) {
  const baseUrl = (process.env.NEXT_PUBLIC_WEB_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url = `${baseUrl}/procedure`;

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("rounded-full h-12 w-12 p-0 shadow-md", className)}
          aria-label="Open procedure canvas QR"
        >
          <FileText className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Connect your iPad</DialogTitle>
          <DialogDescription>
            Scan this QR with your iPad to open the canvas. Sign in with the same account.
          </DialogDescription>
        </DialogHeader>
        <div className="w-full flex flex-col items-center gap-3">
          <img
            src={qrSrc}
            alt="Procedure canvas QR"
            width={220}
            height={220}
            className="border rounded-md bg-white"
          />
          <div className="text-xs text-muted-foreground break-all text-center px-2">
            {url}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            The AI will transcribe your written steps and warn if they go off-track.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


