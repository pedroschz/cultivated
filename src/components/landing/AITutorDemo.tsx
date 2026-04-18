"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, User, Mic } from "lucide-react";

interface Message {
  id: string;
  role: "ai" | "user";
  text: string;
}

const conversationScript: Omit<Message, "id">[] = [
  { role: "ai", text: "Hey! I see you're working on quadratic equations. Need a hint?" },
  { role: "user", text: "Yeah, I'm stuck on this one. How do I start?" },
  { role: "ai", text: "No problem! First, let's try to get everything on one side of the equation. What do you think that would look like?" },
  { role: "user", text: "Subtract 5 from both sides?" },
  { role: "ai", text: "Exactly! Now you have x² + 4x - 5 = 0. Does that look factorable to you?" },
  { role: "user", text: "Oh right! (x+5)(x-1)?" },
  { role: "ai", text: "Spot on! 🎉 So, what are your two solutions for x?" },
  { role: "user", text: "x = -5 and x = 1" },
  { role: "ai", text: "Perfect. You crushed it! Ready for a harder one?" },
];

export function AITutorDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
        // Smooth scroll to bottom
        setTimeout(() => {
            scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth"
            });
        }, 100);
    }
  }, [messages, isTyping]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const processNextMessage = () => {
      if (currentIndex >= conversationScript.length) {
        // Reset after a delay
        timeout = setTimeout(() => {
          setMessages([]);
          setCurrentIndex(0);
        }, 5000);
        return;
      }

      const nextMsg = conversationScript[currentIndex];
      
      // AI "Thinking" / Typing phase
      if (nextMsg.role === "ai") {
        setIsTyping(true);
        // Randomize typing time based on length
        const typingTime = 1000 + Math.random() * 500;
        
        timeout = setTimeout(() => {
          setIsTyping(false);
          addMessage(nextMsg);
        }, typingTime); 
      } else {
        // User "Speaking" phase
        // Simulate listening time
        const listeningTime = 800 + Math.random() * 500;
        timeout = setTimeout(() => {
            addMessage(nextMsg);
        }, listeningTime); 
      }
    };

    const addMessage = (msg: Omit<Message, "id">) => {
      setMessages((prev) => [...prev, { ...msg, id: Math.random().toString(36).substr(2, 9) }]);
      setCurrentIndex((prev) => prev + 1);
    };

    // Initial start
    if (currentIndex === 0 && messages.length === 0) {
        timeout = setTimeout(processNextMessage, 1000);
    } else {
        processNextMessage();
    }

    return () => clearTimeout(timeout);
  }, [currentIndex, messages.length]);

  return (
    <div className="relative w-full h-full bg-background flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-background to-background/0">
        <div className="flex items-center gap-3 bg-card/80 backdrop-blur-md p-2 pl-3 pr-4 rounded-full border border-border w-fit shadow-sm">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Bot className="w-4 h-4" />
            </div>
            <div>
                <div className="font-bold text-foreground text-xs tracking-wide">AI Tutor</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-[pulse_2s_infinite]" />
                    Online
                </div>
            </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pt-24 pb-32 space-y-6 scrollbar-none"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20, scale: 0.95, x: msg.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex items-end gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm border border-border ${
                    msg.role === "ai" 
                        ? "bg-primary/10 text-primary" 
                        : "bg-muted text-muted-foreground"
                }`}>
                    {msg.role === "ai" ? <Bot size={14} /> : <User size={14} />}
                </div>

                {/* Bubble */}
                <div className={`p-3.5 px-4 rounded-2xl text-[13px] leading-relaxed shadow-sm border ${
                    msg.role === "ai" 
                        ? "bg-muted/50 text-foreground rounded-bl-none border-border" 
                        : "bg-primary text-primary-foreground rounded-br-none border-primary"
                }`}>
                  {msg.text}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        <AnimatePresence>
          {isTyping && (
             <motion.div
               initial={{ opacity: 0, y: 10, scale: 0.9 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
               className="flex justify-start w-full"
             >
               <div className="flex items-end gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex-shrink-0 flex items-center justify-center shadow-sm border border-border">
                      <Bot size={14} />
                  </div>
                  <div className="bg-muted/50 p-4 rounded-2xl rounded-bl-none flex gap-1.5 items-center h-10 border border-border shadow-sm">
                      <motion.span 
                        animate={{ y: [0, -4, 0] }} 
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                        className="w-1.5 h-1.5 bg-foreground/40 rounded-full" 
                      />
                      <motion.span 
                        animate={{ y: [0, -4, 0] }} 
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                        className="w-1.5 h-1.5 bg-foreground/40 rounded-full" 
                      />
                      <motion.span 
                        animate={{ y: [0, -4, 0] }} 
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                        className="w-1.5 h-1.5 bg-foreground/40 rounded-full" 
                      />
                  </div>
               </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Audio Visualizer Overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none z-20 flex flex-col justify-end pb-6 items-center">
          
          {/* Active Status Text */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="mb-6 flex items-center gap-2 px-3 py-1 rounded-full bg-card/50 backdrop-blur-sm border border-border shadow-sm"
          >
             <Mic className="w-3 h-3 text-primary" />
             <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                Voice Mode Active
             </span>
          </motion.div>

          {/* Visualizer Bars */}
          <div className="flex gap-1.5 items-end h-12 mb-2">
            {[...Array(8)].map((_, i) => (
                <VisualizerBar key={i} index={i} />
            ))}
          </div>
      </div>
    </div>
  );
}

function VisualizerBar({ index }: { index: number }) {
  return (
    <motion.div
      animate={{
        height: [12, Math.random() * 30 + 15, 12],
        opacity: [0.5, 1, 0.5]
      }}
      transition={{
        duration: 0.8 + Math.random() * 0.5,
        repeat: Infinity,
        ease: "easeInOut",
        delay: index * 0.1,
      }}
      className="w-1.5 rounded-full bg-primary shadow-sm"
    />
  );
}
