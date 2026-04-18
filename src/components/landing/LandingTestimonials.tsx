"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Jenkins",
    role: "High School Junior",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    content: "My SAT score went up 200 points in just 3 weeks! The AI tutor actually explains things in a way that makes sense.",
    rating: 5,
  },
  {
    name: "Michael Chen",
    role: "MIT Admit",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
    content: "I was stuck at 1400 for months. CultivatED helped me break through to 1550+. The adaptive practice is legit.",
    rating: 5,
  },
  {
    name: "Emily Rodriguez",
    role: "Parent",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
    content: "Finally, a prep tool that my daughter actually wants to use. It feels like a game but the results are serious.",
    rating: 5,
  },
  {
    name: "David Kim",
    role: "Senior",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
    content: "The analytics showed me exactly where I was losing points. I focused on those areas and crushed the actual test.",
    rating: 5,
  },
  {
    name: "Jessica Foster",
    role: "Harvard '28",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica",
    content: "Way better than the expensive tutors I tried. The voice mode makes it feel like you're talking to a real person.",
    rating: 5,
  },
  {
    name: "Ryan Park",
    role: "Junior",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ryan",
    content: "Honestly, it's actually kinda fun. I do a 10-minute session on the bus every day.",
    rating: 4,
  },
];

const duplicatedTestimonials = [...testimonials, ...testimonials, ...testimonials];

export function LandingTestimonials() {
  return (
    <section className="py-24 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4 md:px-6 mb-12 text-center">
        <h2 className="text-3xl md:text-5xl font-display font-black text-foreground mb-4">
          Students <span className="text-primary">Love</span> CultivatED
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Join dozens of students who have transformed their SAT prep experience.
        </p>
      </div>

      <div className="relative w-full overflow-hidden mask-gradient-x">
        <div className="flex gap-6 animate-marquee w-max pl-4 hover:[animation-play-state:paused]">
          {duplicatedTestimonials.map((testimonial, i) => (
            <div
              key={i}
              className="w-[350px] flex-shrink-0 bg-background border-2 border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-border">
                  <Image
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">{testimonial.name}</h4>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{testimonial.role}</p>
                </div>
              </div>
              <div className="flex gap-0.5 mb-3 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={cn(
                      "w-4 h-4 fill-current", 
                      i >= testimonial.rating && "text-gray-300 fill-gray-300"
                    )} 
                  />
                ))}
              </div>
              <p className="text-muted-foreground leading-relaxed">
                &ldquo;{testimonial.content}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Styles for Marquee & Gradient Mask */}
      <style jsx>{`
        .animate-marquee {
          animation: marquee 50s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .mask-gradient-x {
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
      `}</style>
    </section>
  );
}
