"use client";

export function LandingTrustedBy() {
  // Using simple text placeholders for now since we don't have SVGs for all colleges.
  // In a real production app, replace these with SVGs.
  const colleges = [
    "Harvard", "Stanford", "MIT", "Yale", "Princeton", "Columbia", "UPenn", "Duke"
  ];

  return (
    <section className="py-10 border-b border-border bg-muted/20">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-6">
          Our students get into top universities
        </p>
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
           {colleges.map((college) => (
             <span key={college} className="text-xl md:text-2xl font-black text-foreground font-serif">
               {college}
             </span>
           ))}
        </div>
      </div>
    </section>
  );
}
