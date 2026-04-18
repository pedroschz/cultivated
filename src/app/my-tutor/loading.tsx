import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";

export default function Loading() {
  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar />
      <div className="ml-0 md:ml-64 transition-all duration-300 ease-in-out">
        <div className="py-6 px-4 md:py-8 md:pr-8 md:pl-14 xl:pl-16">
          <PageHeader title="My Tutor" />
          <div className="mt-10 animate-pulse">
            {/* Tutor visualization skeleton */}
            <div className="w-full aspect-video max-h-[400px] bg-card border-2 border-border border-b-4 rounded-3xl mb-8 flex items-center justify-center">
               <div className="h-32 w-32 rounded-full bg-muted/30"></div>
            </div>
            
            {/* Chat skeleton */}
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="flex gap-4">
                 <div className="h-10 w-10 rounded-full bg-muted/40 shrink-0"></div>
                 <div className="h-20 flex-1 bg-muted/30 rounded-2xl rounded-tl-none"></div>
              </div>
              <div className="flex gap-4 flex-row-reverse">
                 <div className="h-10 w-10 rounded-full bg-muted/40 shrink-0"></div>
                 <div className="h-12 w-2/3 bg-muted/30 rounded-2xl rounded-tr-none"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
