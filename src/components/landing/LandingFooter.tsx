import Link from "next/link";
import { Github, Twitter } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="bg-muted/30 border-t border-border pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <span className="font-display font-bold text-xl tracking-tight text-foreground">
              CultivatED
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Making SAT prep accessible, engaging, and effective for everyone.
            </p>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-bold text-foreground">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/demo" className="hover:text-primary transition-colors">Try Demo</Link></li>
              <li><Link href="/signup" className="hover:text-primary transition-colors">Sign Up</Link></li>
              <li><Link href="/login" className="hover:text-primary transition-colors">Log In</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-foreground">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Study Guides</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-foreground">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CultivatED. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
             <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
               <Twitter className="h-5 w-5" />
               <span className="sr-only">Twitter</span>
             </Link>
             <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
               <Github className="h-5 w-5" />
               <span className="sr-only">GitHub</span>
             </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
