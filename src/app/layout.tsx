/**
 * @file This file defines the root layout component for the Next.js application.
 * It sets up the global HTML structure, fonts, metadata, and provides the
 * PracticeSessionProvider context wrapper for all pages. This layout is applied
 * to every page in the application and handles the overall app structure.
 */
import "@/lib/polyfill-storage"; // Must be first to patch broken SSR localStorage
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { PracticeSessionProvider } from "@/lib/context/PracticeSessionContext";
import { UserProvider } from "@/lib/context/UserContext";
import { MobileNavVisible } from "../components/layout/MobileNavVisible";
import { AuthGuard } from "@/components/layout/auth-guard";
import { ThemeProvider } from "@/components/theme-provider";
import { OnlineHeartbeat } from "@/components/online-heartbeat";
import { AiLimitDialog } from "@/components/ai/AiLimitDialog";
import { WEB_BASE_URL, APP_NAME } from "@/lib/config";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Default OSS font setup uses Inter (Google Fonts) for both display and body
// text. The deployed site uses commercial brand fonts ("DIN Round Pro" and
// "Brasley") which are not redistributed in this repo. To enable them locally
// after providing licensed font files in `private-assets/fonts/` and running
// `npm run setup:fonts`, swap this file's font setup with the example in
// `src/app/layout.brand-fonts.tsx.example` (or replace the `dinRoundPro` /
// `brasley` definitions below with the `localFont(...)` calls shown there).
const dinRoundPro = Inter({
  variable: "--font-din",
  subsets: ["latin"],
  display: "swap",
});

const brasley = Inter({
  variable: "--font-brasley",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} - SAT Practice Platform`,
    template: `%s | ${APP_NAME}`,
  },
  description: "Master the SAT with personalized practice sessions, detailed analytics, and comprehensive question banks covering all test domains.",
  keywords: ["SAT", "test prep", "practice", "education", "college prep", "standardized testing"],
  authors: [{ name: `${APP_NAME} Team` }],
  creator: APP_NAME,
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: WEB_BASE_URL,
    title: `${APP_NAME} - Free SAT tutors and practice`,
    description: "We are the best SAT practice platform. Master the SAT with personalized practice sessions, detailed analytics, and comprehensive question banks.",
    siteName: APP_NAME,
    images: [
      {
        url: "/text-logo.png",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} Logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} - SAT Practice Platform`,
    description: "Master the SAT with personalized practice sessions, detailed analytics, and comprehensive question banks.",
    images: ["/text-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  metadataBase: new URL(WEB_BASE_URL),
  alternates: {
    canonical: './',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dinRoundPro.variable} ${geistMono.variable} ${brasley.variable} antialiased font-sans`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: APP_NAME,
              url: WEB_BASE_URL,
              logo: `${WEB_BASE_URL}/logo.png`,
              description: "Master the SAT with personalized practice sessions, detailed analytics, and comprehensive question banks.",
            }),
          }}
        />
        <ThemeProvider>
          <OnlineHeartbeat />
          <UserProvider>
            <PracticeSessionProvider>
              <div className="ambient-bg">
                <AuthGuard />
                <div className="pb-16 md:pb-0 safe-bottom">
                  {children}
                </div>
                {/* Mobile bottom navigation (hidden on practice pages) */}
                <MobileNavVisible />
              </div>
              <AiLimitDialog />
              <Toaster 
                position="top-right"
                richColors 
                closeButton
                toastOptions={{
                  duration: 4000,
                }}
              />
            </PracticeSessionProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

// Moved conditional rendering of MobileNav to a dedicated client component
