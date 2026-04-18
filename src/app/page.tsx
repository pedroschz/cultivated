"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFeature } from "@/components/landing/LandingFeature";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingStats } from "@/components/landing/LandingStats";
import { LandingCulturalCuration } from "@/components/landing/LandingCulturalCuration";
// import { LandingTestimonials } from "@/components/landing/LandingTestimonials";
import { LandingFAQ } from "@/components/landing/LandingFAQ";
import { LandingSchoolsCTA } from "@/components/landing/LandingSchoolsCTA";
import { LandingTrustedBy } from "@/components/landing/LandingTrustedBy";
import { AITutorDemo } from "@/components/landing/AITutorDemo";
import { ScoreGrowthDemo } from "@/components/landing/ScoreGrowthDemo";
import { Button } from "@/components/ui/button";
import { Bot, LineChart, Target, Zap } from "lucide-react";
import Link from "next/link";

import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { useState, useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // Prefetch login and signup pages (common destinations from landing)
  useEffect(() => {
    router.prefetch('/login');
    router.prefetch('/signup');
  }, [router]);

  // Check auth state
  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setIsLoggedIn(!!user);
      });
      return () => unsubscribe();
    }
  }, []);
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      <LandingNavbar />
      
      <main className="flex-1">
        <LandingHero />
        <LandingTrustedBy />
        <LandingStats />
        <LandingCulturalCuration />
        
        {/* Features Section */}
        <section id="features" className="relative">
          <div className="absolute inset-0 bg-muted/20 -skew-y-2 transform origin-top-left -z-10 h-full scale-110" />
          
          <LandingFeature
            title="Stuck? Just ask."
            description="Our AI Tutor isn't just a chatbot. It can speak, listen, and guide you through problems step-by-step—just like a real teacher, but available 24/7."
            badge="AI Tutor"
            icon={Bot}
            orientation="left"
            imageComponent={<AITutorDemo />}
          />

          <LandingFeature
            title="Practice that adapts to you."
            description="Stop wasting time on questions that are too easy or impossible. Our adaptive algorithm finds your sweet spot to maximize learning efficiency."
            badge="Smart Learning"
            icon={Target}
            orientation="right"
            imageComponent={
               <div className="relative w-full h-full bg-white dark:bg-gray-900 p-6 flex flex-col items-center justify-center">
                  <div className="w-full max-w-sm border-2 border-border rounded-xl p-4 shadow-lg bg-card relative z-10 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                     <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Math • Hard</span>
                        <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">High Difficulty</span>
                     </div>
                     <div className="space-y-3">
                        <div className="h-4 bg-muted/50 rounded w-full" />
                        <div className="h-4 bg-muted/50 rounded w-5/6" />
                        <div className="h-32 bg-muted/30 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                           <span className="text-muted-foreground text-sm">Graph Visualization</span>
                        </div>
                     </div>
                     <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="h-10 border-2 border-border rounded-lg" />
                        <div className="h-10 border-2 border-border rounded-lg" />
                     </div>
                  </div>
                  
                  {/* Background stacked cards */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm h-64 bg-primary/20 rounded-xl transform -rotate-3 scale-95 -z-10" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm h-64 bg-secondary/20 rounded-xl transform rotate-6 scale-90 -z-20" />
               </div>
            }
          />
          
          <LandingFeature
            title="Watch your score grow."
            description="Visual analytics track your mastery across every SAT domain. See exactly where you're improving and where you need focus."
            badge="Analytics"
            icon={LineChart}
            orientation="left"
            imageComponent={<ScoreGrowthDemo />}
          />
        </section>

        <LandingSchoolsCTA />

        {/* <LandingTestimonials /> */}

        <LandingFAQ />

        {/* Call to Action */}
        <section className="py-24 bg-background text-center relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
             {/* Decorative gradient */}
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] aspect-square bg-gradient-to-b from-primary/5 to-transparent rounded-[100%] blur-3xl opacity-60" />
          </div>
          
          <div className="container mx-auto px-4 relative z-10">
            <h2 className="text-3xl md:text-5xl font-display font-black mb-6 tracking-tight text-foreground">
              Ready to crush the SAT?
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto font-medium">
              Join dozens of students boosting their scores for free.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <Button 
                 asChild 
                 size="lg" 
                 className="h-14 px-8 text-lg font-bold uppercase tracking-wider shadow-[0_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.2)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-[colors,opacity,box-shadow] active:transition-none w-full sm:w-auto"
               >
                 <a href={isLoggedIn ? "/dashboard" : "/signup"}>
                   {isLoggedIn ? "Go to Dashboard" : "Get started"}
                 </a>
               </Button>
            </div>
          </div>
        </section>
      </main>
      
      <LandingFooter />
    </div>
  );
}
