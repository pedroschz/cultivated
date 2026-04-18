"use client";

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Calculator as CalculatorIcon, XIcon } from 'lucide-react';

export interface CalculatorSidebarRef {
  addExpression: (latex: string) => void;
}

interface CalculatorSidebarProps {
  className?: string;
  onOpenChange?: (isOpen: boolean) => void;
  isCanvasMinimized?: boolean;
}

export const CalculatorSidebar = forwardRef<CalculatorSidebarRef, CalculatorSidebarProps>(({
  className,
  onOpenChange,
  isCanvasMinimized = true
}, ref) => {
  const [isOpen, setIsOpenState] = useState(true);
  const [width, setWidth] = useState(400); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const desmosContainerRef = useRef<HTMLDivElement>(null);
  const desmosInstanceRef = useRef<any>(null);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(400);
  const pendingExpressionRef = useRef<string | null>(null);

  const setIsOpen = (value: boolean) => {
    setIsOpenState(value);
    onOpenChange?.(value);
  };

  useImperativeHandle(ref, () => ({
    addExpression: (latex: string) => {
      if (!isOpen) {
        setIsOpen(true);
        pendingExpressionRef.current = latex;
      } else if (desmosInstanceRef.current) {
        desmosInstanceRef.current.setExpression({ latex });
      } else {
        pendingExpressionRef.current = latex;
      }
    }
  }));

  // Ensure Desmos API is loaded
  const ensureDesmosLoaded = async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.Desmos) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_DESMOS_API_KEY;
      if (!apiKey) {
        console.error('NEXT_PUBLIC_DESMOS_API_KEY is not set');
        reject(new Error('Missing Desmos API key'));
        return;
      }
      script.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Desmos API'));
      document.head.appendChild(script);
    });
  };

  // Initialize Desmos calculator
  useEffect(() => {
    let destroyed = false;
    (async () => {
      if (isOpen && desmosContainerRef.current) {
        try {
          await ensureDesmosLoaded();
          if (!desmosContainerRef.current) return;
          const w = window as any;
          // Destroy any previous instance
          if (desmosInstanceRef.current && desmosInstanceRef.current.destroy) {
            desmosInstanceRef.current.destroy();
            desmosInstanceRef.current = null;
          }
          desmosInstanceRef.current = w.Desmos.GraphingCalculator(desmosContainerRef.current, {
            expressions: true,
            keypad: true,
            settingsMenu: true,
            zoomButtons: true,
            border: true,
          });
          
          if (pendingExpressionRef.current) {
             desmosInstanceRef.current.setExpression({ latex: pendingExpressionRef.current });
             pendingExpressionRef.current = null;
          }
        } catch (e) {
          console.error('Failed to initialize Desmos:', e);
        }
      } else {
        if (desmosInstanceRef.current && desmosInstanceRef.current.destroy) {
          desmosInstanceRef.current.destroy();
          desmosInstanceRef.current = null;
        }
      }
    })();
    return () => {
      if (destroyed) return;
      destroyed = true;
      if (desmosInstanceRef.current && desmosInstanceRef.current.destroy) {
        desmosInstanceRef.current.destroy();
        desmosInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Resize Desmos when the container size changes
  useEffect(() => {
    if (desmosInstanceRef.current && isOpen) {
      try {
        desmosInstanceRef.current.resize();
      } catch (e) {
        // ignore
      }
    }
  }, [width, isOpen]);

  // Resize handler
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = resizeStartXRef.current - e.clientX; // Inverted for left-side resize
      const newWidth = Math.max(300, Math.min(600, resizeStartWidthRef.current + diff));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = width;
  };

  if (!isOpen) {
    // Calculator button is always at right-4
    const rightPosition = "right-4 md:right-4";
    
    return (
      <div 
        className={cn("fixed", rightPosition, "bottom-28 md:bottom-32 z-[60] bg-white dark:bg-card rounded-lg border-2 border-[#E5E5E5] dark:border-border border-b-4 p-2 cursor-pointer flex items-center justify-center transition-all duration-300 w-10 h-10")} 
        onClick={() => setIsOpen(true)}
      >
        <CalculatorIcon className="h-5 w-5 text-[#AFAFAF] dark:text-muted-foreground" />
      </div>
    );
  }

  return (
    <div 
      ref={sidebarRef}
      className={cn(
        "flex flex-col bg-white dark:bg-card border-l-2 border-b-2 border-[#E5E5E5] dark:border-border shrink-0 transition-all duration-300 relative overflow-hidden z-[60]",
        "!h-[calc(100vh-112px)]",
        className
      )}
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-[#93d333]/30 z-10 transition-colors"
        title="Drag to resize"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-card border-b-2 border-[#E5E5E5] dark:border-border shrink-0">
        <div className="flex items-center gap-2">
          <CalculatorIcon className="h-5 w-5 text-[#4B4B4B] dark:text-foreground" />
          <div className="font-bold text-lg text-[#4B4B4B] dark:text-foreground">Calculator</div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-[#AFAFAF] dark:text-muted-foreground hover:text-[#4B4B4B] dark:hover:text-foreground hover:bg-transparent">
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Calculator Container */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-card relative p-2">
        <div ref={desmosContainerRef} id="desmos-calculator" className="w-full h-full rounded" />
      </div>
    </div>
  );
});

CalculatorSidebar.displayName = 'CalculatorSidebar';
