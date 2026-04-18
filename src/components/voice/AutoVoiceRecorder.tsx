import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Mic, 
  MicOff, 
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/button';

/**
 * @file This component provides automatic voice recording functionality for the AI tutor.
 * It handles microphone permissions, automatic recording start/stop based on question changes,
 * and displays a minimal recording indicator. The component is designed to work seamlessly
 * in the background without requiring manual user interaction.
 */

/**
 * Props for the AutoVoiceRecorder component.
 */
interface AutoVoiceRecorderProps {
  /** Whether recording is currently active. */
  isRecording: boolean;
  /** Current recording duration in milliseconds. */
  duration: number;
  /** Current audio volume level (0-100). */
  volume: number;
  /** Whether microphone permission has been granted. */
  hasPermission: boolean;
  /** Whether permission is currently being requested. */
  isRequestingPermission: boolean;
  /** Error message if permission request failed. */
  error: string | null;
  /** Callback function to start recording. */
  onStartRecording: () => Promise<boolean>;
  /** Callback function to request microphone permission. */
  onRequestPermission: () => Promise<boolean>;
  /** Additional CSS classes for styling. */
  className?: string;
  /** Whether to automatically start recording when a new question is loaded. */
  autoStart?: boolean; 
  /** The current question ID to trigger automatic recording. */
  questionId?: string; 
}

/**
 * A component that provides automatic voice recording for AI tutoring.
 * It handles permissions, automatically starts/stops recording based on question changes,
 * and displays a minimal recording indicator.
 * 
 * @param isRecording - Whether recording is currently active.
 * @param duration - Current recording duration in milliseconds.
 * @param volume - Current audio volume level (0-100).
 * @param hasPermission - Whether microphone permission has been granted.
 * @param isRequestingPermission - Whether permission is currently being requested.
 * @param error - Error message if permission request failed.
 * @param onStartRecording - Callback function to start recording.
 * @param onRequestPermission - Callback function to request microphone permission.
 * @param className - Additional CSS classes for styling.
 * @param autoStart - Whether to automatically start recording when a new question is loaded.
 * @param questionId - The current question ID to trigger automatic recording.
 * @returns A React component with automatic voice recording functionality.
 */
export function AutoVoiceRecorder({
  isRecording,
  duration,
  volume,
  hasPermission,
  isRequestingPermission,
  error,
  onStartRecording,
  onRequestPermission,
  className,
  autoStart = true,
  questionId
}: AutoVoiceRecorderProps) {
  // State for permission modal and speaking detection
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Refs for tracking question changes and initialization
  const previousQuestionId = useRef<string | undefined>(questionId);
  const hasTriedPermission = useRef(false);
  const isInitialized = useRef(false);

  /**
   * Formats duration from milliseconds to MM:SS format.
   * @param ms - Duration in milliseconds.
   * @returns Formatted duration string.
   */
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Effect to detect when user is speaking based on volume
  useEffect(() => {
    setIsSpeaking(volume > 5);
  }, [volume]);

  // Effect to handle initial permission request
  useEffect(() => {
    if (!isInitialized.current && autoStart && !hasPermission && !isRequestingPermission) {
      isInitialized.current = true;
      onRequestPermission().then(granted => {
        if (!granted && !hasTriedPermission.current) {
          hasTriedPermission.current = true;
          setShowPermissionModal(true);
        }
      });
    }
  }, [autoStart, hasPermission, isRequestingPermission, onRequestPermission]);

  // Effect to automatically start recording when question changes
  useEffect(() => {
    if (questionId && 
        questionId !== previousQuestionId.current && 
        hasPermission && 
        autoStart && 
        !isRecording) {
      
      setTimeout(() => {
        onStartRecording();
      }, 100);
      
      previousQuestionId.current = questionId;
    } else if (questionId && questionId !== previousQuestionId.current) {
      previousQuestionId.current = questionId;
    }
  }, [questionId, hasPermission, autoStart, isRecording, onStartRecording]);

  /**
   * Handles the permission request from the modal.
   */
  const handlePermissionRequest = async () => {
    const granted = await onRequestPermission();
    if (granted) {
      setShowPermissionModal(false);
      if (questionId && autoStart) {
        setTimeout(() => {
          onStartRecording();
        }, 200);
      }
    }
  };

  // Permission request modal
  if (showPermissionModal && !hasPermission) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-background rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <Mic className="h-6 w-6 text-primary" />
            <h3 className="text-lg font-semibold">Enable Voice Recording</h3>
          </div>
          
          <div className="space-y-4">
            {/* Explanation of automatic recording */}
            <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-primary-foreground">Automatic Voice Recording</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We'll automatically record your thinking process as you work through questions. 
                  This helps our AI provide better tutoring when you get answers wrong.
                </p>
              </div>
            </div>
            
            {/* Error display if permission request failed */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive-foreground">Permission Error</p>
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button 
                onClick={handlePermissionRequest}
                disabled={isRequestingPermission}
                className="flex-1"
              >
                {isRequestingPermission ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
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

            <p className="text-xs text-muted-foreground text-center">
              Recording is automatically handled - no manual controls needed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render anything if permission is not granted yet
  if (!hasPermission) {
    return null; // Don't show anything if permission is not granted yet, modal will handle it
  }

  // Minimal recording indicator
  return (
    <div className={cn(
      "fixed bottom-6 left-6 z-40 transition-all duration-300",
      className
    )}>
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 bg-background rounded-full shadow-lg border transition-all duration-200",
        isRecording ? "border-destructive" : "border-border"
      )}>
        {/* Recording status indicator */}
        <div className={cn(
          "w-3 h-3 rounded-full transition-all duration-200",
          isRecording 
            ? isSpeaking 
              ? "bg-destructive animate-pulse shadow-red-500/50 shadow-lg scale-110" 
              : "bg-destructive animate-pulse"
            : "bg-muted-foreground"
        )} />
        
        {/* Duration display */}
        <span className="text-sm font-mono font-medium text-muted-foreground w-12">
          {isRecording ? formatDuration(duration) : '...'}
        </span>

        {/* Microphone off icon when not recording */}
        {!isRecording && hasPermission && (
          <MicOff className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
} 