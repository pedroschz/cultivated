"use client";

import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { SchoolsHero } from "@/components/landing/schools/SchoolsHero";
import { SchoolsFeatures } from "@/components/landing/schools/SchoolsFeatures";
import Link from "next/link";
import { motion } from "framer-motion";

export default function SchoolsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-indigo-500/20">
      <LandingNavbar />
      
      <main className="flex-1">
        <SchoolsHero />
        
        <SchoolsFeatures />

        {/* Schools CTA */}
        <section className="py-24 md:py-32 relative overflow-hidden bg-muted/30">
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-secondary/10 dark:bg-secondary/5">
             <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-primary/20 dark:from-secondary/10 dark:to-primary/10" />
             
             {/* Animated shapes */}
             <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 90, 0],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute top-[-50%] left-[-20%] w-[100%] h-[200%] bg-secondary/10 rounded-[40%] blur-3xl" 
             />
             <motion.div 
                animate={{ 
                  scale: [1, 1.3, 1],
                  rotate: [0, -60, 0],
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-[-50%] right-[-20%] w-[100%] h-[200%] bg-primary/10 rounded-[40%] blur-3xl" 
             />
          </div>
          
          <div className="container mx-auto px-4 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-4xl mx-auto text-center"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-black mb-8 tracking-tight text-foreground drop-shadow-sm">
                Ready to modernize your <br className="hidden md:block" /> SAT prep program?
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto font-medium leading-relaxed">
                Join the forward-thinking schools already using CultivatED to drive student success through data-driven insights.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                 <Link 
                   href="/signup?admin=inquiry" 
                   className="group relative inline-flex items-center justify-center h-16 px-10 rounded-2xl bg-primary text-white text-lg font-bold uppercase tracking-wider shadow-2xl shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                 >
                   <span className="relative z-10">Get Started</span>
                   <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
                 </Link>
                 
                 <Link 
                   href="/contact" 
                   className="inline-flex items-center justify-center h-16 px-10 rounded-2xl bg-transparent border-2 border-slate-300 dark:border-slate-700 text-foreground text-lg font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300"
                 >
                   Contact Sales
                 </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      
      <LandingFooter />
    </div>
  );
}
