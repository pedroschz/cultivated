import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Circle } from "lucide-react";

interface ProgressIndicatorProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  showFraction?: boolean;
  variant?: "default" | "success" | "warning" | "destructive";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProgressIndicator({
  current,
  total,
  label,
  showPercentage = true,
  showFraction = true,
  variant = "default",
  size = "md",
  className
}: ProgressIndicatorProps) {
  const percentage = Math.round((current / total) * 100);
  
  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4"
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  return (
    <div className={cn("space-y-2", className)}>
      {(label || showFraction || showPercentage) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className={cn("font-medium", textSizeClasses[size])}>
              {label}
            </span>
          )}
          <div className="flex items-center space-x-2">
            {showFraction && (
              <Badge variant="outline" className={textSizeClasses[size]}>
                {current}/{total}
              </Badge>
            )}
            {showPercentage && (
              <span className={cn("font-medium", textSizeClasses[size])}>
                {percentage}%
              </span>
            )}
          </div>
        </div>
      )}
      <Progress 
        value={percentage} 
        className={cn(sizeClasses[size])}
        data-variant={variant}
      />
    </div>
  );
}

// Step-based progress indicator for multi-step processes
interface StepProgressProps {
  steps: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  currentStep: number;
  completedSteps?: number[];
  variant?: "horizontal" | "vertical";
  className?: string;
}

export function StepProgress({
  steps,
  currentStep,
  completedSteps = [],
  variant = "horizontal",
  className
}: StepProgressProps) {
  const getStepStatus = (index: number) => {
    if (completedSteps.includes(index)) return "completed";
    if (index === currentStep) return "current";
    return "pending";
  };

  const getStepIcon = (index: number, status: string) => {
    switch (status) {
      case "completed":
        return <Check className="h-4 w-4" />;
      case "current":
        return <Circle className="h-4 w-4 fill-current" />;
      default:
        return <span className="text-xs font-medium">{index + 1}</span>;
    }
  };

  const getStepClasses = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-primary text-primary-foreground border-primary";
      case "current":
        return "bg-primary text-primary-foreground border-primary animate-pulse";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  if (variant === "vertical") {
    return (
      <div className={cn("space-y-4", className)}>
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          return (
            <div key={step.id} className="flex items-start space-x-3">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                getStepClasses(status)
              )}>
                {getStepIcon(index, status)}
              </div>
              <div className="flex-1 space-y-1">
                <h4 className={cn(
                  "text-sm font-medium",
                  status === "current" ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.label}
                </h4>
                {step.description && (
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between", className)}>
      {steps.map((step, index) => {
        const status = getStepStatus(index);
        const isLast = index === steps.length - 1;
        
        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                getStepClasses(status)
              )}>
                {getStepIcon(index, status)}
              </div>
              <div className="mt-2 text-center">
                <p className={cn(
                  "text-xs font-medium",
                  status === "current" ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.label}
                </p>
              </div>
            </div>
            {!isLast && (
              <div className="flex-1 mx-4">
                <div className={cn(
                  "h-0.5 transition-colors",
                  completedSteps.includes(index) ? "bg-primary" : "bg-border"
                )} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Circular progress indicator
interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  className?: string;
}

export function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  children,
  className
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
} 