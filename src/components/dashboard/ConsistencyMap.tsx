"use client";

import { cn } from '@/lib/utils';

export type ConsistencyMapDay = {
  date: string;
  minutes: number;
  level: number;
};

interface ConsistencyMapProps {
  days: ConsistencyMapDay[];
  weeks?: number;
  rows?: number;
  dotClassName?: string;
  className?: string;
  gridClassName?: string;
}

const LEVEL_CLASSES = [
  'bg-muted/60',
  'bg-emerald-200',
  'bg-emerald-300',
  'bg-emerald-400',
  'bg-emerald-500',
];

export function ConsistencyMap({ 
  days, 
  weeks = 12, 
  rows = 7,
  dotClassName = 'h-3 w-3',
  className,
  gridClassName
}: ConsistencyMapProps) {
  const totalDays = weeks * rows;
  const trimmed = days.slice(-totalDays);

  if (trimmed.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-4 h-full", className)}>
      <div 
        className={cn("grid grid-flow-col gap-1 place-content-start", gridClassName)}
        style={{ gridTemplateRows: `repeat(${rows}, min-content)` }}
      >
        {trimmed.map((day, idx) => {
          const levelClass = LEVEL_CLASSES[Math.max(0, Math.min(4, day.level))];
          return (
            <div
              key={`${day.date}-${idx}`}
              title={`${day.date} - ${day.minutes} min`}
              className={cn('rounded-full', dotClassName, levelClass)}
            />
          );
        })}
      </div>
    </div>
  );
}
