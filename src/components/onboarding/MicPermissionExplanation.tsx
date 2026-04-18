"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, Brain, MessageCircle, Shield, Volume2 } from 'lucide-react';

/**
 * @file This component explains the microphone permission request to users
 * before enabling the AI tutor feature. It clarifies why the permission
 * is needed and provides privacy assurances.
 */

/**
 * Props for the MicPermissionExplanation component.
 */
interface MicPermissionExplanationProps {
  /** Callback function called when the user agrees to enable the AI tutor. */
  onProceed: () => void;
  /** Callback function called when the user chooses to skip the AI tutor. */
  onSkip: () => void;
  /** Whether the component should be visible. */
  isVisible: boolean;
}

/**
 * A component that explains the microphone permission request for the AI tutor feature.
 * It provides clear reasons for the permission request and privacy assurances.
 * 
 * @param onProceed - Callback function when user enables AI tutor.
 * @param onSkip - Callback function when user skips AI tutor.
 * @param isVisible - Whether the component should be displayed.
 * @returns A React component with the microphone permission explanation.
 */
export function MicPermissionExplanation({ onProceed, onSkip, isVisible }: MicPermissionExplanationProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <Card className="max-w-lg mx-4 border-2 border-[#1CB0F6] border-b-4 shadow-none bg-white rounded-2xl">
        {/* Header with AI tutor and microphone icons */}
        <CardHeader className="text-center pb-3">
          <div className="flex justify-center mb-3">
            <div className="relative">
              <Mic className="h-12 w-12 text-[#1CB0F6]" />
              <Brain className="h-6 w-6 text-[#93d333] absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-[#4B4B4B]">
            AI Tutor Mode 🤖
          </CardTitle>
          <p className="text-[#777777] mt-2">
            We're about to ask for microphone permission to enable our AI tutor feature
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Explanation of why microphone permission is needed */}
            <div className="bg-[#ddf4ff] p-4 rounded-xl border-2 border-[#1CB0F6]/30">
              <h4 className="font-bold text-[#1CB0F6] mb-2 flex items-center">
                <MessageCircle className="h-5 w-5 mr-2" />
                Why we need your microphone:
              </h4>
              <div className="space-y-2 text-sm text-[#1CB0F6]">
                <div className="flex items-start space-x-2">
                  <Badge variant="secondary" className="bg-[#1CB0F6] text-white mt-0.5">1</Badge>
                  <span><strong>Think aloud:</strong> Speak your thought process as you solve problems</span>
                </div>
                <div className="flex items-start space-x-2">
                  <Badge variant="secondary" className="bg-[#1CB0F6] text-white mt-0.5">2</Badge>
                  <span><strong>Get help:</strong> Our AI tutor can understand your reasoning and provide targeted help</span>
                </div>
                <div className="flex items-start space-x-2">
                  <Badge variant="secondary" className="bg-[#1CB0F6] text-white mt-0.5">3</Badge>
                  <span><strong>Better learning:</strong> Explaining your thoughts helps reinforce understanding</span>
                </div>
              </div>
            </div>

            {/* Privacy assurance */}
            <div className="bg-[#d7ffb8] p-3 rounded-xl border-2 border-[#93d333]/30">
              <div className="flex items-center space-x-2 text-[#93d333]">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-bold">Your privacy is protected - audio is only used for tutoring</span>
              </div>
            </div>

            {/* Optional usage tip */}
            <div className="bg-[#fff2cc] p-3 rounded-xl border-2 border-[#FFC800]/30">
              <div className="flex items-center space-x-2 text-[#d9a504]">
                <Volume2 className="h-4 w-4" />
                <span className="text-sm font-bold">
                  <strong>Tip:</strong> You can always practice without the tutor if you prefer silent study
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col space-y-3">
            {/* Enable AI tutor button */}
            <Button onClick={onProceed} className="w-full bg-[#1CB0F6] border-0 border-b-[4px] border-b-[#1899D6] hover:bg-[#40C3FF]">
              <Mic className="mr-2 h-4 w-4" />
              Enable AI Tutor & Request Permission
            </Button>
            
            {/* Skip option */}
            <Button variant="outline" onClick={onSkip} className="w-full">
              Skip for now (Practice silently)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
