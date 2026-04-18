"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Calendar, TrendingUp, Award, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Module 1: Consistency Map (Heatmap)
function HeatmapModule() {
  const rows = 7;
  const cols = 13;
  
  const getIntensity = (i: number, j: number) => {
    const seed = (i * cols + j) * 1337;
    const rand = (Math.sin(seed) + 1) / 2;
    const recentBias = (j / cols) * 0.5;
    const value = rand + recentBias;
    
    if (value < 0.6) return 0;
    if (value < 0.75) return 1;
    if (value < 0.85) return 2;
    if (value < 0.95) return 3;
    return 4;
  };

  return (
    <div className="w-full h-full flex flex-col p-6">
       <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <span className="font-bold text-foreground text-lg">Consistency Map</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span>Less</span>
            <div className="flex gap-1">
               <div className="w-2 h-2 rounded-sm bg-muted/50" />
               <div className="w-2 h-2 rounded-sm bg-primary/30" />
               <div className="w-2 h-2 rounded-sm bg-primary/60" />
               <div className="w-2 h-2 rounded-sm bg-primary" />
            </div>
            <span>More</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <div className="flex gap-1.5 justify-center">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div key={colIndex} className="flex flex-col gap-1.5">
                {Array.from({ length: rows }).map((_, rowIndex) => {
                  const intensity = getIntensity(rowIndex, colIndex);
                  let bgClass = "bg-muted/30";
                  if (intensity === 1) bgClass = "bg-primary/30";
                  if (intensity === 2) bgClass = "bg-primary/50";
                  if (intensity === 3) bgClass = "bg-primary/80";
                  if (intensity === 4) bgClass = "bg-primary";

                  return (
                    <motion.div
                      key={`${colIndex}-${rowIndex}`}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ 
                        delay: (colIndex * rows + rowIndex) * 0.005, 
                        duration: 0.3,
                        type: "spring"
                      }}
                      className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm sm:rounded-md ${bgClass}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-6">
            <div className="text-muted-foreground font-medium text-sm">
                You've studied on <span className="text-foreground font-bold">42 days</span> this year.
            </div>
        </div>
    </div>
  );
}

// Module 2: Score Progress (Line Chart)
function ScoreProgressModule() {
  const points = [1200, 1240, 1230, 1310, 1350, 1420, 1480];
  const maxScore = 1600;
  const minScore = 1000;
  
  const normalize = (score: number) => {
    return 100 - ((score - minScore) / (maxScore - minScore)) * 100;
  };

  const pathD = points.map((score, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = normalize(score);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(" ");

  return (
    <div className="w-full h-full flex flex-col p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <span className="font-bold text-foreground text-lg">Score Progression</span>
          </div>
          <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full text-xs font-bold">
            +280 Points
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center w-full px-2">
            <div className="w-full h-40 relative">
                {/* Grid Lines */}
                {[0, 25, 50, 75, 100].map((y) => (
                    <div key={y} className="absolute w-full h-px bg-border/50" style={{ top: `${y}%` }} />
                ))}
                
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        d={pathD}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-md"
                    />
                     {/* Area under curve */}
                    <motion.path
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 0.5 }}
                        d={`${pathD} L 100 100 L 0 100 Z`}
                        fill="url(#scoreGradient)"
                        stroke="none"
                    />
                </svg>

                {/* Points */}
                {points.map((score, i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 1 + (i * 0.1) }}
                        className="absolute w-3 h-3 bg-background border-2 border-primary rounded-full transform -translate-x-1/2 -translate-y-1/2"
                        style={{ 
                            left: `${(i / (points.length - 1)) * 100}%`, 
                            top: `${normalize(score)}%` 
                        }}
                    >
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {score}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>

        <div className="text-center mt-6">
             <div className="text-muted-foreground font-medium text-sm">
                Projected Score: <span className="text-foreground font-bold">1500+</span>
             </div>
        </div>
    </div>
  );
}

// Module 3: Subject Mastery (Bar Chart)
function MasteryModule() {
  const subjects = [
    { name: "Algebra", value: 92, color: "bg-blue-500" },
    { name: "Geometry", value: 78, color: "bg-indigo-500" },
    { name: "Reading", value: 85, color: "bg-purple-500" },
    { name: "Writing", value: 95, color: "bg-pink-500" },
  ];

  return (
    <div className="w-full h-full flex flex-col p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            <span className="font-bold text-foreground text-lg">Subject Mastery</span>
          </div>
          <Award className="w-5 h-5 text-yellow-500" />
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-5 px-2">
            {subjects.map((subject, i) => (
                <div key={subject.name} className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                        <span>{subject.name}</span>
                        <span>{subject.value}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${subject.value}%` }}
                            transition={{ duration: 1, delay: i * 0.1, type: "spring" }}
                            className={`h-full ${subject.color} rounded-full relative`}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                        </motion.div>
                    </div>
                </div>
            ))}
        </div>

        <div className="text-center mt-6">
             <div className="text-muted-foreground font-medium text-sm">
                Focus Recommendation: <span className="text-foreground font-bold">Geometry</span>
             </div>
        </div>
    </div>
  );
}

const modules = [
    { id: 'consistency', component: HeatmapModule, rotate: -2 },
    { id: 'progress', component: ScoreProgressModule, rotate: 2 },
    { id: 'mastery', component: MasteryModule, rotate: -1 },
];

export function ScoreGrowthDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % modules.length);
    }, 5000); // Switch every 5 seconds
    return () => clearInterval(timer);
  }, []);

  const variants = {
    enter: {
      x: 100,
      opacity: 0,
      scale: 0.8,
      rotate: 10,
      zIndex: 0
    },
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotate: 0, 
      zIndex: 10,
      transition: {
        duration: 0.6,
        type: "spring" as const,
        stiffness: 300,
        damping: 25
      }
    },
    exit: {
      x: -100,
      opacity: 0,
      scale: 0.8,
      rotate: -10,
      zIndex: 0,
      transition: {
        duration: 0.5,
      }
    }
  };

  return (
    <div className="relative w-full h-full bg-background flex flex-col items-center justify-center p-6 sm:p-10 font-sans overflow-hidden">
      
      {/* Container for the swiping cards */}
      <div className="w-full max-w-md h-[400px] relative flex items-center justify-center">
        <AnimatePresence mode="popLayout">
            {modules.map((module, index) => {
                // We only render the current one to allow for clean enter/exit animations
                if (index !== currentIndex) return null;
                
                return (
                    <motion.div
                        key={module.id}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="absolute inset-0 w-full h-full"
                    >
                        {/* The Card Widget */}
                        <div 
                            className="w-full h-full bg-card border border-border rounded-3xl shadow-xl overflow-hidden"
                            style={{ 
                                transform: `rotate(${module.rotate}deg)`,
                            }}
                        >
                            <module.component />
                        </div>
                    </motion.div>
                );
            })}
        </AnimatePresence>
      </div>

      {/* Decorative Highlight */}
      <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
         <div className="w-32 h-32 bg-primary/50 blur-[50px] rounded-full" />
      </div>

      {/* Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         <motion.div 
            animate={{ 
                y: [0, -10, 0],
                rotate: [0, 5, 0]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-10 left-10 w-24 h-24 bg-secondary/10 rounded-2xl -rotate-12 blur-xl" 
         />
         <motion.div 
            animate={{ 
                y: [0, 15, 0],
                rotate: [0, -5, 0]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-10 right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl" 
         />
      </div>
    </div>
  );
}
