import { useState, useRef, useCallback, useEffect } from 'react';
import RecordRTC from 'recordrtc';
import { toast } from 'sonner';

export interface VoiceRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  audioURL: string | null;
  audioBlob: Blob | null;
  duration: number;
  volume: number;
  hasPermission: boolean;
  isRequestingPermission: boolean;
  error: string | null;
  audioLevel: number;
  permissionError: string | null;
}

export interface VoiceRecordingActions {
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
  clearRecording: () => void;
  requestPermission: () => Promise<boolean>;
  autoStartForQuestion: (questionId: string) => Promise<boolean>;
}

export function useVoiceRecording(): VoiceRecordingState & VoiceRecordingActions {
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

  const [isClient, setIsClient] = useState(false);
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Check if we're on the client side and check for existing permissions
  useEffect(() => {
    setIsClient(true);
    
    // Check if we already have permission
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
        if (result.state === 'granted') {
          console.log('🎤 Microphone permission already granted');
          setState(prev => ({ ...prev, hasPermission: true }));
        } else {
          console.log('🎤 Microphone permission not granted:', result.state);
        }
      }).catch(error => {
        console.log('🎤 Could not check microphone permission:', error);
      });
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    if (!isClient) return;
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isClient]);

  // Update duration
  useEffect(() => {
    if (!isClient) return;
    
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
  }, [isClient, state.isRecording, state.isPaused]);

  // Audio level monitoring
  const monitorAudioLevel = useCallback(() => {
    if (!isClient || !analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / bufferLength;
    const volume = Math.min(100, (average / 255) * 100);
    
    setState(prev => ({ ...prev, volume }));
    
    if (state.isRecording && !state.isPaused) {
      animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
    }
  }, [isClient, state.isRecording, state.isPaused]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isClient || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setState(prev => ({ 
        ...prev, 
        error: 'Media devices not available',
        hasPermission: false 
      }));
      return false;
    }
    
    setState(prev => ({ ...prev, isRequestingPermission: true, error: null }));
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      // Test and immediately stop
      stream.getTracks().forEach(track => track.stop());
      
      setState(prev => ({ 
        ...prev, 
        hasPermission: true, 
        isRequestingPermission: false 
      }));
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Microphone access denied';
      setState(prev => ({ 
        ...prev, 
        hasPermission: false, 
        isRequestingPermission: false,
        error: errorMessage
      }));
      if (isClient && typeof toast !== 'undefined') {
        toast.error('Microphone access required for voice tutoring');
      }
      return false;
    }
  }, [isClient]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    console.log('🎤 Attempting to start recording...');
    
    if (!isClient || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      console.log('❌ Media devices not available');
      setState(prev => ({ 
        ...prev, 
        error: 'Media devices not available' 
      }));
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
      
      // Set up audio context for volume monitoring
      if (typeof AudioContext !== 'undefined') {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
      }
      
      // Set up recorder
      if (typeof RecordRTC !== 'undefined') {
        recorderRef.current = new RecordRTC(stream, {
          type: 'audio',
          mimeType: 'audio/wav',
          recorderType: RecordRTC.StereoAudioRecorder,
          sampleRate: 44100,
          numberOfAudioChannels: 1,
        });
        
        recorderRef.current.startRecording();
      }
      
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
      
      console.log('✅ Recording started successfully');
      
      // Start monitoring audio levels
      monitorAudioLevel();
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      console.log('❌ Recording failed:', errorMessage);
      setState(prev => ({ ...prev, error: errorMessage }));
      if (isClient && typeof toast !== 'undefined') {
        toast.error('Failed to start recording: ' + errorMessage);
      }
      return false;
    }
  }, [isClient, monitorAudioLevel]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!isClient) return null;
    
    return new Promise((resolve) => {
      if (!recorderRef.current) {
        resolve(null);
        return;
      }
      
      recorderRef.current.stopRecording(() => {
        const blob = recorderRef.current!.getBlob();
        let url: string | null = null;
        
        if (typeof URL !== 'undefined') {
          url = URL.createObjectURL(blob);
        }
        
        setState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          audioURL: url,
          audioBlob: blob,
          volume: 0
        }));
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        resolve(blob);
      });
    });
  }, [isClient]);

  const pauseRecording = useCallback(() => {
    if (!isClient || !recorderRef.current) return;
    
    recorderRef.current.pauseRecording();
    setState(prev => ({ ...prev, isPaused: true }));
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isClient]);

  const resumeRecording = useCallback(() => {
    if (!isClient || !recorderRef.current) return;
    
    recorderRef.current.resumeRecording();
    setState(prev => ({ ...prev, isPaused: false }));
    
    // Resume monitoring
    monitorAudioLevel();
  }, [isClient, monitorAudioLevel]);

  const resetRecording = useCallback(() => {
    if (!isClient) return;
    
    // Stop any ongoing recording
    if (recorderRef.current && state.isRecording) {
      recorderRef.current.stopRecording();
    }
    
    // Clean up stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Revoke URL if it exists
    if (state.audioURL && typeof URL !== 'undefined') {
      URL.revokeObjectURL(state.audioURL);
    }
    
    recorderRef.current = null;
    analyserRef.current = null;
    startTimeRef.current = null;
    
    setState({
      isRecording: false,
      isPaused: false,
      audioURL: null,
      audioBlob: null,
      duration: 0,
      volume: 0,
      hasPermission: state.hasPermission, // Keep permission status
      isRequestingPermission: false,
      error: null,
      audioLevel: 0,
      permissionError: null,
    });
  }, [isClient, state.audioURL, state.hasPermission]);

  // Auto-start recording for a specific question
  const autoStartForQuestion = useCallback(async (questionId: string): Promise<boolean> => {
    if (!isClient) return false;
    
    // Only auto-start if we have permission and aren't already recording
    if (state.hasPermission && !state.isRecording) {
      console.log(`Auto-starting recording for question: ${questionId}`);
      return await startRecording();
    }
    
    return false;
  }, [isClient, state.hasPermission, state.isRecording, startRecording]);

  // Expose additional property for easier access
  const audioLevel = state.volume;
  const permissionError = state.error;
  const clearRecording = resetRecording;

  return {
    ...state,
    audioLevel,
    permissionError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    clearRecording,
    requestPermission,
    autoStartForQuestion,
  };
} 