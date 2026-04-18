/**
 * @file This component displays a score with a circular progress indicator.
 * It's used to show user performance metrics in a visually appealing way.
 */
import React from 'react';
import { Card, CardContent } from './card';
import { CircularProgress } from './progress-indicator';
import { cn } from '@/lib/utils';

interface ScoreCardProps {
  score: number;
  total: number;
  label: string;
  className?: string;
}

export function ScoreCard({ score, total, label, className }: ScoreCardProps) {
  const percentage = (score / total) * 100;
  
  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="flex items-center justify-center p-3 sm:p-4 md:p-6">
        <div className="text-center space-y-3">
          <div className="relative">
            <CircularProgress value={percentage} size={84} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold">{score}</div>
                <div className="text-xs text-muted-foreground">/ {total}</div>
              </div>
            </div>
          </div>
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
} 