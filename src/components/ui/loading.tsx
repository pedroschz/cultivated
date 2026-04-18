import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "spinner" | "dots" | "pulse";
  text?: string;
}

export function Loading({ 
  className, 
  size = "md", 
  variant = "spinner", 
  text 
}: LoadingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg"
  };

  if (variant === "spinner") {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className="flex items-center space-x-2">
          <Loader2 className={cn("animate-spin", sizeClasses[size])} />
          {text && (
            <span className={cn("text-muted-foreground", textSizeClasses[size])}>
              {text}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className={cn("rounded-full bg-primary animate-bounce", 
              size === "sm" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : "h-4 w-4"
            )} style={{ animationDelay: "0ms" }} />
            <div className={cn("rounded-full bg-primary animate-bounce", 
              size === "sm" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : "h-4 w-4"
            )} style={{ animationDelay: "150ms" }} />
            <div className={cn("rounded-full bg-primary animate-bounce", 
              size === "sm" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : "h-4 w-4"
            )} style={{ animationDelay: "300ms" }} />
          </div>
          {text && (
            <span className={cn("text-muted-foreground", textSizeClasses[size])}>
              {text}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className="flex items-center space-x-2">
          <div className={cn("rounded-full bg-primary animate-pulse", sizeClasses[size])} />
          {text && (
            <span className={cn("text-muted-foreground", textSizeClasses[size])}>
              {text}
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// Full page loading component
export function PageLoading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loading variant="spinner" size="lg" text={text} />
    </div>
  );
}

// Card loading skeleton
export function CardLoading({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="rounded-lg bg-muted h-32 w-full" />
      <div className="space-y-2 mt-4">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    </div>
  );
} 