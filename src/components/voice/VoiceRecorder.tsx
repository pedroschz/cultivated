import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';
import { 
  Mic, 
  MicOff, 
  Pause, 
  Play, 
  Square, 
  Volume2, 
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface VoiceRecorderProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  volume: number;
  hasPermission: boolean;
  isRequestingPermission: boolean;
  error: string | null;
  onStartRecording: () => Promise<boolean>;
  onStopRecording: () => Promise<Blob | null>;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onRequestPermission: () => Promise<boolean>;
  className?: string;
}

export function VoiceRecorder({
  isRecording,
  isPaused,
  duration,
  volume,
  hasPermission,
  isRequestingPermission,
  error,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onRequestPermission,
  className
}: VoiceRecorderProps) {
  const [showHelp, setShowHelp] = useState(false);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Permission Request UI
  if (!hasPermission) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Recording Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Microphone Access Required</p>
              <p className="text-sm text-blue-700 mt-1">
                To provide personalized tutoring, we need to record your thinking process as you solve questions. 
                This helps our AI understand where you might need additional support.
              </p>
            </div>
          </div>
          
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Permission Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={onRequestPermission}
              disabled={isRequestingPermission}
              className="flex-1"
            >
              {isRequestingPermission ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Requesting Access...
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Allow Microphone Access
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowHelp(!showHelp)}
            >
              Help
            </Button>
          </div>

          {showHelp && (
            <div className="p-4 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium mb-2">Why do we need microphone access?</p>
              <ul className="space-y-1 text-gray-600">
                <li>• Record your thinking process while solving questions</li>
                <li>• Provide personalized feedback based on your approach</li>
                <li>• Help identify where you might be getting confused</li>
                <li>• Enable AI tutoring conversations when you get answers wrong</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                Your audio is only used for educational purposes and is not stored permanently.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Main Recording Interface
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Recording
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-normal text-green-600">Ready</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-3 h-3 rounded-full transition-all duration-200",
              isRecording && !isPaused 
                ? "bg-red-500 animate-pulse shadow-red-500/50 shadow-lg" 
                : isPaused 
                ? "bg-yellow-500" 
                : "bg-gray-300"
            )} />
            <Badge variant={
              isRecording && !isPaused ? "destructive" : 
              isPaused ? "secondary" : 
              "outline"
            }>
              {isRecording && !isPaused ? "Recording" : 
               isPaused ? "Paused" : 
               "Ready"}
            </Badge>
          </div>
          
          <div className="text-sm font-mono">
            {formatDuration(duration)}
          </div>
        </div>

        {/* Audio Level Visualization */}
        {isRecording && !isPaused && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Volume2 className="h-4 w-4" />
              <span>Audio Level</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress 
                value={volume} 
                className={cn(
                  "flex-1 h-2 transition-all duration-100",
                  volume > 70 ? "bg-red-100" : 
                  volume > 30 ? "bg-green-100" : 
                  "bg-gray-100"
                )}
              />
              <div className="w-12 text-xs text-right">
                {Math.round(volume)}%
              </div>
            </div>
          </div>
        )}

        {/* Recording Controls */}
        <div className="flex gap-2">
          {!isRecording ? (
            <Button 
              onClick={onStartRecording}
              className="flex-1 gap-2"
              size="lg"
            >
              <Mic className="h-4 w-4" />
              Start Recording
            </Button>
          ) : (
            <>
              <Button 
                onClick={isPaused ? onResumeRecording : onPauseRecording}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause
                  </>
                )}
              </Button>
              <Button 
                onClick={onStopRecording}
                variant="destructive"
                size="lg"
                className="flex-1 gap-2"
              >
                <Square className="h-4 w-4" />
                Stop Recording
              </Button>
            </>
          )}
        </div>

        {/* Instructions */}
        {!isRecording && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm">
            <p className="font-medium text-blue-900 mb-1">💡 Pro Tip</p>
            <p className="text-blue-700">
              Think out loud as you work through the question. Explain your reasoning, 
              any formulas you&apos;re considering, and how you&apos;re eliminating wrong answers.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 rounded-lg text-sm">
            <p className="font-medium text-red-900 mb-1">Recording Error</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 