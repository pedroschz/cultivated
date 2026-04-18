"use client";

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

interface Metric {
  label: string;
  value: string | number;
}

interface MetricsBarProps {
  metrics: Metric[];
  align?: 'left' | 'center' | 'right';
}

function MetricsBar({ metrics, align = 'left' }: MetricsBarProps) {
  return (
    <div
      className={cn(
        'flex gap-6 overflow-x-auto no-scrollbar py-2 animate-fade-in',
        align === 'center' && 'justify-center',
        align === 'right' && 'justify-end'
      )}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {metrics.map((metric) => {
        // Flat colors map - using CSS variables for adaptability where possible, or specific colors that work on both
        const colorClasses = {
          ACCURACY: 'text-foreground', 
          'Study Time': 'text-[#1CB0F6]', // Macaw
          Math: 'text-[#FF4B4B]', // Cardinal
          'R&W': 'text-[#2B70C9]', // Humpback (or close blue)
          'Point Increase': 'text-[#93d333]', // Owl
          'Projected Score': 'text-[#93d333]',
        } as Record<string, string>;

        let labelText = metric.label;
        if (metric.label === 'Overall') {
          labelText = 'ACCURACY';
        }
        const colorClass = colorClasses[labelText] || 'text-[#93d333]';

        return (
          <div
            key={metric.label}
            className="shrink-0 text-center py-0"
          >
            <span className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
              {labelText}
            </span>
            <span className={cn('block text-3xl font-extrabold leading-none', colorClass)}>
              {metric.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface HeroSectionProps {
  userName: string | null;
  onStart10Math: () => void;
  onStart10RW: () => void;
  onStart20Math: () => void;
  onStart20RW: () => void;
  overallMastery?: number;
  dayStreak?: number;
  metrics?: { label: string; value: string | number }[];
  headerAction?: React.ReactNode;
}

export function HeroSection({ userName, onStart10Math, onStart10RW, onStart20Math, onStart20RW, overallMastery, dayStreak, metrics, headerAction }: HeroSectionProps) {
  return (
    <section
      className="relative w-full overflow-hidden rounded-2xl md:rounded-3xl border-2 border-border border-b-4 bg-card px-4 sm:px-6 md:px-8 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 animate-fade-in"
    >
      {headerAction && (
        <div className="absolute top-4 right-4 z-20">
          {headerAction}
        </div>
      )}
      
      {/* Left side: Greeting and action buttons */}
      <div className="space-y-4 max-w-full md:max-w-xl">
        <div className="relative z-10 flex items-end gap-3 sm:gap-4">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            {userName ? `Good to see you, ${userName}!` : 'Welcome!'}
          </h1>
          {typeof dayStreak === 'number' && (
            <div className="flex flex-col items-center translate-y-[-3px] -translate-x-[-10px]">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Streak</span>
               <div className="flex items-center gap-1">
                 <Flame className="h-6 w-6 text-[#FF9600] fill-[#FF9600]" />
                 <span className="text-3xl sm:text-5xl md:text-6xl font-extrabold leading-none text-[#FF9600]">{dayStreak}</span>
               </div>
            </div>
          )}
        </div>
        <p className="relative z-10 text-sm sm:text-lg text-muted-foreground font-medium">
          Expect to find new features everyday. Welcome to the Beta!<br />
          Jump into a quick practice session and keep your streak alive.
        </p>

        <div className="relative z-10 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              <div className="bg-card rounded-2xl border-2 border-border border-b-4 py-3">
                <div className="px-3 pt-1 pb-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground text-center font-bold">Math</div>
                </div>
                <div className="pt-2 px-3 pb-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" className="h-9 w-full bg-[#93d333] border-0 border-b-[4px] border-b-[#79b933] hover:bg-[#95DF26] text-white" onClick={onStart10Math}>10 min</Button>
                    <Button size="sm" className="h-9 w-full bg-[#93d333] border-0 border-b-[4px] border-b-[#79b933] hover:bg-[#95DF26] text-white" onClick={onStart20Math}>20 min</Button>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="bg-card rounded-2xl border-2 border-border border-b-4 py-3">
                  <div className="px-3 pt-1 pb-1">
                     <div className="text-xs uppercase tracking-wider text-muted-foreground text-center font-bold">Reading & Writing</div>
                  </div>
                  <div className="pt-2 px-3 pb-1">
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button size="sm" className="h-9 w-full bg-[#1CB0F6] border-0 border-b-[4px] border-b-[#1899D6] hover:bg-[#40C3FF] text-white" onClick={onStart10RW}>10 min</Button>
                      <Button size="sm" className="h-9 w-full bg-[#1CB0F6] border-0 border-b-[4px] border-b-[#1899D6] hover:bg-[#40C3FF] text-white" onClick={onStart20RW}>20 min</Button>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="absolute -top-3 -right-3 uppercase tracking-wide bg-[#FFC800] text-[#4B4B4B] border-[#D9AA00] border-b-2 font-bold rotate-6">beta</Badge>
              </div>
            </div>
          </div>
      </div>

      {/* Right side: Overall mastery display and metrics (or skeletons if no data yet) */}
      <div className="relative z-10 text-center space-y-4">
        {overallMastery !== undefined ? (
          <div>
            <p className="text-sm uppercase tracking-wider text-muted-foreground font-bold mb-1 text-center">Mastery Level</p>
            <p className="flex items-baseline justify-center">
              <span className="text-7xl sm:text-9xl md:text-[10rem] font-display font-extrabold text-[#93d333]">
                {Math.round(overallMastery)}
              </span>
              <span className="text-3xl sm:text-5xl md:text-6xl font-display font-extrabold text-[#93d333] ml-2">%</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <p className="text-sm uppercase tracking-wider text-muted-foreground font-bold mb-3 text-center">Mastery Level</p>
            <div className="relative flex items-center justify-center">
              <Skeleton className="h-36 w-36 sm:h-48 sm:w-48 rounded-full bg-muted" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Skeleton className="h-8 w-16 rounded-md bg-muted" />
              </div>
            </div>
          </div>
        )}
        {overallMastery !== undefined ? (
          metrics && <MetricsBar metrics={metrics} align="center" />
        ) : (
          <div className="flex gap-6 justify-center md:justify-end py-2">
            <div className="text-center py-0">
              <Skeleton className="h-3 w-10 mx-auto mb-2 bg-muted" />
              <Skeleton className="h-8 w-16 rounded bg-muted" />
            </div>
            <div className="text-center py-0">
              <Skeleton className="h-3 w-14 mx-auto mb-2 bg-muted" />
              <Skeleton className="h-8 w-20 rounded bg-muted" />
            </div>
            <div className="text-center py-0">
              <Skeleton className="h-3 w-8 mx-auto mb-2 bg-muted" />
              <Skeleton className="h-8 w-12 rounded bg-muted" />
            </div>
            <div className="text-center py-0">
              <Skeleton className="h-3 w-8 mx-auto mb-2 bg-muted" />
              <Skeleton className="h-8 w-12 rounded bg-muted" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
