"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function SchoolsHero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
      {/* Dynamic Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 right-[-10%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-secondary/10 rounded-full blur-3xl" 
        />
      </div>

      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left space-y-8 max-w-2xl mx-auto lg:mx-0 z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/10 backdrop-blur-sm text-primary font-semibold text-sm shadow-sm"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Beta program now available!
              </motion.div>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-black leading-[1.1] tracking-tight text-slate-900 dark:text-white">
                Supercharge your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                  SAT Prep Program
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mx-auto lg:mx-0">
                Equip your students with AI-driven practice and give your teachers the real-time data they need to drive measurable results.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
            >
              <Button 
                asChild 
                size="lg" 
                className="h-14 px-8 text-lg font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto rounded-xl"
              >
                <a 
                  href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@example.com'}?subject=${encodeURIComponent('School Beta Program Inquiry')}&body=${encodeURIComponent(`Hello,

I'm interested in learning more about the Cultivated beta program for schools.

Name: [Your Name]
Position: [Your Position at School]
School: [School Name]
School Type: [District/Charter/Private]
Number of Students: [Approximate Number]
Best Contact Method: [Email/Phone]

Please let me know next steps.

Thank you!`)}`}
                >
                  Get Access
                </a>
              </Button>
              <Button 
                asChild 
                variant="outline" 
                size="lg" 
                className="h-14 px-8 text-lg font-bold uppercase tracking-wider bg-white/50 backdrop-blur-sm border-slate-200 hover:border-primary/20 hover:bg-primary/5 hover:text-primary transition-all duration-300 w-full sm:w-auto rounded-xl"
              >
                <Link href="#features">
                  See Features
                </Link>
              </Button>
            </motion.div>

            <div className="pt-8 flex items-center justify-center lg:justify-start gap-8 text-slate-400 grayscale opacity-70">
              {/* Trust badges placeholders - could be replaced with real logos */}
              {['District', 'Charter', 'Private'].map((type, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary/50" />
                  <span className="font-semibold text-sm uppercase tracking-wider">{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Visual - Dashboard Preview */}
          <motion.div 
            initial={{ opacity: 0, x: 50, rotateY: -10 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ delay: 0.4, duration: 0.8, type: "spring" }}
            className="flex-1 w-full max-w-[650px] lg:max-w-none relative perspective-1000"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl aspect-[16/10] group">
               {/* Reflection/Glass effect */}
               <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none z-20" />
               
               <div className="absolute inset-0 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col">
                  {/* Fake UI Header */}
                  <div className="h-16 border-b border-slate-100 dark:border-slate-800 flex items-center px-6 justify-between bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">
                        C
                      </div>
                      <div className="font-bold text-slate-700 dark:text-slate-200 text-lg">School Admin</div>
                    </div>
                    <div className="flex gap-6 text-sm font-medium text-slate-500">
                      <span className="text-primary bg-primary/10 px-3 py-1 rounded-full">Dashboard</span>
                      <span className="hover:text-primary cursor-pointer transition-colors">Students</span>
                      <span className="hover:text-primary cursor-pointer transition-colors">Reports</span>
                    </div>
                  </div>
                  
                  {/* Fake UI Content */}
                  <div className="flex-1 p-8 overflow-hidden">
                    <div className="space-y-6">
                      <div className="flex flex-wrap justify-between items-end gap-4">
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                          <div className="h-8 w-64 bg-slate-900 dark:bg-slate-100 rounded" />
                        </div>
                        <div className="h-10 w-32 bg-primary/10 dark:bg-primary/20 text-primary rounded-lg flex items-center justify-center font-bold text-sm">
                           Export Data
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                         {['Student', 'Class', 'Time', 'Mastery'].map((h, i) => (
                           <div key={i}>{h}</div>
                         ))}
                      </div>
                      
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.8 + (i * 0.1) }}
                            className="grid grid-cols-4 gap-4 items-center p-3 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                          >
                             <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white
                                  ${i % 3 === 0 ? 'bg-secondary' : i % 3 === 1 ? 'bg-primary' : 'bg-orange-400'}`}
                                >
                                  {String.fromCharCode(65 + i)}
                                </div>
                                <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                             </div>
                             <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
                             <div className="h-3 w-12 bg-slate-100 dark:bg-slate-800 rounded" />
                             <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${65 + (i * 8)}%` }}
                                  transition={{ delay: 1 + (i * 0.1), duration: 1, type: "spring" }}
                                  className={`h-full rounded-full ${
                                    i === 0 ? 'bg-primary' : 
                                    i === 1 ? 'bg-secondary' : 
                                    i === 2 ? 'bg-orange-400' : 
                                    'bg-blue-400'
                                  }`} 
                                />
                             </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
               </div>
            </div>
            
            {/* Floating Elements */}
            <motion.div 
              animate={{ y: [-10, 10, -10] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-8 top-20 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-30 hidden md:block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">New Submission</div>
                  <div className="text-xs text-slate-500">Just now</div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [10, -10, 10] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -left-8 bottom-20 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-30 hidden md:block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">Usage Spiking</div>
                  <div className="text-xs text-slate-500">+24% this week</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
