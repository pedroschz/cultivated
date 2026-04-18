"use client";

import Link from "next/link";
import { BlogPost } from "@/lib/blog-service";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface BlogCardProps {
  post: BlogPost;
  featured?: boolean;
  className?: string;
}

export function BlogCard({ post, featured = false, className }: BlogCardProps) {
  // Format date safely
  const formattedDate = post.publishedAt 
    ? format(post.publishedAt, 'MMM d, yyyy') 
    : format(post.createdAt || Date.now(), 'MMM d, yyyy');

  return (
    <Link 
      href={`/blog/${post.slug}`} 
      className={cn("group block h-full outline-none", className)}
    >
      <div className={cn(
        "flex flex-col h-full rounded-2xl overflow-hidden border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1",
        featured ? "md:grid md:grid-cols-2" : ""
      )}>
        <div className={cn(
          "relative overflow-hidden bg-muted", 
          featured ? "h-64 md:h-full min-h-[300px]" : "h-48"
        )}>
           {/* Gradient Overlay */}
           <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
           
           {/* Placeholder for image */}
           <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display font-black text-6xl md:text-8xl text-foreground/5 select-none transform -rotate-12 group-hover:scale-110 transition-transform duration-500">
                {post.category.charAt(0)}
              </span>
           </div>
           
           {/* Actual Image if available */}
           {post.coverImage && (
             <img src={post.coverImage} alt={post.title} className="absolute inset-0 w-full h-full object-cover" />
           )}
        </div>
        
        <div className="p-6 md:p-8 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="text-primary bg-primary/10 px-2 py-1 rounded-md">{post.category}</span>
            <span>•</span>
            <span>{post.readTime}</span>
          </div>
          
          <h3 className={cn(
            "font-display font-bold text-foreground mb-4 group-hover:text-primary transition-colors leading-tight",
            featured ? "text-2xl md:text-4xl" : "text-xl"
          )}>
            {post.title}
          </h3>
          
          <p className="text-muted-foreground mb-6 line-clamp-3 flex-1 leading-relaxed">
            {post.excerpt}
          </p>
          
          <div className="flex items-center justify-between mt-auto pt-6 border-t border-border/50">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-sm font-bold text-secondary-foreground border border-secondary/30">
                    {post.author.charAt(0)}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground leading-none mb-1">{post.author}</span>
                    <span className="text-xs text-muted-foreground font-medium">{formattedDate}</span>
                </div>
             </div>
             
             <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary/10 text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 transform group-hover:scale-110">
                <ArrowRight className="w-5 h-5" />
             </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
