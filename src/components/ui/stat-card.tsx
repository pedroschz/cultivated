import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
  };
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  className?: string;
  children?: ReactNode;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  badge,
  className,
  children
}: StatCardProps) {
  const getTrendIcon = (trendValue: number) => {
    if (trendValue > 0) return TrendingUp;
    if (trendValue < 0) return TrendingDown;
    return Minus;
  };

  const getTrendColor = (trendValue: number) => {
    if (trendValue > 0) return "text-green-600";
    if (trendValue < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  return (
    <Card className={cn("transition-all hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center space-x-2">
          {badge && (
            <Badge variant={badge.variant || "default"}>
              {badge.text}
            </Badge>
          )}
          {Icon && (
            <Icon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          
          {trend && (
            <div className={cn("flex items-center space-x-1 text-xs", getTrendColor(trend.value))}>
              {React.createElement(getTrendIcon(trend.value), { className: "h-3 w-3" })}
              <span className="font-medium">
                {trend.value > 0 ? "+" : ""}{trend.value}%
              </span>
              {trend.label && (
                <span className="text-muted-foreground">
                  {trend.label}
                </span>
              )}
            </div>
          )}
        </div>
        
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Specialized stat cards for common use cases
export function ScoreCard({ score, total, label = "Score" }: { 
  score: number; 
  total: number; 
  label?: string; 
}) {
  const percentage = Math.round((score / total) * 100);
  const getScoreColor = (pct: number) => {
    if (pct >= 80) return "text-green-600";
    if (pct >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <StatCard
      title={label}
      value={`${score}/${total}`}
      description={`${percentage}% accuracy`}
      className={getScoreColor(percentage)}
    />
  );
}

export function TimeCard({ 
  minutes, 
  label = "Time Spent",
  showHours = false 
}: { 
  minutes: number; 
  label?: string;
  showHours?: boolean;
}) {
  const formatTime = (mins: number) => {
    if (showHours && mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m`;
  };

  return (
    <StatCard
      title={label}
      value={formatTime(minutes)}
      description={`${minutes} minutes total`}
    />
  );
} 