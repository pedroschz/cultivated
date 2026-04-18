"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PracticeWidgetProps {
  w: number;
  h: number;
  onStartSession: (minutes: number, subject: 'Math' | 'Reading & Writing') => void;
  gridScale?: number;
}

const MATH_COLOR = "bg-[#93d333] border-[#79b933] hover:bg-[#95DF26]";
const RW_COLOR = "bg-[#1CB0F6] border-[#1899D6] hover:bg-[#40C3FF]";

export const PracticeWidget = ({ w, h, onStartSession, gridScale = 2 }: PracticeWidgetProps) => {
  const gridW = w / gridScale;
  const gridH = h / gridScale;
  const hasWidth2 = w === 2; // Check if grid width is 2

  // Case 1: Height 1, Width 2 (Grid W=2, H=1)
  if (Math.round(gridH) === 1 && Math.round(gridW) === 2) {
    return <PracticeWidget1x2 onStartSession={onStartSession} hasWidth2={hasWidth2} />;
  }

  // Case 2: Height 1, Width 3+ (Grid H=1, W>=3)
  if (Math.round(gridH) === 1 && Math.round(gridW) >= 3) {
    return <PracticeWidget1x3Plus onStartSession={onStartSession} hasWidth2={hasWidth2} />;
  }

  // Case 3: 2x2 (Grid units w=2, h=2) - Vertical hover animation
  // ONLY this specific size should have the animation - CHECK BEFORE Case 4
  if (w === 2 && h === 2) {
    return <PracticeWidget2x2 onStartSession={onStartSession} hasWidth2={hasWidth2} />;
  }

  // Case 4: Height X, Width 1 (Vertical Stack) (Grid W=1, but NOT 2x2)
  if (Math.round(gridW) === 1) {
    return <PracticeWidgetNx1 onStartSession={onStartSession} hasWidth2={hasWidth2} />;
  }

  // Default Case
  return <PracticeWidgetDefault onStartSession={onStartSession} hasWidth2={hasWidth2} />;
};

