"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { School, GraduationCap, BarChart3 } from "lucide-react";

export function LandingSchoolsCTA() {
  return (
    <section className="py-24 bg-muted/30 relative overflow-hidden border-t border-b border-border">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary/10 text-secondary font-bold text-sm uppercase tracking-wider mb-6">
                <School className="w-4 h-4" />
                For Schools
              </div>
              
              <h2 className="text-3xl md:text-5xl font-display font-black text-foreground mb-6 leading-tight">
                Empower your students with <span className="text-secondary">CultivatED</span>
              </h2>
              
              <p className="text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
                Get powerful insights into student performance. Track progress, manage classes, and help your students crush the SAT with our comprehensive admin dashboard.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  asChild 
                  size="lg" 
                  className="h-14 px-8 text-lg font-bold uppercase tracking-wider bg-secondary hover:bg-secondary/90 text-white shadow-[0_4px_0_0_#0ea5e9] hover:shadow-[0_2px_0_0_#0ea5e9] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-[colors,opacity,box-shadow] active:transition-none"
                >
                  <Link href="/schools">
                    Cultivated for Schools
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
          
          <div className="flex-1 w-full max-w-[600px] lg:max-w-none perspective-1000">
             <motion.div
                initial={{ opacity: 0, scale: 0.9, rotateY: 15 }}
                whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-border p-6 md:p-8 transform rotate-y-6 hover:rotate-y-0 transition-transform duration-700"
             >
                {/* Abstract Dashboard UI */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                           <School className="w-6 h-6 text-secondary" />
                        </div>
                        <div>
                           <div className="font-bold">Lincoln High School</div>
                           <div className="text-xs text-muted-foreground">Admin Dashboard</div>
                        </div>
                     </div>
                     <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted" />
                        <div className="h-8 w-8 rounded-full bg-muted" />
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                     <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Students</div>
                        <div className="text-2xl font-black">1,248</div>
                     </div>
                     <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Hours</div>
                        <div className="text-2xl font-black text-secondary">8,902</div>
                     </div>
                     <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Avg Score</div>
                        <div className="text-2xl font-black text-green-600">+120</div>
                     </div>
                  </div>
                  
                  <div className="space-y-3">
                     <div className="flex justify-between text-sm font-medium">
                        <span>Weekly Engagement</span>
                        <span className="text-muted-foreground">Last 7 Days</span>
                     </div>
                     <div className="flex items-end gap-2 h-32 w-full pt-4">
                        {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                           <div key={i} className="flex-1 bg-secondary/10 rounded-t-lg relative group">
                              <div 
                                 className="absolute bottom-0 left-0 right-0 bg-secondary rounded-t-lg transition-all duration-1000"
                                 style={{ height: `${h}%` }}
                              />
                           </div>
                        ))}
                     </div>
                  </div>
                </div>
                
                {/* Floating Elements */}
                <div className="absolute -top-6 -right-6 bg-card border border-border p-4 rounded-xl shadow-xl animate-float-slow hidden sm:block">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                         <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                         <div className="text-sm font-bold">Class of 2026</div>
                         <div className="text-xs text-muted-foreground">98% Active</div>
                      </div>
                   </div>
                </div>
             </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
