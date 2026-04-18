"use client";

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, X } from 'lucide-react';

/**
 * @file This component provides a multi-step onboarding experience for new users
 * who have just completed their profile setup. It includes confetti animations,
 * interactive tutorial steps, and guides users through the key features of the app.
 */

/**
 * Props for the FirstTimeExperience component.
 */
interface FirstTimeExperienceProps {
  /** Callback function called when the tutorial is completed or skipped. */
  onComplete: () => void;
  /** Whether the tutorial should be visible. */
  isVisible: boolean;
}

/**
 * A multi-step onboarding tutorial component that welcomes new users and
 * introduces them to the key features of the application.
 * 
 * @param onComplete - Callback function when tutorial is completed.
 * @param isVisible - Whether the tutorial should be displayed.
 * @returns A React component with the onboarding tutorial.
 */
export function FirstTimeExperience({ onComplete, isVisible }: FirstTimeExperienceProps) {
  const [showOverlay, setShowOverlay] = useState(false);

  // Effect to trigger confetti animation when tutorial becomes visible
  useEffect(() => {
    if (isVisible) {
      // Trigger confetti animation
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          setShowOverlay(true);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);
        // since particles fall down, start a bit higher than random
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isVisible]);

  if (!isVisible || !showOverlay) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={onComplete}
          className="absolute top-2 right-2 h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-2xl font-bold">
            Welcome to CultivatED
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            You've successfully completed your profile setup.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            We've created a personalized curriculum that adapts to your strengths and weaknesses. You can track your progress and see your recommended next steps right from your dashboard.
          </p>
          <div className="flex justify-center">
            <Button onClick={onComplete} className="w-full sm:w-auto">
              Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
