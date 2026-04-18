"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface LandingFeatureProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  imageComponent?: React.ReactNode;
  orientation?: "left" | "right";
  badge?: string;
}

export function LandingFeature({
  title,
  description,
  icon: Icon,
  imageComponent,
  orientation = "left",
  badge,
}: LandingFeatureProps) {
  return (
    <div className="py-24 overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className={cn(
          "flex flex-col lg:flex-row items-center gap-12 lg:gap-20",
          orientation === "right" && "lg:flex-row-reverse"
        )}>
          {/* Visual Side */}
          <motion.div 
            initial={{ opacity: 0, x: orientation === "left" ? -50 : 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex-1 w-full max-w-[600px] lg:max-w-none"
          >
             <div className="relative rounded-3xl overflow-hidden bg-muted/30 border-2 border-border/50 aspect-video lg:aspect-square max-h-[500px] flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-500 group">
                {imageComponent ? (
                  imageComponent
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900" />
                )}
                
                {/* Decorative border effect */}
                <div className="absolute inset-0 border-4 border-transparent group-hover:border-primary/10 rounded-3xl transition-colors duration-500 pointer-events-none" />
             </div>
          </motion.div>

          {/* Text Side */}
          <motion.div 
            initial={{ opacity: 0, x: orientation === "left" ? 50 : -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="flex-1 space-y-6 text-center lg:text-left"
          >
            {badge && (
              <span className="inline-block px-3 py-1 rounded-lg bg-primary/10 text-primary font-bold text-sm uppercase tracking-wider">
                {badge}
              </span>
            )}
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground leading-tight">
              {title}
            </h2>
            
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
              {description}
            </p>

            {Icon && (
              <div className="pt-4 flex justify-center lg:justify-start">
                 <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-8 h-8" />
                 </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
