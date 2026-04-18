import { Sidebar } from "@/components/layout/sidebar";

export default function Loading() {
  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar />
      
      <div className="ml-0 md:ml-64 transition-all duration-300 ease-in-out">
        <div className="px-4 md:pl-10 md:pr-6 pt-5 pb-6">
          {/* Hero Section Skeleton */}
          <div className="rounded-3xl bg-card border-2 border-border border-b-4 p-6 mb-8 h-[300px] animate-pulse">
            <div className="h-8 w-48 bg-muted/50 rounded mb-4"></div>
            <div className="h-4 w-64 bg-muted/30 rounded mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="h-32 bg-muted/20 rounded-xl"></div>
               <div className="h-32 bg-muted/20 rounded-xl"></div>
               <div className="h-32 bg-muted/20 rounded-xl"></div>
            </div>
          </div>

          {/* Widgets Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            <div className="h-64 bg-card border-2 border-border border-b-4 rounded-2xl"></div>
            <div className="h-64 bg-card border-2 border-border border-b-4 rounded-2xl"></div>
            <div className="h-64 bg-card border-2 border-border border-b-4 rounded-2xl"></div>
            <div className="h-64 bg-card border-2 border-border border-b-4 rounded-2xl"></div>
            <div className="h-64 bg-card border-2 border-border border-b-4 rounded-2xl"></div>
            <div className="h-64 bg-card border-2 border-border border-b-4 rounded-2xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
