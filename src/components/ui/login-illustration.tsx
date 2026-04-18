"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState, useRef } from "react";

export function LoginIllustration() {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse position state for interactive movement
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring animation for mouse following
  const springConfig = { damping: 25, stiffness: 120 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  useEffect(() => {
    setMounted(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const { left, top, width, height } = containerRef.current.getBoundingClientRect();
        // Calculate normalized mouse position (-1 to 1) relative to center
        const x = (e.clientX - left - width / 2) / (width / 2);
        const y = (e.clientY - top - height / 2) / (height / 2);
        mouseX.set(x);
        mouseY.set(y);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  if (!mounted) return null;

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {/* Dynamic Background Gradient */}
      {/* Light mode: dark mode background hue (#131F24), Dark mode: light blue */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#131F24] via-[#131F24] to-[#131F24] dark:from-[#87CEEB] dark:via-[#B0E0E6] dark:to-[#87CEEB] opacity-80" />

      {/* Stylized 'Knowledge Garden' Scene */}
      <div className="absolute inset-0 flex items-end justify-center">
        {/* Rolling Hills (Background Layer) - Slow Parallax Move Left */}
        <div className="absolute bottom-0 w-full h-[60%] overflow-hidden">
          <motion.div
            className="w-[200%] h-full text-[#1a2d35] dark:text-[#5fb3d9]"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ 
              duration: 60, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          >
            <svg
              className="w-full h-full"
              viewBox="0 0 2880 320"
              preserveAspectRatio="none"
            >
              {/* Duplicated path for seamless loop */}
              <path
                fill="currentColor"
                fillOpacity="1"
                d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,197.3C1248,171,1344,149,1392,138.7L1440,128L1488,138.7C1536,149,1632,171,1728,197.3C1824,224,1920,256,2016,261.3C2112,267,2208,245,2304,224C2400,203,2496,181,2592,181.3C2688,181,2784,203,2832,213.3L2880,224L2880,320L2832,320C2784,320,2688,320,2592,320C2496,320,2400,320,2304,320C2208,320,2112,320,2016,320C1920,320,1824,320,1728,320C1632,320,1536,320,1488,320L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
              />
            </svg>
          </motion.div>
        </div>

        {/* Tree Layer - Interactive Sway */}
        <div className="absolute bottom-0 z-10 w-[800px] h-[700px] flex justify-center items-end mb-[-40px]">
           <TreeIllustration mouseX={springX} mouseY={springY} />
        </div>

        {/* Rolling Hills (Foreground Layer) - Faster Parallax Move Left */}
        <div className="absolute bottom-0 w-full h-[50%] overflow-hidden">
          <motion.div
            className="w-[200%] h-full text-[#1f3a44] dark:text-[#4682b4]"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ 
              duration: 40, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          >
            <svg
              className="w-full h-full"
              viewBox="0 0 2880 320"
              preserveAspectRatio="none"
            >
              <path
                fill="currentColor"
                fillOpacity="1"
                d="M0,96L48,112C96,128,192,160,288,186.7C384,213,480,235,576,213.3C672,192,768,128,864,128C960,128,1056,192,1152,208C1248,224,1344,192,1392,176L1440,160L1488,176C1536,192,1632,224,1728,208C1824,192,1920,128,2016,128C2112,128,2208,192,2304,213.3C2400,235,2496,213,2592,186.7C2688,160,2784,128,2832,112L2880,96L2880,320L2832,320C2784,320,2688,320,2592,320C2496,320,2400,320,2304,320C2208,320,2112,320,2016,320C1920,320,1824,320,1728,320C1632,320,1536,320,1488,320L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
              />
            </svg>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function TreeIllustration({ mouseX, mouseY }: { mouseX: any, mouseY: any }) {
  const trunkColor = "#777777"; // Wolf
  
  // Brand colors for leaves
  const primaryGreen = "#93d333"; // Owl
  const darkGreen = "#79b933"; // Tree Frog
  const lightGreen = "#58CC02"; // Feather Green

  // Calculate gentle sway based on mouse position
  // The further up the tree, the more it moves
  const trunkSway = useTransform(mouseX, [-1, 1], [-5, 5]);
  const branchSway = useTransform(mouseX, [-1, 1], [-15, 15]);
  const leafSway = useTransform(mouseX, [-1, 1], [-25, 25]);
  
  // Vertical compression/stretch based on mouse Y
  const verticalStretch = useTransform(mouseY, [-1, 1], [1.02, 0.98]);

  return (
    <motion.svg 
      width="100%" 
      height="100%" 
      viewBox="0 0 800 800" 
      overflow="visible"
      style={{ scaleY: verticalStretch }}
    >
       {/* Main Trunk */}
       <motion.path
         d="M400,800 Q410,650 400,480" 
         fill="none"
         stroke={trunkColor}
         strokeWidth="32"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1.5, ease: "easeOut", delay: 1 },
           opacity: { duration: 0.1, delay: 1 }
         }}
       />

       {/* Main Branches Level 1 - Start slightly inside trunk to hide connection */}
       {/* Left Branch */}
       <motion.path
         d="M400,500 Q320,440 260,380" 
         fill="none"
         stroke={trunkColor}
         strokeWidth="24"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1.2, ease: "easeOut", delay: 2.2 },
           opacity: { duration: 0.1, delay: 2.2 }
         }}
       />
       {/* Right Branch */}
       <motion.path
         d="M400,500 Q480,440 540,380" 
         fill="none"
         stroke={trunkColor}
         strokeWidth="24"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1.2, ease: "easeOut", delay: 2.2 },
           opacity: { duration: 0.1, delay: 2.2 }
         }}
       />
       {/* Center Branch */}
       <motion.path
         d="M400,500 Q400,420 400,300" 
         fill="none"
         stroke={trunkColor}
         strokeWidth="24"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1.2, ease: "easeOut", delay: 2.2 },
           opacity: { duration: 0.1, delay: 2.2 }
         }}
       />

       {/* Secondary Branches Level 2 - Start slightly inside parent branches */}
       {/* From Left */}
       <motion.path
         d="M270,375 Q220,340 180,300" 
         fill="none"
         stroke={trunkColor}
         strokeWidth="16"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1, ease: "easeOut", delay: 3.2 },
           opacity: { duration: 0.1, delay: 3.2 }
         }}
       />
       <motion.path
         d="M270,375 Q300,340 320,300" 
         fill="none"
         stroke={trunkColor}
         strokeWidth="16"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1, ease: "easeOut", delay: 3.2 },
           opacity: { duration: 0.1, delay: 3.2 }
         }}
       />

       {/* From Right */}
       <motion.path
         d="M530,375 Q580,340 620,300"
         fill="none"
         stroke={trunkColor}
         strokeWidth="16"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1, ease: "easeOut", delay: 3.2 },
           opacity: { duration: 0.1, delay: 3.2 }
         }}
       />
       <motion.path
         d="M530,375 Q500,340 480,300"
         fill="none"
         stroke={trunkColor}
         strokeWidth="16"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1, ease: "easeOut", delay: 3.2 },
           opacity: { duration: 0.1, delay: 3.2 }
         }}
       />

       {/* From Center - Extended Higher for new leaves */}
       <motion.path
         d="M400,290 Q360,200 340,120"
         fill="none"
         stroke={trunkColor}
         strokeWidth="16"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1, ease: "easeOut", delay: 3.2 },
           opacity: { duration: 0.1, delay: 3.2 }
         }}
       />
       <motion.path
         d="M400,290 Q440,200 460,120"
         fill="none"
         stroke={trunkColor}
         strokeWidth="16"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1, ease: "easeOut", delay: 3.2 },
           opacity: { duration: 0.1, delay: 3.2 }
         }}
       />
       <motion.path
         d="M400,290 Q400,180 400,100"
         fill="none"
         stroke={trunkColor}
         strokeWidth="16"
         strokeLinecap="round"
         initial={{ pathLength: 0, opacity: 0 }}
         animate={{ pathLength: 1, opacity: 1 }}
         transition={{ 
           pathLength: { duration: 1, ease: "easeOut", delay: 3.2 },
           opacity: { duration: 0.1, delay: 3.2 }
         }}
       />
       
       {/* Foliage / Canopy - Cupula (Dome) Shape */}
       <motion.g style={{ x: leafSway }}>
          {/* --- CROWN (Broad rounded top) --- */}
          <LeafCluster cx={390} cy={50} r={80} delay={5.2} color={primaryGreen} mouseX={mouseX} />
          <LeafCluster cx={310} cy={75} r={75} delay={5.1} color={lightGreen} mouseX={mouseX} />
          <LeafCluster cx={490} cy={65} r={75} delay={5.3} color={darkGreen} mouseX={mouseX} />
          
          {/* --- UPPER DOME (Wide shoulders) --- */}
          <LeafCluster cx={230} cy={130} r={85} delay={4.8} color={darkGreen} mouseX={mouseX} />
          <LeafCluster cx={570} cy={110} r={80} delay={4.9} color={primaryGreen} mouseX={mouseX} />
          <LeafCluster cx={410} cy={125} r={90} delay={5.0} color={lightGreen} mouseX={mouseX} />
          
          {/* Fillers for upper dome */}
          <LeafCluster cx={315} cy={150} r={70} delay={5.0} color={primaryGreen} mouseX={mouseX} />
          <LeafCluster cx={495} cy={135} r={70} delay={5.1} color={lightGreen} mouseX={mouseX} />

          {/* --- MID DOME (Expanding outwards) --- */}
          <LeafCluster cx={150} cy={210} r={85} delay={4.6} color={lightGreen} mouseX={mouseX} />
          <LeafCluster cx={650} cy={190} r={85} delay={4.7} color={darkGreen} mouseX={mouseX} />
          <LeafCluster cx={290} cy={230} r={80} delay={4.7} color={primaryGreen} mouseX={mouseX} />
          <LeafCluster cx={510} cy={215} r={80} delay={4.8} color={primaryGreen} mouseX={mouseX} />
          
          {/* --- BASE (Wide and grounding) --- */}
          <LeafCluster cx={90} cy={290} r={70} delay={4.4} color={darkGreen} mouseX={mouseX} />
          <LeafCluster cx={710} cy={270} r={70} delay={4.5} color={lightGreen} mouseX={mouseX} />
          <LeafCluster cx={210} cy={310} r={75} delay={4.5} color={lightGreen} mouseX={mouseX} />
          <LeafCluster cx={590} cy={290} r={75} delay={4.6} color={primaryGreen} mouseX={mouseX} />
          <LeafCluster cx={400} cy={280} r={95} delay={4.0} color={darkGreen} mouseX={mouseX} />

          {/* --- BOTTOM FILLERS (Connection to trunk) --- */}
          <LeafCluster cx={330} cy={320} r={65} delay={4.2} color={primaryGreen} mouseX={mouseX} />
          <LeafCluster cx={470} cy={330} r={60} delay={4.3} color={darkGreen} mouseX={mouseX} />
          <LeafCluster cx={170} cy={350} r={60} delay={4.3} color={primaryGreen} mouseX={mouseX} />
          <LeafCluster cx={630} cy={330} r={60} delay={4.4} color={lightGreen} mouseX={mouseX} />
       </motion.g>
    </motion.svg>
  );
}

function LeafCluster({ cx, cy, r, delay, color, mouseX }: { cx: number, cy: number, r: number, delay: number, color: string, mouseX?: any }) {
   // Add independent breathing motion for each leaf cluster
   const randomDuration = 3 + Math.random() * 2;
   const randomDelay = Math.random() * 2;

   // Add independent sway reaction to mouse
   const randomSwayFactor = 5 + Math.random() * 10;
   const leafSway = useTransform(mouseX || useMotionValue(0), [-1, 1], [-randomSwayFactor, randomSwayFactor]);

   return (
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        style={{ x: leafSway }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
            scale: [1, 1.05, 1],
            opacity: 0.9,
            y: [0, -5, 0]
        }}
        transition={{ 
           scale: {
             repeat: Infinity,
             duration: randomDuration,
             delay: randomDelay,
             ease: "easeInOut"
           },
           y: {
             repeat: Infinity,
             duration: randomDuration * 1.5,
             delay: randomDelay,
             ease: "easeInOut"
           },
           default: {
             delay, 
             type: "spring", 
             stiffness: 80, 
             damping: 12 
           }
        }}
        whileHover={{ scale: 1.15 }}
      />
   );
}
