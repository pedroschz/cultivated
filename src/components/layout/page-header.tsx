import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * @file This component provides a consistent page header layout with title,
 * optional description, and action buttons. It supports custom styling through className prop.
 */

/**
 * Props for the PageHeader component.
 */
interface PageHeaderProps {
  /** The main title of the page. */
  title: string;
  /** Optional description text below the title. */
  description?: string;
  /** Optional action buttons or other content to display on the right side. */
  children?: ReactNode;
  /** Additional CSS classes to apply to the header container. */
  className?: string;
}

/**
 * A reusable page header component that provides consistent styling
 * for page titles, descriptions, and action buttons.
 * 
 * @param title - The main title of the page.
 * @param description - Optional description text below the title.
 * @param children - Optional action buttons or other content for the right side.
 * @param className - Additional CSS classes for the header container.
 * @returns A React component with the page header layout.
 */
export function PageHeader({ 
  title, 
  description, 
  children, 
  className 
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header content with title, description, and optional actions */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        {/* Left side: Title and description */}
        <div className="space-y-1 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
        
        {/* Right side: Optional action buttons or content */}
        {children && (
          <div className="flex items-center space-x-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
} 