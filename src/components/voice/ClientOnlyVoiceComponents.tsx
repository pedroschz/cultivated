"use client";

import { useEffect, useState } from 'react';

// Import the voice components normally
import { AutoVoiceRecorder } from './AutoVoiceRecorder';
import { CompactVoiceConversation } from './CompactVoiceConversation';

interface ClientOnlyAutoVoiceRecorderProps {
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
  autoStart?: boolean;
  questionId?: string;
  className?: string;
}

interface ClientOnlyCompactVoiceConversationProps {
  isOpen: boolean;
  question: {
    question: string;
    options: string[] | string;
    answer: number | string;
    passage?: string;
  };
  userAnswer: string | number;
  thinkingAudio: Blob | null;
  onClose: () => void;
  className?: string;
}

export function ClientOnlyAutoVoiceRecorder(props: ClientOnlyAutoVoiceRecorderProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only render on client after mount and if browser APIs are available
  if (!isMounted || typeof window === 'undefined' || !navigator?.mediaDevices) {
    return null;
  }

  return <AutoVoiceRecorder {...props} />;
}

export function ClientOnlyCompactVoiceConversation(props: ClientOnlyCompactVoiceConversationProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only render on client after mount and if browser APIs are available
  if (!isMounted || typeof window === 'undefined' || !navigator?.mediaDevices) {
    return null;
  }

  return <CompactVoiceConversation {...props} />;
} 