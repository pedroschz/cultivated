"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { XIcon, FileText } from 'lucide-react';
import { Button } from './button';

interface ProcedureQRProps {
  className?: string;
  isCalculatorOpen?: boolean;
  isMinimized?: boolean;
  onMinimizedChange?: (isMinimized: boolean) => void;
}

/**
 * A QR code component that's always visible at the bottom right of the screen.
 * Links to the procedure canvas page for iPad connection.
 * Uses a static image file for the QR code.
 * Can be minimized to show only the logo icon.
 */
export function ProcedureQR({ className, isCalculatorOpen = false, isMinimized: externalIsMinimized, onMinimizedChange }: ProcedureQRProps) {
  const [internalIsMinimized, setInternalIsMinimized] = useState(false);
  
  // Use external prop if provided, otherwise use internal state
  const isMinimized = externalIsMinimized !== undefined ? externalIsMinimized : internalIsMinimized;

  const handleMinimizedChange = (minimized: boolean) => {
    if (externalIsMinimized === undefined) {
      // Only update internal state if not controlled externally
      setInternalIsMinimized(minimized);
    }
    onMinimizedChange?.(minimized);
  };

  // Calculate position based on calculator state
  // When calculator is collapsed: calculator button is at right-4, canvas should be at right-[72px] (to the left of calculator)
  // When calculator is open: position to the left of calculator sidebar (default width ~400px)
  const rightPosition = isCalculatorOpen 
    ? "right-[420px] md:right-[420px]" // Calculator sidebar is open, position to its left
    : "right-[72px] md:right-[72px]";  // Calculator is collapsed, canvas is to the left of calculator button

  if (isMinimized) {
    return (
      <div className={cn(
        "fixed z-[60] bg-white dark:bg-card rounded-lg border-2 border-[#E5E5E5] dark:border-border border-b-4 p-2 cursor-pointer flex items-center justify-center transition-all duration-300 w-10 h-10",
        "bottom-28 md:bottom-32",
        rightPosition, // Position based on calculator state
        className
      )} onClick={() => handleMinimizedChange(false)}>
        <FileText className="h-5 w-5 text-[#AFAFAF] dark:text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed z-[60] bg-white dark:bg-card rounded-lg p-3",
      // Position above bottom bar
      // Mobile: above bottom nav (typically ~64px tall) + margin
      // Desktop: above bottom submit section (py-8 = 32px top/bottom + button height ~48px = ~112px total) + margin
      "bottom-28 md:bottom-32",
      rightPosition, // Position based on calculator state
      className
    )}>
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-full flex items-center justify-center text-sm font-semibold text-[#4B4B4B] dark:text-foreground">
          <span className="relative">
            <Image
              src="/logo.png"
              alt="CultivatED"
              width={16}
              height={16}
              className="absolute -left-5 top-1/2 -translate-y-1/2 dark:hidden"
            />
            <Image
              src="/logo-dark.png"
              alt="CultivatED"
              width={16}
              height={16}
              className="absolute -left-5 top-1/2 -translate-y-1/2 hidden dark:block"
            />
            Canvas
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleMinimizedChange(true);
            }}
            className="absolute right-0 h-6 w-6 p-0 text-[#AFAFAF] dark:text-muted-foreground hover:text-[#4B4B4B] dark:hover:text-foreground hover:bg-transparent"
          >
            <XIcon className="h-3 w-3" />
          </Button>
        </div>
        <Image
          src="/procedure-qr.png"
          alt="Procedure canvas QR"
          width={120}
          height={120}
          className="rounded-md bg-white"
        />
        <div className="text-xs text-muted-foreground text-center max-w-[140px]">
          Live math feedback
        </div>
      </div>
    </div>
  );
}
