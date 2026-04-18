"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

interface DailyActivityChartProps {
  data: { date: string; minutes: number }[];
  className?: string;
}

export function DailyActivityChart({ data, className }: DailyActivityChartProps) {
  const chartConfig = {
    minutes: {
      label: "Minutes Studied",
      color: "hsl(var(--primary))",
    },
  };

  const formattedData = useMemo(() => {
    return data.map(d => ({
      ...d,
      dateFormatted: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  }, [data]);

  return (
    <Card className={cn("col-span-1 md:col-span-2 lg:col-span-3", className)}>
      <CardHeader>
        <CardTitle>Activity Overview</CardTitle>
        <CardDescription>Daily active study minutes for the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-minutes)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--color-minutes)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="dateFormatted" 
              tickLine={false} 
              axisLine={false} 
              tickMargin={10}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tick={{ fontSize: 12 }}
              width={30}
            />
            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.2} />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
            <Area 
              type="monotone" 
              dataKey="minutes" 
              stroke="var(--color-minutes)" 
              fillOpacity={1} 
              fill="url(#colorMinutes)" 
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