const PracticeWidget1x2 = ({ onStartSession, hasWidth2 }: { onStartSession: PracticeWidgetProps['onStartSession']; hasWidth2: boolean }) => {
  const [hovered, setHovered] = useState<'math' | 'rw' | null>(null);

  return (
    <div className={cn("h-full w-full relative", hasWidth2 && "px-5")} onMouseLeave={() => setHovered(null)}>
      <AnimatePresence mode="popLayout">
        {hovered === null ? (
          <div className="grid grid-cols-2 gap-2 h-full w-full">
            <motion.div
              layoutId="math-container"
              className="h-full"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                className={cn("w-full h-full text-white font-bold", MATH_COLOR)}
                onMouseEnter={() => setHovered('math')}
              >
                Math
              </Button>
            </motion.div>
            <motion.div
              layoutId="rw-container"
              className="h-full"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                className={cn("w-full h-full text-white font-bold", RW_COLOR)}
                onMouseEnter={() => setHovered('rw')}
              >
                R&W
              </Button>
            </motion.div>
          </div>
        ) : hovered === 'math' ? (
          <motion.div
            key="math-expanded"
            layoutId="math-container"
            className="grid grid-cols-2 gap-2 h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <Button
                className={cn("w-full h-full text-white font-bold", MATH_COLOR)}
                onClick={() => onStartSession(10, 'Math')}
              >
                10 min
              </Button>
            </motion.div>
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <Button
                className={cn("w-full h-full text-white font-bold", MATH_COLOR)}
                onClick={() => onStartSession(20, 'Math')}
              >
                20 min
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="rw-expanded"
            layoutId="rw-container"
            className="grid grid-cols-2 gap-2 h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
             <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <Button
                className={cn("w-full h-full text-white font-bold", RW_COLOR)}
                onClick={() => onStartSession(10, 'Reading & Writing')}
              >
                10 min
              </Button>
            </motion.div>
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <Button
                className={cn("w-full h-full text-white font-bold", RW_COLOR)}
                onClick={() => onStartSession(20, 'Reading & Writing')}
              >
                20 min
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PracticeWidget1x3Plus = ({ onStartSession, hasWidth2 }: { onStartSession: PracticeWidgetProps['onStartSession']; hasWidth2: boolean }) => {
  return (
    <div className={cn("grid grid-cols-4 gap-2 h-full items-center", hasWidth2 && "px-5")}>
      <Button className={cn("h-full text-white text-xs px-1", MATH_COLOR)} onClick={() => onStartSession(10, 'Math')}>10m Math</Button>
      <Button className={cn("h-full text-white text-xs px-1", MATH_COLOR)} onClick={() => onStartSession(20, 'Math')}>20m Math</Button>
      <Button className={cn("h-full text-white text-xs px-1", RW_COLOR)} onClick={() => onStartSession(10, 'Reading & Writing')}>10m R&W</Button>
      <Button className={cn("h-full text-white text-xs px-1", RW_COLOR)} onClick={() => onStartSession(20, 'Reading & Writing')}>20m R&W</Button>
    </div>
  );
};

const PracticeWidgetNx1 = ({ onStartSession, hasWidth2 }: { onStartSession: PracticeWidgetProps['onStartSession']; hasWidth2: boolean }) => {
  return (
    <div className={cn("flex flex-col h-full", hasWidth2 ? "px-5 pb-4 gap-2" : "px-1 justify-center gap-1")}>
      <Button size="sm" className={cn("w-full text-white px-1 tracking-tighter scale-x-110 origin-center", hasWidth2 ? "text-sm flex-1" : "text-[12px] flex-1", MATH_COLOR)} onClick={() => onStartSession(10, 'Math')}>10m Math</Button>
      <Button size="sm" className={cn("w-full text-white px-1 tracking-tighter scale-x-110 origin-center", hasWidth2 ? "text-sm flex-1" : "text-[12px] flex-1", MATH_COLOR)} onClick={() => onStartSession(20, 'Math')}>20m Math</Button>
      <Button size="sm" className={cn("w-full text-white px-1 tracking-tighter scale-x-110 origin-center", hasWidth2 ? "text-sm flex-1" : "text-[12px] flex-1", RW_COLOR)} onClick={() => onStartSession(10, 'Reading & Writing')}>10m R&W</Button>
      <Button size="sm" className={cn("w-full text-white px-1 tracking-tighter scale-x-110 origin-center", hasWidth2 ? "text-sm flex-1" : "text-[12px] flex-1", RW_COLOR)} onClick={() => onStartSession(20, 'Reading & Writing')}>20m R&W</Button>
    </div>
  );
};

const PracticeWidget2x2 = ({ onStartSession, hasWidth2 }: { onStartSession: PracticeWidgetProps['onStartSession']; hasWidth2: boolean }) => {
  const [hovered, setHovered] = useState<'math' | 'rw' | null>(null);

  return (
    <div className={cn("h-full w-full relative", hasWidth2 && "px-5")} onMouseLeave={() => setHovered(null)}>
      <AnimatePresence mode="popLayout">
        {hovered === null ? (
          <div className="flex flex-col gap-2 h-full w-full">
            <motion.div
              layoutId="math-container"
              className="h-full"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                className={cn("w-full h-full text-white font-bold", MATH_COLOR)}
                onMouseEnter={() => setHovered('math')}
              >
                Math
              </Button>
            </motion.div>
            <motion.div
              layoutId="rw-container"
              className="h-full"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                className={cn("w-full h-full text-white font-bold", RW_COLOR)}
                onMouseEnter={() => setHovered('rw')}
              >
                R&W
              </Button>
            </motion.div>
          </div>
        ) : hovered === 'math' ? (
          <motion.div
            key="math-expanded"
            layoutId="math-container"
            className="flex flex-col gap-2 h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <Button
                className={cn("w-full h-full text-white font-bold", MATH_COLOR)}
                onClick={() => onStartSession(10, 'Math')}
              >
                10 min
              </Button>
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <Button
                className={cn("w-full h-full text-white font-bold", MATH_COLOR)}
                onClick={() => onStartSession(20, 'Math')}
              >
                20 min
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="rw-expanded"
            layoutId="rw-container"
            className="flex flex-col gap-2 h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <Button
                className={cn("w-full h-full text-white font-bold", RW_COLOR)}
                onClick={() => onStartSession(10, 'Reading & Writing')}
              >
                10 min
              </Button>
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <Button
                className={cn("w-full h-full text-white font-bold", RW_COLOR)}
                onClick={() => onStartSession(20, 'Reading & Writing')}
              >
                20 min
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PracticeWidgetDefault = ({ onStartSession, hasWidth2 }: { onStartSession: PracticeWidgetProps['onStartSession']; hasWidth2: boolean }) => {
  return (
    <div className={cn("grid grid-cols-2 gap-2 h-full", hasWidth2 && "px-5 pb-4")}>
       <div className={cn("flex flex-col gap-2 h-full", hasWidth2 && "justify-between")}>
         <Button className={cn("text-white h-auto", hasWidth2 ? "text-sm py-2" : "flex-1", MATH_COLOR)} onClick={() => onStartSession(10, 'Math')}>10m Math</Button>
         <Button className={cn("text-white h-auto", hasWidth2 ? "text-sm py-2" : "flex-1", MATH_COLOR)} onClick={() => onStartSession(20, 'Math')}>20m Math</Button>
       </div>
       <div className={cn("flex flex-col gap-2 h-full", hasWidth2 && "justify-between")}>
         <Button className={cn("text-white h-auto", hasWidth2 ? "text-sm py-2" : "flex-1", RW_COLOR)} onClick={() => onStartSession(10, 'Reading & Writing')}>10m R&W</Button>
         <Button className={cn("text-white h-auto", hasWidth2 ? "text-sm py-2" : "flex-1", RW_COLOR)} onClick={() => onStartSession(20, 'Reading & Writing')}>20m R&W</Button>
       </div>
    </div>
  );
};
