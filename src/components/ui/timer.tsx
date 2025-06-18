"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CircularProgress } from "./progress-indicator";
import { Clock, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimerProps {
  initialTime: number; // in seconds
  onTimeUp?: () => void;
  onTick?: (timeRemaining: number) => void;
  autoStart?: boolean;
  showProgress?: boolean;
  variant?: "default" | "compact" | "circular";
  warningThreshold?: number; // seconds remaining to show warning
  className?: string;
}

export function Timer({
  initialTime,
  onTimeUp,
  onTick,
  autoStart = false,
  showProgress = false,
  variant = "default",
  warningThreshold = 60,
  className
}: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isComplete, setIsComplete] = useState(false);

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const getTimeDisplay = useCallback(() => {
    if (isComplete) return "Time's up!";
    return formatTime(timeRemaining);
  }, [timeRemaining, isComplete, formatTime]);

  const getProgressPercentage = useCallback(() => {
    return ((initialTime - timeRemaining) / initialTime) * 100;
  }, [timeRemaining, initialTime]);

  const isWarning = timeRemaining <= warningThreshold && timeRemaining > 0;
  const isCritical = timeRemaining <= 10 && timeRemaining > 0;

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          onTick?.(newTime);
          
          if (newTime <= 0) {
            setIsComplete(true);
            setIsRunning(false);
            onTimeUp?.();
            return 0;
          }
          
          return newTime;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeRemaining, onTick, onTimeUp]);

  const handlePlayPause = () => {
    if (isComplete) return;
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setTimeRemaining(initialTime);
    setIsRunning(false);
    setIsComplete(false);
  };

  const getTimerClasses = () => {
    if (isComplete) return "text-destructive";
    if (isCritical) return "text-destructive animate-pulse";
    if (isWarning) return "text-warning";
    return "text-foreground";
  };

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <Clock className="h-4 w-4 text-muted-foreground" />
        <Badge 
          variant={isComplete ? "destructive" : isWarning ? "secondary" : "outline"}
          className={cn("font-mono", getTimerClasses())}
        >
          {getTimeDisplay()}
        </Badge>
      </div>
    );
  }

  if (variant === "circular") {
    return (
      <div className={cn("flex flex-col items-center space-y-4", className)}>
        <CircularProgress
          value={getProgressPercentage()}
          size={120}
          className={getTimerClasses()}
        >
          <div className="text-center">
            <div className={cn("text-2xl font-mono font-bold", getTimerClasses())}>
              {getTimeDisplay()}
            </div>
            {!isComplete && (
              <div className="text-xs text-muted-foreground mt-1">
                remaining
              </div>
            )}
          </div>
        </CircularProgress>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayPause}
            disabled={isComplete}
          >
            {isRunning ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Time Remaining
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlayPause}
            disabled={isComplete}
          >
            {isRunning ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={cn("text-3xl font-mono font-bold", getTimerClasses())}>
        {getTimeDisplay()}
      </div>

      {showProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0:00</span>
            <span>{formatTime(initialTime)}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={cn(
                "h-2 rounded-full transition-all duration-1000 ease-linear",
                isComplete ? "bg-destructive" : 
                isCritical ? "bg-destructive" :
                isWarning ? "bg-warning" : "bg-primary"
              )}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Stopwatch component for tracking elapsed time
interface StopwatchProps {
  onTick?: (elapsedTime: number) => void;
  autoStart?: boolean;
  className?: string;
}

export function Stopwatch({ 
  onTick, 
  autoStart = false, 
  className 
}: StopwatchProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(autoStart);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime((prev) => {
          const newTime = prev + 1;
          onTick?.(newTime);
          return newTime;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, onTick]);

  const handlePlayPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setElapsedTime(0);
    setIsRunning(false);
  };

  return (
    <div className={cn("flex items-center space-x-4", className)}>
      <div className="text-2xl font-mono font-bold">
        {formatTime(elapsedTime)}
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePlayPause}
        >
          {isRunning ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 