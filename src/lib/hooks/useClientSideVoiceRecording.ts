"use client";

import { useEffect, useState } from 'react';
import { useVoiceRecording } from './useVoiceRecording';

// Client-only hook that safely initializes voice recording
export function useClientSideVoiceRecording() {
  const [isMounted, setIsMounted] = useState(false);
  const voiceRecording = useVoiceRecording();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Return null state during SSR, actual state after mount
  if (!isMounted) {
    return {
      isRecording: false,
      isPaused: false,
      audioURL: null,
      audioBlob: null,
      duration: 0,
      volume: 0,
      hasPermission: false,
      isRequestingPermission: false,
      error: null,
      audioLevel: 0,
      permissionError: null,
      startRecording: async () => false,
      stopRecording: async () => null,
      pauseRecording: () => {},
      resumeRecording: () => {},
      resetRecording: () => {},
      clearRecording: () => {},
      requestPermission: async () => false,
      autoStartForQuestion: async () => false,
    };
  }

  return voiceRecording;
} 