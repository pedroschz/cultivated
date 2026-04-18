import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SelectionCardProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  selected?: boolean;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export function SelectionCard({
  selected,
  icon,
  title,
  description,
  className,
  ...props
}: SelectionCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type="button"
      className={cn(
        "relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 w-full text-center h-full min-h-[140px]",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-muted-foreground/10 bg-card hover:border-primary/50 hover:bg-accent/50",
        className
      )}
      {...(props as any)}
    >
      {selected && (
        <div className="absolute top-3 right-3 text-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path
              fillRule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
      
      {icon && (
        <div className={cn("mb-4 p-3 rounded-full bg-background shadow-sm", selected ? "text-primary" : "text-muted-foreground")}>
          {icon}
        </div>
      )}
      
      <h3 className={cn("text-lg font-semibold mb-1", selected ? "text-primary" : "text-foreground")}>
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </motion.button>
  );
}
