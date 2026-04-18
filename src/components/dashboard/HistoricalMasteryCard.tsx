"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
// Removed: import React, { useEffect, useState } from "react";

/**
 * @file This component displays a line chart showing the user's mastery progress
 * over time across different subjects (Overall, Math, Reading & Writing). It uses
 * Recharts for visualization and provides an interactive chart with tooltips and legends.
 */

/**
 * Represents a single data point in the historical mastery chart.
 */
interface HistoricalData {
  date: string;
  overall: number | null;
  math: number | null;
  readingWriting: number | null;
}

/**
 * Props for the HistoricalMasteryCard component.
 */
interface HistoricalMasteryCardProps {
  /** Array of historical mastery data points. */
  data: HistoricalData[];
  /** Render without outer card chrome for embedding in custom layouts. */
  embedded?: boolean;
  /** Optional class name for custom sizing. */
  className?: string;
}

/**
 * A component that displays a line chart of the user's mastery progress over time.
 * Shows trends for overall mastery, math, and reading & writing scores with
 * interactive tooltips and a legend.
 * 
 * @param data - Array of historical mastery data points.
 * @returns A React component with the historical mastery chart.
 */
export function HistoricalMasteryCard({ data, embedded = false, className }: HistoricalMasteryCardProps) {
  // Removed: const [shouldRenderChart, setShouldRenderChart] = useState(false);

  // Removed: useEffect(() => {
  // Removed:   const timer = setTimeout(() => {
  // Removed:     setShouldRenderChart(true);
  // Removed:   }, 100); // Delay rendering by 100ms
  // Removed:   return () => clearTimeout(timer);
  // Removed: }, []);

  // Don't render if no data is provided
  if (data.length === 0) return null;

  // Configuration for the chart lines, colors, and labels
  const chartConfig: ChartConfig = {
    overall: {
      label: "Overall",
      color: "hsl(220, 15%, 50%)",
    },
    math: {
      label: "Math",
      color: "hsl(0, 80%, 60%)",
    },
    readingWriting: {
      label: "Reading & Writing",
      color: "hsl(210, 80%, 55%)",
    },
  };

  // Check if there's any valid data to display
  const hasAny = data.some((d) => d.overall !== null || d.math !== null || d.readingWriting !== null);
  if (!hasAny) return null;

  const chart = (
    <ChartContainer config={chartConfig} className={cn("w-full max-w-full h-full flex-1", embedded && "min-h-[200px]")}>
      <LineChart data={data}>
        {/* Grid lines for better readability */}
        <CartesianGrid
          strokeDasharray="2 4"
          stroke="hsl(var(--border))"
          strokeOpacity={0.6}
          vertical={false}
        />
        
        {/* X-axis for dates */}
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickMargin={12}
          className="text-xs"
        />
        
        {/* Y-axis for mastery percentages (0-100) */}
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 14, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickMargin={12}
          width={28}
          label={{
            value: "",
            angle: -90,
            position: "insideLeft",
            style: {
              textAnchor: "middle",
              fontSize: "15px",
              fill: "hsl(var(--muted-foreground))",
              fontWeight: "500",
            },
          }}
        />
        
        {/* Interactive tooltip */}
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => value}
              formatter={(value, name) => [
                `${value}%`,
                chartConfig[name as keyof typeof chartConfig]?.label || name,
              ]}
              className="rounded-xl border-2 border-border bg-card shadow-none"
            />
          }
        />
        
        {/* Chart legend */}
        <ChartLegend content={<ChartLegendContent className="justify-center pt-4 md:pt-6 gap-4 md:gap-6" />} />
        
        {/* Overall mastery line */}
        <Line
          type="monotone"
          dataKey="overall"
          stroke="hsl(220, 15%, 50%)"
          strokeWidth={4}
          dot={false}
          connectNulls={true}
          activeDot={false}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Math mastery line */}
        <Line
          type="monotone"
          dataKey="math"
          stroke="hsl(0, 80%, 60%)"
          strokeWidth={4}
          dot={false}
          connectNulls={true}
          activeDot={false}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Reading & Writing mastery line */}
        <Line
          type="monotone"
          dataKey="readingWriting"
          stroke="hsl(210, 80%, 55%)"
          strokeWidth={4}
          dot={false}
          connectNulls={true}
          activeDot={false}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </LineChart>
    </ChartContainer>
  );

  if (embedded) {
    return (
      <div className={cn("h-full w-full flex flex-col", className)}>
        {chart}
      </div>
    );
  }

  return (
    <Card className={cn("rounded-2xl md:rounded-3xl border-2 border-border border-b-4 bg-card shadow-none animate-fade-in overflow-hidden h-[360px] sm:h-[420px] md:h-[500px]", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <TrendingUp className="h-5 w-5" /> Mastery Progress (Last 7 Days)
        </CardTitle>
        <CardDescription className="text-muted-foreground">Track your mastery improvement across subjects</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 overflow-x-hidden flex flex-col flex-1">
        {chart}
      </CardContent>
    </Card>
  );
} 
