"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";

const typingWords = ["want to do.", "crush.", "actually enjoy."];

export function LandingHero() {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // Check auth state
  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setIsLoggedIn(!!user);
      });
      return () => unsubscribe();
    }
  }, []);

  // Typing effect logic
  useEffect(() => {
    const currentWord = typingWords[wordIndex];
    const typeSpeed = isDeleting ? 50 : 100;

    const timer = setTimeout(() => {
      if (!isDeleting && displayText === currentWord) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (isDeleting && displayText === "") {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % typingWords.length);
      } else {
        setDisplayText(
          currentWord.substring(0, displayText.length + (isDeleting ? -1 : 1))
        );
      }
    }, typeSpeed);

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, wordIndex]);

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] aspect-square bg-gradient-to-b from-blue-50/50 to-transparent rounded-[100%] blur-3xl opacity-60 dark:from-blue-950/30 dark:to-transparent" 
        />
      </div>

      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left space-y-8 max-w-2xl mx-auto lg:mx-0">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-black leading-[1.1] tracking-tight text-foreground min-h-[3.3em] md:min-h-[2.2em] lg:min-h-[2.2em]">
                The SAT prep you&apos;ll <br className="hidden md:block" />
                <span className="text-primary relative inline-block">
                  {displayText}
                  <span className="animate-blink">|</span>
                  <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary/20" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                  </svg>
                </span>
              </h1>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0"
              >
                Gamified practice, real-time analytics, and your own personal AI Tutor. Master the SAT without the boredom.
              </motion.p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
            >
              <Button 
                asChild 
                size="lg" 
                className="h-14 px-8 text-lg font-bold uppercase tracking-wider shadow-[0_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.2)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-[colors,opacity,box-shadow] active:transition-none w-full sm:w-auto"
              >
                <a href={isLoggedIn ? "/dashboard" : "/signup"}>
                  {isLoggedIn ? "Go to Dashboard" : "GET STARTED"}
                </a>
              </Button>
              <Button 
                asChild 
                variant="outline" 
                size="lg" 
                className="h-14 px-8 text-lg font-bold uppercase tracking-wider bg-transparent border-2 border-border shadow-[0_4px_0_0_var(--color-border)] hover:bg-accent/50 hover:shadow-[0_2px_0_0_var(--color-border)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-[colors,opacity,box-shadow] active:transition-none w-full sm:w-auto text-muted-foreground hover:text-foreground"
              >
                <Link href="/demo">
                  Try Demo
                </Link>
              </Button>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="pt-4 flex items-center justify-center lg:justify-start gap-8 text-sm font-medium text-muted-foreground/80"
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-background overflow-hidden relative">
                       <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400" />
                    </div>
                  ))}
                </div>
                <span>Join 340+ students</span>
              </div>
            </motion.div>
          </div>

          {/* Hero Visual */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, duration: 0.8, type: "spring" }}
            className="flex-1 w-full max-w-[600px] lg:max-w-none relative perspective-1000 group"
          >
            <div className="relative z-10 transform transition-transform duration-500 hover:rotate-y-2 hover:rotate-x-2">
              {/* Main Card - Dashboard Preview */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-background bg-card aspect-[4/3] animate-float-slow">
                 {/* Abstract representation of the UI if no image available, or use a screenshot */}
                 <div className="absolute inset-0 bg-gradient-to-br from-background to-muted flex flex-col">
                    {/* Header bar */}
                    <div className="h-12 border-b flex items-center px-4 gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    {/* Content area */}
                    <div className="flex-1 p-6 flex gap-4">
                       <div className="w-1/4 space-y-3 hidden sm:block">
                          <div className="h-8 w-full bg-muted-foreground/10 rounded-lg" />
                          <div className="h-8 w-full bg-muted-foreground/10 rounded-lg" />
                          <div className="h-8 w-full bg-muted-foreground/10 rounded-lg" />
                       </div>
                       <div className="flex-1 space-y-4">
                          <div className="h-32 w-full bg-primary/10 rounded-xl border-2 border-primary/20 flex items-center justify-center">
                             <div className="text-center">
                                <div className="text-2xl font-bold text-primary mb-1">Current Streak</div>
                                <div className="text-4xl font-black text-primary">12 Days</div>
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="h-24 w-full bg-blue-500/10 rounded-xl border-2 border-blue-500/20" />
                             <div className="h-24 w-full bg-orange-500/10 rounded-xl border-2 border-orange-500/20" />
                          </div>
                       </div>
                    </div>
                 </div>
                 
                 {/* Floating Overlay - AI Tutor */}
                 <div className="absolute -bottom-6 -right-6 w-48 bg-card rounded-2xl shadow-xl border-2 border-border p-4 animate-float-delayed hidden sm:block">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                         AI
                       </div>
                       <div className="font-bold text-sm">Tutor</div>
                    </div>
                    <div className="space-y-2">
                       <div className="h-2 w-full bg-muted rounded-full" />
                       <div className="h-2 w-2/3 bg-muted rounded-full" />
                    </div>
                 </div>
              </div>
            </div>
            
            {/* Background decorative blobs */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/20 filter blur-[80px] -z-10 rounded-full opacity-40 mix-blend-multiply dark:mix-blend-screen" />
          </motion.div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 0.7s infinite;
        }
      `}</style>
    </section>
  );
}
