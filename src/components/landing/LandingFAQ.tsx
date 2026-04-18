"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "Is CultivatED really free?",
    answer: "Yes! CultivatED is completely free for students. We're currently in beta and committed to making high-quality SAT prep accessible to everyone."
  },
  {
    question: "How does the AI Tutor work?",
    answer: "Our AI Tutor uses advanced language models to provide personalized, step-by-step guidance through SAT problems. It can speak, listen, and adapt to your learning style—just like a real tutor, but available 24/7. You can ask questions, get hints, and receive explanations tailored to your level."
  },
  {
    question: "What makes CultivatED different from other SAT prep tools?",
    answer: "CultivatED combines gamified practice, adaptive learning algorithms, and an AI tutor that actually explains concepts—not just answers. Our analytics show you exactly where you're improving and where to focus. Plus, it's designed to be engaging, so you'll actually want to practice."
  },
  {
    question: "How quickly will I see score improvements?",
    answer: "Most students see significant improvements within 1-2 weeks of consistent practice. Our average user gains 160+ points. The key is regular practice—even 10-15 minutes a day can make a huge difference when combined with our adaptive algorithm that targets your weak spots."
  },
  {
    question: "Do I need to download anything?",
    answer: "No downloads required! CultivatED is a web-based platform that works on any device with a browser—laptop, tablet, or phone. You can practice anywhere, anytime, and your progress syncs automatically across all your devices."
  },
  {
    question: "Is CultivatED suitable for all SAT skill levels?",
    answer: "Absolutely! Whether you're just starting your SAT prep or looking to break through a score plateau, CultivatED adapts to your level. Our algorithm adjusts question difficulty based on your performance, ensuring you're always challenged but never overwhelmed."
  },
  {
    question: "Can schools use CultivatED?",
    answer: "Yes! We offer CultivatED for Schools with comprehensive admin dashboards, class management, and detailed analytics. Schools can track student progress, assign practice, and get insights into student performance. Contact us to learn more about our school programs."
  },
  {
    question: "What if I have technical issues or questions?",
    answer: "We're here to help! You can report issues through the Settings page and we will get back to you as soon as possible."
  }
];

export function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // First item open by default

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] aspect-square bg-gradient-to-b from-primary/5 to-transparent rounded-[100%] blur-3xl opacity-60" />
      </div>

      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-display font-black text-foreground mb-4">
            Frequently Asked <span className="text-primary">Questions</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about CultivatED
          </p>
        </div>

        {/* FAQ Items */}
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="bg-card border-2 border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => toggleItem(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 hover:bg-muted/30 transition-colors"
              >
                <h3 className="text-lg font-bold text-foreground pr-8">
                  {faq.question}
                </h3>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 pt-0">
                      <p className="text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
