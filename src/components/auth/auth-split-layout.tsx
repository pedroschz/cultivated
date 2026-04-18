import React from "react";
import Image from "next/image";
import Link from "next/link";
import { LoginIllustration } from "@/components/ui/login-illustration";

interface AuthSplitLayoutProps {
  children: React.ReactNode;
  heading?: string;
  subheading?: string;
  image?: React.ReactNode;
}

export function AuthSplitLayout({
  children,
  heading = "",
  subheading = ""
}: AuthSplitLayoutProps) {
  return (
    <div className="min-h-screen w-full flex">
      {/* Left Column - Marketing (Desktop only) */}
      {/* Light mode: dark mode background hue (#131F24), Dark mode: light blue */}
      <div className="hidden lg:flex w-1/2 flex-col bg-[#131F24] dark:bg-[#87CEEB] text-white p-12 relative overflow-hidden justify-between">
        {/* Illustration background */}
        <LoginIllustration />
        
        <div className="relative z-10">
          <Link href="/">
             <Image 
              src="/text-logo-dark.png" 
              alt="CultivatED Logo" 
              width={180} 
              height={60} 
              className="brightness-0 invert"
            />
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-display font-bold mb-6 leading-tight">
            {heading}
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed">
            {subheading}
          </p>
        </div>
        
        <div className="relative z-10 text-sm text-zinc-500">
          © {new Date().getFullYear()} CultivatED. All rights reserved.
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
           <div className="lg:hidden flex justify-center mb-8">
             <Link href="/">
                <Image 
                  src="/text-logo.png" 
                  alt="CultivatED Logo" 
                  width={150} 
                  height={50} 
                  className="dark:brightness-0 dark:invert"
                />
             </Link>
           </div>
           
           {children}
        </div>
      </div>
    </div>
  );
}
