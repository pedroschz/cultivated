"use client";

import { LandingFeature } from "@/components/landing/LandingFeature";
import { BarChart3, Users, FileText, School } from "lucide-react";
import { motion } from "framer-motion";

export function SchoolsFeatures() {
  return (
    <section id="features" className="relative bg-white dark:bg-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />

      <LandingFeature
        title="Real-time Analytics"
        description="Track student activity as it happens. See who's studying, what they're working on, and where they're struggling with our intuitive dashboard."
        badge="Insights"
        icon={BarChart3}
        orientation="left"
        imageComponent={
          <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center p-8 relative overflow-hidden">
             {/* Grid Background */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
             
             <div className="w-full space-y-6 relative z-10">
               <div className="flex justify-between items-end">
                  <div className="space-y-1">
                     <div className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Total Study Time</div>
                     <div className="flex items-baseline gap-2">
                        <motion.span 
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          className="text-4xl font-black text-slate-900 dark:text-white"
                        >
                          1,240
                        </motion.span>
                        <span className="text-xl text-slate-500 font-medium">hrs</span>
                     </div>
                  </div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="text-green-600 font-bold bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                  >
                    <span>↑</span> +12% vs last week
                  </motion.div>
               </div>
               
               <div className="flex items-end gap-3 h-56 w-full pt-4">
                  {[35, 55, 40, 70, 60, 85, 95].map((h, i) => (
                     <div key={i} className="flex-1 h-full flex items-end group relative">
                        <motion.div 
                           initial={{ height: 0 }}
                           whileInView={{ height: `${h}%` }}
                           viewport={{ once: true }}
                           transition={{ duration: 1, delay: i * 0.1, type: "spring", stiffness: 100 }}
                           className="w-full bg-primary/20 dark:bg-primary/10 rounded-t-md relative overflow-hidden hover:bg-primary/30 dark:hover:bg-primary/20 transition-colors"
                        >
                           <motion.div 
                             initial={{ height: 0 }}
                             whileInView={{ height: "100%" }}
                             viewport={{ once: true }}
                             transition={{ duration: 1.5, delay: 0.5 + (i * 0.1) }}
                             className="absolute bottom-0 inset-x-0 bg-primary rounded-t-md opacity-80"
                           />
                        </motion.div>
                        
                        {/* Tooltip */}
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-20 shadow-xl scale-95 group-hover:scale-100 pointer-events-none">
                           {h * 2} mins
                           <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                        </div>
                     </div>
                  ))}
               </div>
             </div>
          </div>
        }
      />

      <LandingFeature
        title="Manage Your Classes"
        description="Organize students into classes and sections. Assign specific practice sets or let our adaptive AI guide their learning path."
        badge="Management"
        icon={Users}
        orientation="right"
        imageComponent={
           <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center p-8 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10" />
              
              <div className="w-full max-w-sm bg-white dark:bg-slate-950 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 transform rotate-2 hover:rotate-0 transition-all duration-500">
                 <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 rounded-full bg-primary" />
                      <span className="font-bold text-lg text-slate-900 dark:text-white">SAT: Reading and Writing</span>
                    </div>
                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-600 dark:text-slate-400 uppercase tracking-wider">Section 3</span>
                 </div>
                 <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 min-h-[300px]">
                    {[1, 2, 3, 4, 5].map((i) => (
                       <motion.div 
                          key={i} 
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.15 }}
                          className="flex items-center gap-4 p-3 mb-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md border border-transparent hover:border-primary/20 dark:hover:border-primary/20 transition-all cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm
                            ${i === 1 ? 'bg-primary' : i === 2 ? 'bg-secondary' : i === 3 ? 'bg-orange-400' : 'bg-blue-400'}`}
                          >
                             {String.fromCharCode(64 + i)}
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="h-2.5 w-24 bg-slate-200 dark:bg-slate-800 rounded-full mb-2" />
                             <div className="flex gap-1">
                                <div className="h-1.5 w-full max-w-[60%] bg-primary/10 dark:bg-primary/20 rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${80 + (i * 3)}%` }} />
                                </div>
                             </div>
                          </div>
                          <div className="text-sm font-bold font-mono text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">
                             9{i}%
                          </div>
                       </motion.div>
                    ))}
                 </div>
              </div>
           </div>
        }
      />

      <LandingFeature
        title="Comprehensive Reports"
        description="Export detailed CSV reports for your district's records. Analyze mastery by topic, time spent, and question accuracy."
        badge="Reporting"
        icon={FileText}
        orientation="left"
        imageComponent={
           <div className="w-full h-full bg-slate-900 flex items-center justify-center p-8 relative overflow-hidden group">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#93d333 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-80" />
              
              <motion.div 
                whileHover={{ y: -5, rotate: -1 }}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10 border border-slate-200 dark:border-slate-800"
              >
                 <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400 shadow-sm">
                       <FileText className="w-6 h-6" />
                    </div>
                    <div>
                       <div className="font-bold text-slate-900 dark:text-white text-lg">End of Term Report</div>
                       <div className="text-xs text-slate-500 font-medium">Generated just now</div>
                    </div>
                 </div>
                 
                 <div className="space-y-4 mb-8">
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-full overflow-hidden relative">
                      <motion.div 
                        initial={{ x: "-100%" }}
                        whileInView={{ x: "0%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        className="absolute inset-0 bg-slate-200 dark:bg-slate-700" 
                      />
                    </div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-5/6 overflow-hidden relative">
                      <motion.div 
                        initial={{ x: "-100%" }}
                        whileInView={{ x: "0%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, ease: "circOut", delay: 0.2 }}
                        className="absolute inset-0 bg-slate-200 dark:bg-slate-700" 
                      />
                    </div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-4/6 overflow-hidden relative">
                      <motion.div 
                        initial={{ x: "-100%" }}
                        whileInView={{ x: "0%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, ease: "circOut", delay: 0.4 }}
                        className="absolute inset-0 bg-slate-200 dark:bg-slate-700" 
                      />
                    </div>
                 </div>
                 
                 <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex -space-x-2">
                      {[1,2,3].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700" />
                      ))}
                    </div>
                    
                    <motion.button
                       whileHover={{ scale: 1.05 }}
                       whileTap={{ scale: 0.95 }}
                       className="bg-primary text-white text-sm font-bold px-4 py-2.5 rounded-lg shadow-lg shadow-primary/20 dark:shadow-none hover:bg-primary/90 flex items-center gap-2"
                    >
                       <span>Download CSV</span>
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                       </svg>
                    </motion.button>
                 </div>
              </motion.div>
              
              {/* Floating particles */}
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    y: [-20, -100], 
                    opacity: [0, 1, 0],
                    x: Math.random() * 40 - 20 
                  }}
                  transition={{ 
                    duration: 2 + Math.random() * 2, 
                    repeat: Infinity, 
                    delay: Math.random() * 2 
                  }}
                  className="absolute w-1 h-1 bg-primary rounded-full"
                  style={{ 
                    left: `${50 + (Math.random() * 40 - 20)}%`, 
                    bottom: '20%' 
                  }}
                />
              ))}
           </div>
        }
      />
    </section>
  );
}
