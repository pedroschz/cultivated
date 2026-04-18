"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Defines the state of the voice recording feature, including its status,
 * audio data, and any errors.
 */
export interface VoiceRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  audioURL: string | null;
  audioBlob: Blob | null;
  duration: number; // in milliseconds
  volume: number; // 0-100
  hasPermission: boolean;
  isRequestingPermission: boolean;
  error: string | null;
  audioLevel: number; // Raw audio level from analyser
  permissionError: string | null;
}

/**
 * Defines the actions that can be performed on the voice recording.
 */
export interface VoiceRecordingActions {
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
  clearRecording: () => void;
  requestPermission: () => Promise<boolean>;
  autoStartForQuestion: (questionId: string) => Promise<boolean>;
  releaseResources: () => void;
}

/**
 * @file This file contains a custom React hook for managing voice recording
 * functionality within the application. It encapsulates the logic for handling
 * microphone permissions, recording state, and audio processing, providing
 * a simple interface for use in practice session components.
 */
/**
 * A custom hook for managing voice recording during a practice session.
 * It handles microphone permissions, recording state (start, stop, pause, resume),
 * and provides real-time audio data like duration and volume. This hook is intended
 * for client-side use only and gracefully handles server-side rendering by providing
 * mock functions.
 *
 * @returns An object containing the current `VoiceRecordingState` and `VoiceRecordingActions` to control it.
 */
export function usePracticeVoiceRecording(): VoiceRecordingState & VoiceRecordingActions {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const [state, setState] = useState<VoiceRecordingState>({
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
    });

  const recorderRef = useRef<any | null>(null); // RecordRTC instance
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Check for microphone permission on mount.
  useEffect(() => {
    if (!isMounted) return;
    
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
        if (result.state === 'granted') {
          setState(prev => ({ ...prev, hasPermission: true }));
        }
      });
    }
  }, [isMounted]);

  // Cleanup resources on unmount.
  useEffect(() => {
    if (!isMounted) return;
    
    return () => {
      releaseResources();
    };
  }, [isMounted]);

  // Timer for recording duration.
  useEffect(() => {
    if (!isMounted) return;
    
    let interval: NodeJS.Timeout | null = null;
    if (state.isRecording && !state.isPaused && startTimeRef.current) {
      interval = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Date.now() - startTimeRef.current!
        }));
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMounted, state.isRecording, state.isPaused]);

  /**
   * Monitors the microphone's input volume and updates the state.
   */
  const monitorAudioLevel = useCallback(() => {
    if (!isMounted || !analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / bufferLength;
    const volume = Math.min(100, (average / 255) * 100);
    
    setState(prev => ({ ...prev, volume, audioLevel: average }));
    
    if (state.isRecording && !state.isPaused) {
      animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
    }
  }, [isMounted, state.isRecording, state.isPaused]);

  /**
   * Requests microphone permission from the user.
   * @returns A promise that resolves to true if permission is granted, false otherwise.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isMounted) return false;
    
    setState(prev => ({ ...prev, isRequestingPermission: true, error: null }));
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      stream.getTracks().forEach(track => track.stop());
      setState(prev => ({ ...prev, hasPermission: true, isRequestingPermission: false }));
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Microphone access denied';
      setState(prev => ({ ...prev, hasPermission: false, isRequestingPermission: false, error: errorMessage }));
      if (isMounted) toast.error('Microphone access is required for voice features.');
      return false;
    }
  }, [isMounted]);

  /**
   * Starts the voice recording.
   * @returns A promise that resolves to true if recording starts successfully.
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!isMounted || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setState(prev => ({ ...prev, error: 'Media devices not available' }));
      return false;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      
      if (typeof AudioContext !== 'undefined') {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
      }
      
      const RecordRTC = (await import('recordrtc')).default;
      recorderRef.current = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: RecordRTC.StereoAudioRecorder,
        sampleRate: 44100,
        numberOfAudioChannels: 1,
      });
      
      recorderRef.current.startRecording();
      startTimeRef.current = Date.now();
      
      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
        error: null,
        audioURL: null,
        audioBlob: null
      }));
      
      monitorAudioLevel();
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setState(prev => ({ ...prev, error: errorMessage }));
      if (isMounted) toast.error('Failed to start recording: ' + errorMessage);
      return false;
    }
  }, [isMounted, monitorAudioLevel]);

  /**
   * Stops the voice recording.
   * @returns A promise that resolves to the recorded audio as a Blob, or null.
   */
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!isMounted || !recorderRef.current) return null;
    
    return new Promise((resolve) => {
      recorderRef.current.stopRecording(() => {
        const blob = recorderRef.current!.getBlob();
        const url = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : null;
        
        setState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          audioURL: url,
          audioBlob: blob,
          volume: 0
        }));
        
        releaseResources();
        resolve(blob);
      });
    });
  }, [isMounted]);

  /** Pauses the current recording. */
  const pauseRecording = useCallback(() => {
    if (!isMounted || !recorderRef.current) return;
    
    recorderRef.current.pauseRecording();
    setState(prev => ({ ...prev, isPaused: true }));
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, [isMounted]);

  /** Resumes a paused recording. */
  const resumeRecording = useCallback(() => {
    if (!isMounted || !recorderRef.current) return;
    
    recorderRef.current.resumeRecording();
    setState(prev => ({ ...prev, isPaused: false }));
    monitorAudioLevel();
  }, [isMounted, monitorAudioLevel]);

    /**
     * The initial state for the voice recording hook.
     */
    const initialState: VoiceRecordingState = {
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
    };

  /**
   * Resets the recording state and clears any recorded data.
   */
  const resetRecording = useCallback(() => {
    if (!isMounted) return;
    
    releaseResources();
    if (state.audioURL && typeof URL !== 'undefined') {
      URL.revokeObjectURL(state.audioURL);
    }
    
    setState(prev => ({
      ...initialState,
      hasPermission: prev.hasPermission // Preserve permission state
    }));
  }, [isMounted, state.audioURL, state.hasPermission, initialState]);

  /**
   * Releases all audio resources (microphone stream, audio context).
   */
  const releaseResources = useCallback(() => {
    if (!isMounted) return;
    
    if (recorderRef.current && state.isRecording) {
      recorderRef.current.stopRecording(() => {});
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    recorderRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    animationFrameRef.current = null;
  }, [isMounted, state.isRecording]);

  /**
   * Automatically starts a recording when a new question is displayed.
   * @param questionId - The ID of the question to associate the recording with.
   * @returns A promise that resolves to true if recording started.
   */
  const autoStartForQuestion = useCallback(async (questionId: string): Promise<boolean> => {
    if (!isMounted || !state.hasPermission || state.isRecording) return false;
    return await startRecording();
  }, [isMounted, state.hasPermission, state.isRecording, startRecording]);

  // Fallback for server-side rendering or when the component is not yet mounted.
  if (!isMounted) {
    return {
      ...initialState,
      startRecording: async () => false,
      stopRecording: async () => null,
      pauseRecording: () => {},
      resumeRecording: () => {},
      resetRecording: () => {},
      clearRecording: () => {},
      requestPermission: async () => false,
      autoStartForQuestion: async () => false,
      releaseResources: () => {},
    };
  }

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    clearRecording: resetRecording,
    requestPermission,
    autoStartForQuestion,
    releaseResources,
  };
}
