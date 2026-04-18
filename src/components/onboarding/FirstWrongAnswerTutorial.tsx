"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, MessageSquare, Lightbulb, ArrowRight, HelpCircle, BookOpen } from 'lucide-react';

/**
 * @file This component introduces users to the AI tutor feature when they
 * get their first wrong answer. It explains the tutor's capabilities and
 * provides an option to immediately try the tutor if microphone access is available.
 */

/**
 * Props for the FirstWrongAnswerTutorial component.
 */
interface FirstWrongAnswerTutorialProps {
  /** Callback function called when the user continues practicing. */
  onContinue: () => void;
  /** Callback function called when the user wants to open the AI tutor. */
  onOpenTutor: () => void;
  /** Whether the component should be visible. */
  isVisible: boolean;
  /** Whether to show the option to immediately open the AI tutor. */
  showTutorOption: boolean;
}

/**
 * A tutorial component that introduces users to the AI tutor feature
 * when they get their first wrong answer. It explains the tutor's
 * capabilities and provides immediate access if microphone is available.
 * 
 * @param onContinue - Callback function when user continues practicing.
 * @param onOpenTutor - Callback function when user opens the AI tutor.
 * @param isVisible - Whether the component should be displayed.
 * @param showTutorOption - Whether to show the immediate tutor option.
 * @returns A React component with the AI tutor introduction.
 */
export function FirstWrongAnswerTutorial({ 
  onContinue, 
  onOpenTutor, 
  isVisible, 
  showTutorOption 
}: FirstWrongAnswerTutorialProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="max-w-lg mx-4 border-2 border-orange-500 shadow-2xl">
        {/* Header with AI tutor introduction */}
        <CardHeader className="text-center pb-3">
          <div className="flex justify-center mb-3">
            <Brain className="h-12 w-12 text-orange-500 animate-pulse" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Meet Your AI Tutor! 🧠
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Don't worry about getting that wrong - that's how we learn! Let me introduce you to your AI tutor.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* AI tutor capabilities explanation */}
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-800 mb-3 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Your AI Tutor can help you:
              </h4>
              <div className="space-y-3 text-sm text-orange-700">
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 mt-0.5">💡</Badge>
                  <div>
                    <strong>Understand mistakes:</strong> Get explanations for why an answer is wrong and learn the correct approach
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 mt-0.5">🎯</Badge>
                  <div>
                    <strong>Break down problems:</strong> Step-by-step guidance through complex questions
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 mt-0.5">🔄</Badge>
                  <div>
                    <strong>Practice strategies:</strong> Learn different approaches to solve similar problems
                  </div>
                </div>
              </div>
            </div>

            {/* Immediate tutor option (if microphone is available) */}
            {showTutorOption && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 text-blue-800 mb-2">
                  <Lightbulb className="h-4 w-4" />
                  <span className="text-sm font-medium">Ready to try it now?</span>
                </div>
                <p className="text-sm text-blue-700">
                  Since you have microphone access enabled, you can chat with the AI tutor about this question right now!
                </p>
              </div>
            )}

            {/* Learning tip */}
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="flex items-start space-x-2 text-green-800">
                <BookOpen className="h-4 w-4 mt-0.5" />
                <div className="text-sm">
                  <strong>Learning tip:</strong> The tutor gets smarter the more you use it. Don't hesitate to ask questions!
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col space-y-3">
            {/* AI tutor button (only shown if microphone is available) */}
            {showTutorOption && (
              <Button onClick={onOpenTutor} className="w-full bg-blue-600 hover:bg-blue-700">
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat with AI Tutor about this question
              </Button>
            )}
            
            {/* Continue practicing button */}
            <Button 
              variant={showTutorOption ? "outline" : "default"} 
              onClick={onContinue} 
              className="w-full"
            >
              Got it! Continue practicing 
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 