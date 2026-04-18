"use client";

import { cn } from "@/lib/utils";

interface CustomAvatarProps {
  icon?: string; // emoji
  color?: string; // hex color
  fallbackText?: string; // fallback initials
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base", 
  lg: "h-12 w-12 text-lg",
  xl: "h-16 w-16 text-xl"
};

// Function to make color stronger for border
const strengthenColor = (hexColor: string, amount: 0.2): string => {
  if (!hexColor || !hexColor.startsWith('#')) return '#e5e7eb';
  
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Darken by reducing RGB values
  const newR = Math.max(0, Math.floor(r * (1 - amount)));
  const newG = Math.max(0, Math.floor(g * (1 - amount)));
  const newB = Math.max(0, Math.floor(b * (1 - amount)));
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

export function CustomAvatar({ 
  icon, 
  color, 
  fallbackText = "U", 
  size = "md", 
  className 
}: CustomAvatarProps) {
  const borderColor = strengthenColor(color || '#e5e7eb', 0.2);
  
  return (
    <div 
      className={cn(
        "rounded-full flex items-center justify-center font-medium border-2 transition-colors",
        sizeClasses[size],
        className
      )}
      style={{ 
        backgroundColor: color || '#f3f4f6',
        borderColor: borderColor
      }}
    >
      {icon ? (
        <span className="text-center">{icon}</span>
      ) : (
        <span className="text-gray-700 font-semibold">
          {fallbackText.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
} 