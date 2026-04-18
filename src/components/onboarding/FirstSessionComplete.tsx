"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, BarChart3, Target, Zap, CheckCircle, ArrowRight, X } from 'lucide-react';

/**
 * @file This component displays a congratulatory message and explanation when
 * a user completes their first practice session. It introduces them to the
 * dashboard features and adaptive learning system.
 */

/**
 * Props for the FirstSessionComplete component.
 */
interface FirstSessionCompleteProps {
  /** Callback function called when the user continues to the dashboard. */
  onContinue: () => void;
  /** Whether the component should be visible. */
  isVisible: boolean;
}

/**
 * A component that celebrates the user's first practice session completion
 * and introduces them to the dashboard features and adaptive learning system.
 * 
 * @param onContinue - Callback function when user continues to dashboard.
 * @param isVisible - Whether the component should be displayed.
 * @returns A React component with the first session completion celebration.
 */
export function FirstSessionComplete({ onContinue, isVisible }: FirstSessionCompleteProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={onContinue}
          className="absolute top-2 right-2 h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <CardHeader className="text-center pb-3">
          <div className="flex justify-center mb-3">
            <CheckCircle className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Great Job! 🎉
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            You've completed your first practice session! Here's what happens next.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <h4 className="font-semibold text-foreground mb-3 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-primary" />
                Your Dashboard is Now Live!
              </h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="mt-0.5">📊</Badge>
                  <div>
                    <strong className="text-foreground">Real-time stats:</strong> Track accuracy, time spent, and progress across all topics
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="mt-0.5">📈</Badge>
                  <div>
                    <strong className="text-foreground">Skill mastery:</strong> See your current level in different math and reading topics
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="mt-0.5">🎯</Badge>
                  <div>
                    <strong className="text-foreground">Strengths & weaknesses:</strong> Identify areas that need more focus
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <h4 className="font-semibold text-foreground mb-3 flex items-center">
                <Zap className="h-5 w-5 mr-2 text-primary" />
                Adaptive Learning in Action
              </h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="mt-0.5">🧠</Badge>
                  <div>
                    <strong className="text-foreground">Smart question selection:</strong> Every answer you give helps us choose better questions for you
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="mt-0.5">⚡</Badge>
                  <div>
                    <strong className="text-foreground">Dynamic difficulty:</strong> Questions get harder as you improve, easier if you struggle
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="mt-0.5">🎪</Badge>
                  <div>
                    <strong className="text-foreground">Personalized experience:</strong> Your learning path is unique to your needs and goals
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <div className="flex items-center space-x-2 text-foreground mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">What to do next:</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Head back to your dashboard to see your updated stats, then keep practicing! 
                The more you practice, the more personalized your experience becomes.
              </p>
            </div>
          </div>

          <div className="flex flex-col space-y-3">
            <Button onClick={onContinue} className="w-full">
              <TrendingUp className="mr-2 h-4 w-4" />
              View My Dashboard & Stats
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 