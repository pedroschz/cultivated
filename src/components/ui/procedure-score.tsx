"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface ProcedureScoreProps {
  score?: number | null;
  className?: string;
  compact?: boolean;
}

/**
 * Pill-shaped bar with a center divide showing a 1–5 score.
 * Title: "Procedure Score (experimental)".
 */
export function ProcedureScore({ score, className, compact = false }: ProcedureScoreProps) {
  const clamped = typeof score === 'number' && !Number.isNaN(score)
    ? Math.min(5, Math.max(1, Math.round(score)))
    : null;

  // Map 1..5 to percentage fill across the whole pill
  const percent = clamped ? ((clamped - 1) / 4) * 100 : 0;

  return (
    <div className={cn("w-full", className)}>
      {!compact && (
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Procedure Score (experimental)</div>
          <div className="text-xs text-muted-foreground">{clamped ? `${clamped}/5` : '—'}</div>
        </div>
      )}
      <div
        className={cn(
          "relative overflow-hidden rounded-full border border-border",
          compact ? "h-2 bg-muted" : "h-6 bg-muted/70"
        )}
      >
        {/* fill (thin, green like time progress) */}
        <div
          className={cn(
            "absolute inset-y-0 left-0",
            compact ? "bg-emerald-500" : "bg-primary/80"
          )}
          style={{ width: `${percent}%` }}
        />
        {/* tick labels (hide in compact) */}
        {!compact && (
          <div className="relative z-10 flex h-full items-center justify-between px-2 text-[10px] text-muted-foreground select-none">
            {[1,2,3,4,5].map(n => (
              <span key={n} className={cn("tabular-nums", clamped === n && "text-foreground font-medium")}>{n}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


