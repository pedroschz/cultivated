"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setIsLoggedIn(!!user);
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent",
        scrolled
          ? "bg-background/95 backdrop-blur-md border-border shadow-sm py-2"
          : "bg-transparent py-4"
      )}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative w-8 h-8 md:w-10 md:h-10 transition-transform group-hover:scale-105">
            <Image
              src="/logo.png"
              alt="CultivatED Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="font-display font-bold text-xl md:text-2xl tracking-tight text-foreground">
            CultivatED
          </span>
        </Link>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/blog" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wide">
            Blog
          </Link>
          <a href={isLoggedIn ? "/dashboard" : "/login"} className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wide">
            {isLoggedIn ? "Dashboard" : "Log in"}
          </a>
          <Button asChild size="lg" className="font-bold uppercase tracking-wider shadow-[0_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.2)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-[colors,opacity,box-shadow] active:transition-none">
            <a href={isLoggedIn ? "/dashboard" : "/signup"}>{isLoggedIn ? "Go to Dashboard" : "Get started"}</a>
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border p-4 shadow-lg animate-in slide-in-from-top-5">
          <div className="flex flex-col gap-4">
            <Link 
              href="/blog" 
              className="flex items-center justify-center h-12 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors uppercase tracking-wide"
              onClick={() => setMobileMenuOpen(false)}
            >
              Blog
            </Link>
            <a 
              href={isLoggedIn ? "/dashboard" : "/login"} 
              className="flex items-center justify-center h-12 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors uppercase tracking-wide"
              onClick={() => setMobileMenuOpen(false)}
            >
              {isLoggedIn ? "Dashboard" : "Log in"}
            </a>
            <Button asChild size="lg" className="w-full font-bold uppercase tracking-wider shadow-[0_4px_0_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[4px] transition-[colors,opacity,box-shadow] active:transition-none">
              <a href={isLoggedIn ? "/dashboard" : "/signup"} onClick={() => setMobileMenuOpen(false)}>{isLoggedIn ? "Go to Dashboard" : "Get Started"}</a>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
