import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '../ui/button';

interface AutoVoiceRecorderProps {
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
  autoStart?: boolean; // Whether to auto-start when permission is granted
  questionId?: string; // To track when new questions appear
}

export function AutoVoiceRecorder({
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
  className,
  autoStart = true,
  questionId
}: AutoVoiceRecorderProps) {
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const previousQuestionId = useRef<string | undefined>(questionId);
  const hasTriedPermission = useRef(false);
  const isInitialized = useRef(false);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Detect speaking based on volume
  useEffect(() => {
    setIsSpeaking(volume > 5);
  }, [volume]);

  // Initialize and request permission on first load
  useEffect(() => {
    if (!isInitialized.current && autoStart && !hasPermission && !isRequestingPermission) {
      isInitialized.current = true;
      console.log('🎤 Initializing AutoVoiceRecorder, requesting permission...');
      
      // Request permission immediately
      onRequestPermission().then(granted => {
        console.log('🎤 Initial permission request result:', granted);
        if (!granted && !hasTriedPermission.current) {
          hasTriedPermission.current = true;
          setShowPermissionModal(true);
        }
      });
    }
  }, [autoStart, hasPermission, isRequestingPermission, onRequestPermission]);

  // Auto-start recording when question changes and we have permission
  useEffect(() => {
    if (questionId && 
        questionId !== previousQuestionId.current && 
        hasPermission && 
        autoStart && 
        !isRecording && 
        !isPaused) {
      
      console.log('✅ Auto-starting recording for question:', questionId);
      console.log('State check:', { hasPermission, isRecording, isPaused });
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        onStartRecording().then(success => {
          console.log('Recording start result:', success);
        });
      }, 100);
      
      previousQuestionId.current = questionId;
    } else if (questionId && questionId !== previousQuestionId.current) {
      console.log('❌ Cannot auto-start recording:', {
        questionId,
        hasPermission,
        isRecording,
        isPaused,
        autoStart
      });
      previousQuestionId.current = questionId;
    }
  }, [questionId, hasPermission, autoStart, isRecording, isPaused, onStartRecording]);

  // Force start recording if we have permission but not recording
  const handleForceStart = async () => {
    if (hasPermission && !isRecording) {
      console.log('🔧 Force starting recording...');
      const success = await onStartRecording();
      console.log('Force start result:', success);
    }
  };

  const handlePermissionRequest = async () => {
    console.log('🎤 Manual permission request...');
    const granted = await onRequestPermission();
    if (granted) {
      console.log('✅ Manual permission granted');
      setShowPermissionModal(false);
      
      // Try to start recording immediately after permission is granted
      if (questionId && autoStart) {
        setTimeout(() => {
          console.log('🎤 Starting recording after permission grant...');
          onStartRecording();
        }, 200);
      }
    } else {
      console.log('❌ Manual permission denied');
    }
  };

  // Permission Modal
  if (showPermissionModal && !hasPermission) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <Mic className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold">Enable Voice Recording</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Automatic Voice Recording</p>
                <p className="text-sm text-blue-700 mt-1">
                  We'll automatically record your thinking process as you work through questions. 
                  This helps our AI provide better tutoring when you get answers wrong.
                </p>
              </div>
            </div>
            
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Permission Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                onClick={handlePermissionRequest}
                disabled={isRequestingPermission}
                className="flex-1"
              >
                {isRequestingPermission ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Enable Recording
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowPermissionModal(false)}
              >
                Skip
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Recording is automatically handled - no manual controls needed
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show permission indicator if no permission
  if (!hasPermission) {
    return (
      <div className={cn(
        "fixed bottom-6 left-6 z-40 transition-all duration-300",
        className
      )}>
        <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-full shadow-lg border border-yellow-200">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-sm font-medium text-yellow-700">Permission Needed</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPermissionModal(true)}
            className="h-6 w-6 p-0"
          >
            <Mic className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Main Recording Indicator - Bottom Left Corner
  return (
    <div className={cn(
      "fixed bottom-6 left-6 z-40 transition-all duration-300",
      className
    )}>
      {/* Recording Status Indicator */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 bg-white rounded-full shadow-lg border transition-all duration-200",
        isRecording && !isPaused ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
      )}>
        {/* Recording Dot */}
        <div className={cn(
          "w-3 h-3 rounded-full transition-all duration-200",
          isRecording && !isPaused 
            ? isSpeaking 
              ? "bg-red-500 animate-pulse shadow-red-500/50 shadow-lg scale-110" 
              : "bg-red-500 animate-pulse"
            : isPaused 
            ? "bg-yellow-500" 
            : "bg-red-500"
        )} />
        
        {/* Status Text */}
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium transition-colors",
            isRecording && !isPaused 
              ? "text-red-700" 
              : isPaused 
              ? "text-yellow-700" 
              : "text-gray-600"
          )}>
            {isRecording && !isPaused ? "Recording" : 
             isPaused ? "Paused" : 
             "Ready"}
          </span>
          
          {isRecording && (
            <span className="text-xs font-mono text-gray-500">
              {formatDuration(duration)}
            </span>
          )}
        </div>

        {/* Volume Indicator (when speaking) */}
        {isRecording && !isPaused && isSpeaking && (
          <div className="flex items-center gap-1">
            <Volume2 className="h-3 w-3 text-red-600" />
            <div className="w-8 bg-gray-200 rounded-full h-1">
              <div 
                className="bg-red-500 h-1 rounded-full transition-all duration-100"
                style={{ width: `${Math.min(volume, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Debug: Force Start Button (only show when ready but not recording) */}
        {hasPermission && !isRecording && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForceStart}
            className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
            title="Force start recording"
          >
            <Mic className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Optional: Pause/Resume Control (visible on hover) */}
      {isRecording && (
        <div className="absolute -top-12 right-0 opacity-0 hover:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="sm"
            onClick={isPaused ? onResumeRecording : onPauseRecording}
            className="bg-white shadow-lg"
          >
            {isPaused ? "Resume" : "Pause"}
          </Button>
        </div>
      )}
    </div>
  );
} 