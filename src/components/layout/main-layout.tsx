"use client";

import { ReactNode } from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
// MobileNav is wired globally in RootLayout now

/**
 * @file This component provides the main layout wrapper for application pages.
 * It includes optional breadcrumb navigation, configurable max-width constraints,
 * and responsive container styling for consistent page layouts.
 */

/**
 * Props for the MainLayout component.
 */
interface MainLayoutProps {
  /** The content to be rendered within the layout. */
  children: ReactNode;
  /** Optional array of breadcrumb items for navigation. */
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
  /** Additional CSS classes to apply to the main container. */
  className?: string;
  /** Maximum width constraint for the layout content. */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /** Hide the breadcrumbs on mobile viewports */
  hideBreadcrumbOnMobile?: boolean;
}

/**
 * Mapping of maxWidth prop values to Tailwind CSS classes.
 */
const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md", 
  lg: "max-w-4xl",
  xl: "max-w-6xl",
  "2xl": "max-w-7xl",
  full: "max-w-none"
};

/**
 * A layout component that provides consistent page structure with optional
 * breadcrumb navigation and configurable width constraints.
 * 
 * @param children - The content to be rendered within the layout.
 * @param breadcrumbs - Optional array of breadcrumb items for navigation.
 * @param className - Additional CSS classes for the main container.
 * @param maxWidth - Maximum width constraint for the layout content.
 * @returns A React component with the main layout structure.
 */
export function MainLayout({ 
  children, 
  breadcrumbs,
  className,
  maxWidth = "2xl",
  hideBreadcrumbOnMobile = false
}: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      
      {/* Main content container with responsive padding and max-width */}
      <main className={cn("container mx-auto px-4 py-6", maxWidthClasses[maxWidth], className)}>
        {/* Optional breadcrumb navigation */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className={cn("mb-6", hideBreadcrumbOnMobile && "hidden md:block")}>
            <Breadcrumb>
              <BreadcrumbList>
                {/* Always show Home as the first breadcrumb */}
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                
                {/* Render each breadcrumb item with separators */}
                {breadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {/* Make all breadcrumbs except the last one clickable */}
                      {crumb.href && index < breadcrumbs.length - 1 ? (
                        <BreadcrumbLink href={crumb.href}>
                          {crumb.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        )}
        
        {/* Render the main content */}
        {children}
      </main>
      {/* MobileNav rendered in RootLayout */}
    </div>
  );
} 