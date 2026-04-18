"use client";

import { Progress } from '@/components/ui/progress';
import { FREE_LIMITS } from '@/lib/ai/usageClient';
import type { AiUsage } from '@/lib/context/UserContext';
import { Mic, MessageSquare, DollarSign } from 'lucide-react';

interface UsageBarProps {
  usage: AiUsage;
  hasByok: boolean;
}

export function UsageBar({ usage, hasByok }: UsageBarProps) {
  const rows = [
    {
      label: 'Voice calls',
      icon: Mic,
      used: usage.voiceCalls,
      limit: FREE_LIMITS.voiceCalls,
    },
    {
      label: 'Chat messages',
      icon: MessageSquare,
      used: usage.chatMessages,
      limit: FREE_LIMITS.chatMessages,
    },
    {
      label: 'Token cost',
      icon: DollarSign,
      used: usage.totalCostCents,
      limit: FREE_LIMITS.costCents,
      format: (v: number) => `$${(v / 100).toFixed(2)}`,
    },
  ] as const;

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = Math.min(100, (row.used / row.limit) * 100);
        const fmt = 'format' in row ? row.format : (v: number) => String(v);
        const atLimit = row.used >= row.limit;
        const Icon = row.icon;

        return (
          <div key={row.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {row.label}
              </span>
              <span className={atLimit && !hasByok ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
                {fmt(row.used)} / {hasByok ? '∞' : fmt(row.limit)}
              </span>
            </div>
            <Progress
              value={hasByok ? 0 : pct}
              className="h-2"
              style={{
                '--progress-foreground': atLimit && !hasByok ? 'var(--destructive, #ef4444)' : undefined,
              } as React.CSSProperties}
            />
          </div>
        );
      })}

      {hasByok && usage.totalCostCents > 0 && (
        <p className="text-xs text-muted-foreground pt-1">
          Total usage with your key: ${(usage.totalCostCents / 100).toFixed(2)}
        </p>
      )}
    </div>
  );
}
