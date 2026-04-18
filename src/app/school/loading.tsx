import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";

export default function Loading() {
  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar />
      <div className="ml-0 md:ml-64 transition-all duration-300 ease-in-out">
        <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
          <PageHeader title="My School" />
          
          <div className="mt-4 animate-pulse">
             <div className="h-24 w-48 bg-muted/20 rounded-lg mb-6"></div>
          </div>

          <div className="mt-6">
            <div className="border-2 border-border bg-card rounded-xl p-6 shadow-sm">
              <div className="h-7 w-40 bg-muted/40 rounded mb-6 animate-pulse"></div>
              <div className="space-y-4 animate-pulse">
                <div className="border rounded-lg p-4 h-20 bg-muted/10"></div>
                <div className="border rounded-lg p-4 h-20 bg-muted/10"></div>
                <div className="border rounded-lg p-4 h-20 bg-muted/10"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
