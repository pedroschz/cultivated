"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import CountUp from "react-countup";
import { cn } from "@/lib/utils";

const stats = [
  {
    value: 160,
    suffix: "+",
    label: "Average Point Increase",
    description: "Students see massive gains in just 2 weeks",
  },
  {
    value: 21.4,
    suffix: "k+",
    label: "Questions Answered",
    description: "From algebra to reading comprehension",
    decimals: 1,
  },
  {
    value: 340,
    suffix: "+",
    label: "Active Students",
    description: "Join a community of ambitious learners",
  },
  {
    value: 100,
    suffix: "%",
    label: "Free for students",
    description: "Our beta is free for enrolled students",
  },
];

export function LandingStats() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-20 bg-background border-y border-border">
      <div className="container mx-auto px-4 md:px-6">
        <div 
          ref={ref}
          className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12"
        >
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className={cn(
                "flex flex-col items-center text-center space-y-2 p-4 rounded-2xl transition-all duration-700",
                isInView 
                  ? "opacity-100 translate-y-0" 
                  : "opacity-0 translate-y-8"
              )}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="text-4xl md:text-5xl lg:text-6xl font-black text-primary font-display tracking-tight flex items-baseline">
                {isInView ? (
                  <CountUp
                    start={0}
                    end={stat.value}
                    duration={2.5}
                    decimals={stat.decimals || 0}
                    separator=","
                  />
                ) : (
                  <span>0</span>
                )}
                <span className="ml-1 text-3xl md:text-4xl text-primary/80">{stat.suffix}</span>
              </div>
              <h3 className="text-lg font-bold text-foreground">{stat.label}</h3>
              <p className="text-sm text-muted-foreground max-w-[160px] leading-relaxed">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
