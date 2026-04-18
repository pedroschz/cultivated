"use client";

import { useEffect, useState } from 'react';

// Import the voice components normally
import { AutoVoiceRecorder } from './AutoVoiceRecorder';
import { CompactVoiceConversation } from './CompactVoiceConversation';
import { CompactTextConversation } from '../chat/CompactTextConversation';

/**
 * @file This file provides client-only wrapper components for voice-related features.
 * These components ensure that voice functionality only renders on the client side
 * where browser APIs like navigator.mediaDevices are available, preventing
 * server-side rendering errors.
 */

/**
 * Props for the ClientOnlyAutoVoiceRecorder component.
 * Mirrors the props of AutoVoiceRecorder with additional client-side checks.
 */
interface ClientOnlyAutoVoiceRecorderProps {
  /** Whether recording is currently active. */
  isRecording: boolean;
  /** Whether recording is currently paused. */
  isPaused: boolean;
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
  /** Callback function to stop recording. */
  onStopRecording: () => Promise<Blob | null>;
  /** Callback function to pause recording. */
  onPauseRecording: () => void;
  /** Callback function to resume recording. */
  onResumeRecording: () => void;
  /** Callback function to request microphone permission. */
  onRequestPermission: () => Promise<boolean>;
  /** Whether to automatically start recording when a new question is loaded. */
  autoStart?: boolean;
  /** The current question ID to trigger automatic recording. */
  questionId?: string;
  /** Additional CSS classes for styling. */
  className?: string;
}

/**
 * Props for the ClientOnlyCompactVoiceConversation component.
 * Mirrors the props of CompactVoiceConversation with additional client-side checks.
 */
interface ClientOnlyCompactVoiceConversationProps {
  /** Whether the conversation dialog is open. */
  isOpen: boolean;
  /** The current question data. */
  question: {
    question: string;
    options: string[] | string;
    answer: number | string;
    passage?: string;
  };
  /** The user's answer to the question. */
  userAnswer: string | number;
  /** The recorded thinking audio blob. */
  thinkingAudio: Blob | null;
  /** Callback function to close the conversation dialog. */
  onClose: () => void;
  /** Additional CSS classes for styling. */
  className?: string;
  /** Whether the user has already submitted an answer. */
  hasSubmittedAnswer?: boolean;
  /** Comma-separated highlights selected by the user. */
  highlightsCsv?: string;
  /** Preloaded tutor name to avoid flicker when opening UI. */
  tutorName?: string;
  /** Preloaded tutor voice to avoid flicker and match Live voice. */
  tutorVoice?: string;
  /** When this key changes while open, the live session will be restarted. */
  resetKey?: string;
  /** Enable proactive audio so the model only speaks when input is relevant. */
  proactiveAudio?: boolean;
  /** Latest canvas procedure transcript */
  procedureTranscript?: string;
  /** Canvas analysis status */
  procedureStatus?: 'ok' | 'warning';
}

/**
 * A client-only wrapper for the AutoVoiceRecorder component.
 * Ensures the component only renders on the client side where browser APIs
 * like navigator.mediaDevices are available.
 * 
 * @param props - All props for the AutoVoiceRecorder component.
 * @returns The AutoVoiceRecorder component or null if not on client.
 */
export function ClientOnlyAutoVoiceRecorder(props: ClientOnlyAutoVoiceRecorderProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Mark as mounted after initial render
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only render on client after mount and if browser APIs are available
  if (!isMounted || typeof window === 'undefined' || !navigator?.mediaDevices) {
    return null;
  }

  return <AutoVoiceRecorder {...props} />;
}

/**
 * A client-only wrapper for the CompactVoiceConversation component.
 * Ensures the component only renders on the client side where browser APIs
 * like navigator.mediaDevices are available.
 * 
 * @param props - All props for the CompactVoiceConversation component.
 * @returns The CompactVoiceConversation component or null if not on client.
 */
export function ClientOnlyCompactVoiceConversation(props: ClientOnlyCompactVoiceConversationProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');

  // Mark as mounted after initial render
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only render on client after mount and if browser APIs are available
  if (!isMounted || typeof window === 'undefined' || !navigator?.mediaDevices) {
    return null;
  }

  if (mode === 'text') {
    return (
      <CompactTextConversation 
        {...props} 
        onSwitchToVoice={() => setMode('voice')} 
      />
    );
  }

  return (
    <CompactVoiceConversation 
      {...props} 
      onSwitchToText={() => setMode('text')}
    />
  );
} 