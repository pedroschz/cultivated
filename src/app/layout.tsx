import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { PracticeSessionProvider } from "@/lib/context/PracticeSessionContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Cultivated - SAT Practice Platform",
    template: "%s | Cultivated"
  },
  description: "Master the SAT with personalized practice sessions, detailed analytics, and comprehensive question banks covering all test domains.",
  keywords: ["SAT", "test prep", "practice", "education", "college prep", "standardized testing"],
  authors: [{ name: "Cultivated Team" }],
  creator: "Cultivated",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cultivated.app",
    title: "Cultivated - SAT Practice Platform",
    description: "Master the SAT with personalized practice sessions, detailed analytics, and comprehensive question banks.",
    siteName: "Cultivated",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cultivated - SAT Practice Platform",
    description: "Master the SAT with personalized practice sessions, detailed analytics, and comprehensive question banks.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PracticeSessionProvider>
          <div className="min-h-screen bg-background">
            {children}
          </div>
          <Toaster 
            position="top-right"
            richColors 
            closeButton
            toastOptions={{
              duration: 4000,
            }}
          />
        </PracticeSessionProvider>
      </body>
    </html>
  );
}
