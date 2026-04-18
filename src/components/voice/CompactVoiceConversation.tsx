/**
 * @file This component manages real-time voice conversation with the Gemini AI tutor.
 * It handles connecting to the Gemini Live service, streaming user audio, playing
 * back AI responses, and managing the conversation context. The component includes
 * audio level monitoring, session management, and a comprehensive UI for the
 * conversation log and audio controls. It provides an interactive tutoring
 * experience with real-time audio streaming and playback.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '@/lib/utils';
import { app, auth } from '@/lib/firebaseClient';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { User } from 'firebase/auth';
import { triggerAiLimitPopup } from '@/lib/ai/usageClient';
import { 
  Bot, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  ArrowRight,
  CheckCircle,
  Pause,
  Play,
  Loader2,
  X,
  Minimize2,
  Maximize2,
  MessageSquare
} from 'lucide-react';
import { geminiSessionManager } from '@/lib/voice/GeminiSessionManager';
import { LatexRenderer } from '@/components/ui/latex';

/**
 * Live model config quick-notes
 *
 * Native Audio (Current):
 * - Model: 'gemini-2.5-flash-native-audio-preview-12-2025'
 * - Config:
 *     responseModalities: [Modality.AUDIO]
 *     systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] }
 *     enableAffectiveDialog: true
 *     speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ... } } }
 *
 * (Previous Half-cascade model 'gemini-live-2.5-flash-preview' is deprecated)
 */

/**
 * Props for the CompactVoiceConversation component.
 */
interface CompactVoiceConversationProps {
  /** Whether the conversation dialog is currently open. */
  isOpen: boolean;
  /** The current question being discussed with the AI tutor. */
  question: {
    question: string;
    options: string[] | string;
    answer: number | string;
    passage?: string;
  };
  /** The user's answer to the current question. */
  userAnswer: string | number;
  /** Audio blob of the user's thinking process (if available). */
  thinkingAudio: Blob | null;
  /** Callback function to close the conversation dialog. */
  onClose: () => void;
  /** Optional CSS class name for styling. */
  className?: string;
  /** Whether the user has already submitted an answer. */
  hasSubmittedAnswer?: boolean;
  /** Comma-separated highlights selected by the user. */
  highlightsCsv?: string;
  /** When this key changes while open, the live session will be restarted. */
  resetKey?: string;
  /** Enable proactive audio so the model only speaks when input is relevant. */
  proactiveAudio?: boolean;
  /** Optional: latest canvas procedure transcript */
  procedureTranscript?: string;
  /** Optional: canvas analysis status */
  procedureStatus?: 'ok' | 'warning';
  /** Callback to switch to text mode */
  onSwitchToText?: () => void;
  /** Visual rendering variant. 'pill' (default) is the floating bottom-left pill; 'panel' is an inline full-area presentation. */
  variant?: 'pill' | 'panel';
}

/**
 * Main component for managing real-time voice conversation with the Gemini AI tutor.
 * Handles audio streaming, session management, and conversation UI.
 */
export function CompactVoiceConversation({
  isOpen,
  question,
  userAnswer,
  thinkingAudio,
  onClose,
  className,
  hasSubmittedAnswer = false,
  highlightsCsv,
  tutorName: preloadedTutorName,
  tutorVoice: preloadedTutorVoice,
  resetKey,
  proactiveAudio = false,
  procedureTranscript,
  procedureStatus,
  onSwitchToText,
  variant = 'pill'
}: CompactVoiceConversationProps & { tutorName?: string; tutorVoice?: string }) {
  // Connection and session state
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Ready to connect');
  const [conversationLog, setConversationLog] = useState<string[]>([]);
  
  // Audio and UI state
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [userName, setUserName] = useState('');
  const [userInterests, setUserInterests] = useState<{role: string, text: string}[]>([]);
  const [tutorName, setTutorName] = useState<string>(preloadedTutorName || 'AI Tutor');

  // Audio processing refs
  const sessionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isStreamingRef = useRef(false);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const receivedFlagsRef = useRef<{ audio: boolean; text: boolean }>({ audio: false, text: false });
  const statusLog = (label: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`🔊 [Voice] ${label}`);
    }
  };
  const setStatusWithLog = (next: string) => {
    setStatus(next);
    statusLog(`Status -> ${next}`);
  };

  /**
   * Resolves the user's first name.
   * Priority:
   * 1) Firestore `users/{uid}.name` (first token)
   * 2) `auth.displayName` (first token)
   * 3) "Student"
   */
  const resolveFirstName = async (): Promise<string> => {
    try {
      const currentUser = auth?.currentUser as User | null;
      if (currentUser && app) {
        // Firestore first: users/{uid}.name
        try {
          const db = getFirestore(app);
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          const nameValue = userDoc.exists() ? (userDoc.data() as any)?.name : undefined;
          if (typeof nameValue === 'string' && nameValue.trim().length > 0) {
            return nameValue.trim().split(' ')[0];
          }
        } catch (e) {
          // Non-fatal; fall back to auth fields
          if (process.env.NODE_ENV === 'development') {
            console.warn('🔧 DEV: Firestore name lookup failed, falling back to auth:', e);
          }
        }

        // Auth displayName
        if (currentUser.displayName && currentUser.displayName.trim().length > 0) {
          return currentUser.displayName.trim().split(' ')[0];
        }
      }
    } catch (_) {
      // Ignore and fall through
    }
    return 'Student';
  };

  useEffect(() => {
    const unsubscribe = auth?.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        const name = await resolveFirstName();
        setUserName(name);
        try {
          if (app) {
            const db = getFirestore(app);
            const ref = doc(db, 'users', user.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
              const d = snap.data() as any;
              const tn = d['tutor-name'];
              if (!preloadedTutorName && tn && tn.trim()) setTutorName(tn.trim());
              if (Array.isArray(d.interests)) setUserInterests(d.interests);
            }
          }
        } catch {}
        if (process.env.NODE_ENV === 'development') {
          console.log('🔧 DEV: UserName set to:', name);
        }
      } else {
        setUserName('Student');
        if (process.env.NODE_ENV === 'development') {
          console.log('🔧 DEV: No user found, setting name to Student.');
        }
      }
    });

    // Also resolve immediately if we already have a currentUser
    if (auth?.currentUser) {
      resolveFirstName().then(setUserName).catch(() => setUserName('Student'));
      (async () => {
        try {
          if (app && auth?.currentUser) {
            const db = getFirestore(app);
            const ref = doc(db, 'users', auth.currentUser.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
              const d = snap.data() as any;
              const tn = d['tutor-name'];
              if (!preloadedTutorName && tn && tn.trim()) setTutorName(tn.trim());
              if (Array.isArray(d.interests)) setUserInterests(d.interests);
            }
          }
        } catch {}
      })();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  /**
   * Adds a timestamped message to the conversation log.
   * @param message - The message to log.
   */
  const logMessage = (message: string) => {
    setConversationLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  /**
   * Starts monitoring audio levels from the microphone for visual feedback.
   * Updates the audio level state and speaking status every 50ms.
   */
  const startAudioLevelMonitoring = () => {
    if (!audioAnalyserRef.current) return;
    
    const dataArray = new Uint8Array(audioAnalyserRef.current.frequencyBinCount);
    
    const updateAudioLevel = () => {
      if (!audioAnalyserRef.current) return;
      
      audioAnalyserRef.current.getByteFrequencyData(dataArray);
      const level = Math.max(...dataArray);
      const normalizedLevel = (level / 255) * 100;
      
      setAudioLevel(normalizedLevel);
      setIsSpeaking(normalizedLevel > 5);
    };
    
    audioLevelIntervalRef.current = setInterval(updateAudioLevel, 50);
  };

  /**
   * Stops audio level monitoring and resets related state.
   */
  const stopAudioLevelMonitoring = () => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    setAudioLevel(0);
    setIsSpeaking(false);
  };

  /**
   * Initializes the audio context and requests microphone access.
   * Sets up audio analysis for level monitoring and returns the media stream.
   * @returns Promise<MediaStream> - The audio stream for recording.
   */
  const initializeAudio = async () => {
    try {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      logMessage('Requesting microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: { ideal: 16000 },
          sampleSize: 16
        }
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found');
      }
      
      logMessage(`Microphone access granted: ${audioTracks[0].label}`);
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;
      
      startAudioLevelMonitoring();
      logMessage('Audio initialized successfully');
      if (process.env.NODE_ENV === 'development') {
        console.debug('🔊 [Voice] AudioContext details:', {
          contextSampleRate: audioContextRef.current?.sampleRate,
          contextState: audioContextRef.current?.state,
          micTrackLabel: audioTracks[0]?.label,
        });
      }
      return stream;
    } catch (error) {
      logMessage(`Audio initialization failed: ${error}`);
      throw error;
    }
  };

  /**
   * Queues audio data for playback and starts processing if not already playing.
   * @param base64Data - Base64 encoded audio data to play.
   */
  const playAudioData = async (base64Data: string) => {
    audioQueueRef.current.push(base64Data);
    if (process.env.NODE_ENV === 'development') {
      console.debug('🔊 [Voice] Queued audio chunk', {
        queueLength: audioQueueRef.current.length,
        base64Length: base64Data?.length,
        isPlaying: isPlayingRef.current,
      });
    }
    if (!isPlayingRef.current) {
      processAudioQueue();
    }
  };

  const processAudioQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    if (process.env.NODE_ENV === 'development') {
      console.debug('🔊 [Voice] Starting audio queue processing', {
        queueLength: audioQueueRef.current.length,
        audioContextState: audioContextRef.current?.state,
        audioContextSampleRate: audioContextRef.current?.sampleRate,
      });
    }

    while (audioQueueRef.current.length > 0) {
      const base64Data = audioQueueRef.current.shift();
      if (base64Data) {
        await playAudioChunk(base64Data);
      }
    }

    isPlayingRef.current = false;
    if (process.env.NODE_ENV === 'development') {
      console.debug('🔊 [Voice] Finished audio queue processing');
    }
  };

  const playAudioChunk = async (base64Data: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (!audioContextRef.current) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('🔊 [Voice] No AudioContext available at playback time');
          }
          resolve();
          return;
        }

        const binaryString = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(binaryString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }

        const int16Array = new Int16Array(arrayBuffer);
        const audioBuffer = audioContextRef.current.createBuffer(1, int16Array.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < int16Array.length; i++) {
          channelData[i] = int16Array[i] / 32768.0;
        }

        if (process.env.NODE_ENV === 'development') {
          console.debug('🔊 [Voice] Prepared PCM chunk for playback', {
            binaryStringLength: binaryString.length,
            int16Samples: int16Array.length,
            durationMs: Math.round((int16Array.length / 24000) * 1000),
            audioContextState: audioContextRef.current.state,
          });
        }

        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().then(() => {
            if (process.env.NODE_ENV === 'development') {
              console.debug('🔊 [Voice] AudioContext resumed for playback');
            }
          }).catch((e) => {
            if (process.env.NODE_ENV === 'development') {
              console.warn('🔊 [Voice] Failed to resume AudioContext:', e);
            }
          });
        }

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
          currentSourceRef.current = null;
          resolve();
        };
        if (process.env.NODE_ENV === 'development') {
          console.debug('🔊 [Voice] Starting chunk playback');
        }
        source.start();
        currentSourceRef.current = source;
      } catch (error) {
        logMessage(`Audio playback error: ${error}`);
        if (process.env.NODE_ENV === 'development') {
          console.error('🔊 [Voice] Audio playback error details:', error);
        }
        reject(error);
      }
    });
  };

  /**
   * Converts an audio blob to PCM format for streaming to the AI service.
   * @param audioBlob - The audio blob to convert.
   * @returns Promise<string> - Base64 encoded PCM data.
   */
  const convertBlobToPCM = async (audioBlob: Blob): Promise<string> => {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const pcmData = new Int16Array(audioBuffer.length);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    const buffer = new ArrayBuffer(pcmData.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(i * 2, pcmData[i], true);
    }
    
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  };

  /**
   * Initiates the AI tutoring session with the Gemini Live service.
   * Sets up the session context, initializes audio, and starts the conversation.
   * This is the main entry point for starting a tutoring session.
   */
  const startTutoringSession = async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 DEV: Starting tutoring session, current state:', {
          hasExistingSession: !!geminiSessionManager.getSession(),
          isSessionActive: geminiSessionManager.isSessionActive(),
          isConnected,
          userName,
          questionId: question?.question?.substring(0, 50) + '...'
        });
      }
      
      setStatusWithLog('Starting tutoring session...');
      logMessage('Starting tutoring session with context...');

      const stream = await initializeAudio();
      if (!stream) {
        throw new Error('Failed to initialize audio');
      }

      // Ensure we have the freshest first name right before building the instruction
      const effectiveName = await resolveFirstName();
      if (effectiveName && effectiveName !== userName) {
        setUserName(effectiveName);
      }

      // Build a safe system instruction (simplified to avoid template parsing issues)
      const optionsText = Array.isArray(question.options)
        ? question.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')
        : String(question.options || '');
      const userAnswerDisplay = Array.isArray(question.options) && typeof userAnswer === 'number'
        ? String.fromCharCode(65 + (userAnswer as number))
        : String(userAnswer || '');
      const correctAnswerDisplay = Array.isArray(question.options) && typeof question.answer === 'number'
        ? String.fromCharCode(65 + (question.answer as number))
        : String(question.answer || '');
      const sectionLine = question.passage ? 'This is a READING AND WRITING question with a passage.' : 'This is a MATH question.';
      const passageText = question.passage ? `\n\nReading Passage:\n${question.passage}` : '';
      const highlightedLine = highlightsCsv && String(highlightsCsv).trim().length > 0
        ? `\nHIGHLIGHTED PARTS (user found important): ${highlightsCsv}`
        : '';
      const procedureLines = procedureTranscript && String(procedureTranscript).trim().length > 0
        ? `\nSTUDENT'S WRITTEN PROCEDURE (from connected canvas):\n${String(procedureTranscript).slice(0, 1400)}${String(procedureTranscript).length > 1400 ? '... [truncated]' : ''}`
        : '';
      const procedureStatusLine = procedureStatus === 'warning'
        ? `\nNote: Canvas analysis suggests the student's current procedure may be off-track. Offer gentle, non-revealing guidance.`
        : '';

      const interestContext = userInterests.length > 0 
        ? `\n\nSTUDENT INTERESTS (Use this to personalize examples/analogies):\n${userInterests.map(i => `${i.role === 'user' ? 'Student' : 'Tutor'}: ${i.text}`).join('\n')}` 
        : '';

      const importanceLine = proactiveAudio
        ? 'IMPORTANT: Proactive audio is enabled. Only speak when the input is relevant to the tutoring session or addressed to you. If the audio is not relevant, remain silent.'
        : 'IMPORTANT: Start speaking immediately when the session begins. Do not wait for the student to speak first.';

      const postAnswerInstruction = [
        `Your name is ${tutorName || 'AI Tutor'}. If the student addresses you by name, acknowledge naturally as ${tutorName || 'AI Tutor'}.`,
        interestContext,
        `You are a world-class, confident SAT expert tutor helping ${effectiveName} who just got a question incorrect. You have extensive knowledge of proven SAT strategies and you speak with authority and confidence about test-taking techniques.`,
        sectionLine,
        '',
        `Question: ${question.question}`,
        passageText,
        '',
        'Answer Choices:',
        optionsText,
        '',
        `Student's Answer: ${userAnswerDisplay}`,
        `Correct Answer: ${correctAnswerDisplay}`,
        '',
        importanceLine,
        '',
        'TUTORING APPROACH:',
        `First start by saying hi/hello (student first name), and immediately start asking questions employing the Socratic method. Do not lose time with introductions (NO "thanks for reaching out" or "I'm here to help you")! Ask guiding questions to help the user identify the error and approach the correct solution. Be assertive, encouraging, and keep responses under 30 seconds. Address the student by first name (${effectiveName}) explicitly in your response. Avoid saying "mistake" or "wrong"; focus on correct approach. Ask if your explanation makes sense.`,
        highlightedLine,
        procedureLines,
        procedureStatusLine,
        '',
        'Start immediately with confidence, tutor straight to the point. Mimic the user tone, if they are excited, be excited. If they are nervous, be nervous. If they are unimpressed, be unimpressed.'
      ].filter(Boolean).join('\n');
      const preAnswerInstruction = [
        `Your name is ${tutorName || 'AI Tutor'}. If the student addresses you by name, acknowledge naturally as ${tutorName || 'AI Tutor'}.`,
        interestContext,
        `You are a world-class SAT tutor guiding ${effectiveName} BEFORE they have chosen an answer. Use only Socratic questions. You do NOT have the correct answer in your context and must not reveal or deduce it. Avoid giving direct hints that overly narrow choices or reveal solution steps. If the student asks for more tips that would give away too much, respond: "I can't help with that. Let's think it through with a question instead." Keep responses under 20 seconds and ask short, guiding questions.`,
        sectionLine,
        '',
        `Question: ${question.question}`,
        passageText,
        '',
        'Answer Choices:',
        optionsText,
        highlightedLine,
        procedureLines,
        procedureStatusLine,
        '',
        `Begin now with one short Socratic question about how to start thinking about this, and address the student by first name (${effectiveName}). Until you feel the student knows the correct answer, keep asking questions. If they do, say "Great! Do you want to take it from here?". Mimic the user tone, if they are excited, be excited. If they are nervous, be nervous. If they are unimpressed, be unimpressed.`
      ].filter(Boolean).join('\n');
      const systemInstruction = hasSubmittedAnswer ? postAnswerInstruction : preAnswerInstruction;

      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 DEV: System instruction created with name:', effectiveName);
        console.log('🔧 DEV: System instruction preview:', systemInstruction.substring(0, 200) + '...');
      }

      // The Modality enum needs to be imported to be used in the config
      const { Modality } = await import('@google/genai');

      const config: any = {
        responseModalities: [Modality.AUDIO],
        // Use the correct system instruction key
        systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
        enableAffectiveDialog: true,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: preloadedTutorVoice || 'Rasalgethi' }
          }
        },
      };
      if (proactiveAudio) {
        config.proactivity = { proactiveAudio: true };
      }

      if (process.env.NODE_ENV === 'development') {
        console.debug('🔊 [Voice] Live config prepared', {
          hasSystemInstruction: !!systemInstruction,
          systemInstructionLength: systemInstruction?.length,
          responseModalities: ['AUDIO'],
          // responseMIMEType: 'audio/pcm;rate=24000',
        });
      }

      // Reserve a voice slot (enforces cap, records usage)
      let voiceApiKey: string | undefined;
      try {
        const fns = getFunctions(app as any, 'us-central1');
        const reserve = httpsCallable(fns, 'reserveVoiceSession');
        const res = await reserve();
        if ((res.data as any)?.byok) {
          const currentUser = auth?.currentUser;
          if (currentUser) {
            const db = getFirestore(app as any);
            const snap = await getDoc(doc(db, 'users', currentUser.uid));
            voiceApiKey = snap.data()?.geminiApiKey || undefined;
          }
        }
      } catch (err: any) {
        if (err?.code === 'functions/resource-exhausted' || err?.message?.includes?.('AI_LIMIT_REACHED')) {
          triggerAiLimitPopup();
          return;
        }
        throw err;
      }

      logMessage('Creating Gemini Live tutoring session...');
      
      const session = await geminiSessionManager.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: config,
        apiKey: voiceApiKey,
        callbacks: {
          onopen: async () => {
            logMessage('Connected to Gemini Live for tutoring!');
            if (process.env.NODE_ENV === 'development') {
              console.debug('🔊 [Voice] onopen');
            }
            setIsConnected(true);
            setStatusWithLog('Connected - Sending context...');
            
            logMessage('No thinking audio available, starting conversation directly');
            // Start streaming first, then trigger the AI to begin speaking
            startContinuousAudioStreaming(stream);
            setStatusWithLog('Tutoring session active - AI will begin shortly...');
            
            // Give a moment for streaming to be established, then trigger AI to start
            setTimeout(async () => {
              if (proactiveAudio) {
                // With proactive audio enabled, avoid forcing an opening turn.
                // The model will begin speaking only if the input is relevant.
                setStatusWithLog('Tutoring session active - awaiting relevant input...');
              } else {
                // Kick off the conversation proactively (old behavior)
                await session.sendClientContent({
                  turns: [{
                    role: 'user',
                    parts: [{ text: hasSubmittedAnswer ? 'Please start the tutoring session now and help me understand my mistake.' : 'Please start by asking me a Socratic question. Don’t reveal the answer or give strong hints.' }]
                  }],
                  turnComplete: true
                });
                setStatusWithLog('AI Tutor is speaking...');
              }
              // Watchdog note after 5s
              setTimeout(() => {
                if (!receivedFlagsRef.current.audio) {
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('🔊 [Voice] No audio received within 5s of starting.');
                  }
                  logMessage(proactiveAudio ? 'No audio received yet (proactive mode).' : 'No audio received yet...');
                }
              }, 5000);
            }, 500);
          },
          
          onmessage: (message: any) => {
            // Attempt to extract base64 audio from multiple possible shapes
            const audioBase64 =
              message?.data ||
              message?.audio?.data ||
              message?.inlineData?.data;

            if (process.env.NODE_ENV === 'development') {
              const keys = Object.keys(message || {});
              console.debug('🔊 [Voice] onmessage keys:', keys);
              if (message?.serverContent?.modelTurn?.parts) {
                const parts = message.serverContent.modelTurn.parts;
                try {
                  const mimeTypes = parts.map((p: any) => p?.inlineData?.mimeType || p?.mimeType).filter(Boolean);
                  console.debug('🔊 [Voice] modelTurn parts mimeTypes:', mimeTypes);
                } catch {}
              }
            }

            if (audioBase64) {
              receivedFlagsRef.current.audio = true;
              logMessage(`Received tutoring audio: ${audioBase64.length} characters`);
            } else if (message?.text) {
              receivedFlagsRef.current.text = true;
              logMessage(`Received tutoring text: ${message.text}`);
            } else {
              // Fallback: log keys for debugging
              try {
                const keys = Object.keys(message || {});
                logMessage(`Received tutoring message with keys: ${keys.join(', ')}`);
              } catch {
                logMessage('Received tutoring message');
              }
            }

            if (message.setupComplete) {
              logMessage('Tutoring setup completed successfully');
            }

            if (message.serverContent?.interrupted) {
              logMessage('Tutoring interrupted - clearing audio queue');
              if (currentSourceRef.current) {
                currentSourceRef.current.stop();
                currentSourceRef.current = null;
              }
              audioQueueRef.current = [];
              isPlayingRef.current = false;
            }

            if (message.serverContent?.turnComplete) {
              logMessage('Tutor finished speaking');
            }

            if (audioBase64) {
              playAudioData(audioBase64);
            }

            if (message.text) {
              logMessage(`Tutor text: ${message.text}`);
            }
          },
          
          onerror: (error: any) => {
            logMessage(`Tutoring connection error: ${error.message || error}`);
            if (process.env.NODE_ENV === 'development') {
              console.error('🔊 [Voice] onerror:', error);
            }
            setIsConnected(false);
            setStatusWithLog('Tutoring error occurred');
          },
          
          onclose: (event: any) => {
            logMessage(`Tutoring connection closed: ${event.reason || 'Unknown reason'}`);
            if (process.env.NODE_ENV === 'development') {
              console.debug('🔊 [Voice] onclose:', event?.code, event?.reason);
            }
            setIsConnected(false);
            setStatusWithLog('Tutoring session ended');
            isStreamingRef.current = false;
          }
        }
      });

      sessionRef.current = session;
      logMessage(`Tutoring session assigned: sessionRef.current exists = ${!!sessionRef.current}`);
      if (process.env.NODE_ENV === 'development') {
        console.debug('🔊 [Voice] Session object keys:', Object.keys(session || {}));
      }

    } catch (error) {
      logMessage(`Failed to start tutoring session: ${error}`);
      setStatus('Failed to start tutoring');
      setIsConnected(false);
    }
  };

  const startContinuousAudioStreaming = (stream: MediaStream) => {
    try {
      isStreamingRef.current = true;
      logMessage('Setting up direct PCM audio streaming...');
      
      const audioTracks = stream.getAudioTracks();
      logMessage(`Stream has ${audioTracks.length} audio tracks`);
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      let chunkCount = 0;
      
      processor.onaudioprocess = async (event) => {
        if (!isStreamingRef.current || !sessionRef.current) return;
        
        chunkCount++;
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        const buffer = new ArrayBuffer(pcmData.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcmData.length; i++) {
          view.setInt16(i * 2, pcmData[i], true);
        }
        
        const base64PCM = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        
        try {
          logMessage(`Sending PCM audio chunk ${chunkCount} (${base64PCM.length} chars)`);
          
          sessionRef.current.sendRealtimeInput({
            audio: {
              data: base64PCM,
              mimeType: "audio/pcm;rate=16000"
            }
          });
          
          logMessage(`PCM audio chunk ${chunkCount} sent successfully`);
        } catch (error) {
          logMessage(`Audio sending error: ${error}`);
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      logMessage('Direct PCM audio streaming started successfully');
      audioContextRef.current = audioContext;
      
    } catch (error) {
      logMessage(`Failed to start audio streaming: ${error}`);
    }
  };

  const stopVoiceSession = () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 DEV: Stopping voice session, current session state:', {
          hasSession: !!geminiSessionManager.getSession(),
          isActive: geminiSessionManager.isSessionActive(),
          isStreaming: isStreamingRef.current,
          isConnected
        });
      }
      
      isStreamingRef.current = false;
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      stopAudioLevelMonitoring();
      
      // Stop any currently playing audio
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
          currentSourceRef.current = null;
        } catch (error) {
          console.log('Error stopping audio source:', error);
        }
      }
      
      // Use the session manager to close the session
      geminiSessionManager.close();
      sessionRef.current = null;
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      setIsConnected(false);
      setStatus('Disconnected');
      logMessage('Voice session stopped');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 DEV: Voice session cleanup completed');
      }
    } catch (error) {
      logMessage(`Error stopping session: ${error}`);
      if (process.env.NODE_ENV === 'development') {
        console.error('🔧 DEV: Error during voice session cleanup:', error);
        // Force reset in development mode if there's an error
        geminiSessionManager.forceReset();
      }
    }
  };

  // Auto-start and cleanup of the tutoring session. Also restart when resetKey changes
  useEffect(() => {
    let mounted = true;
    
    if (isOpen && mounted) {
      // Small delay to prevent rapid reconnections in development
      const timeoutId = setTimeout(() => {
        if (mounted) {
          startTutoringSession();
        }
      }, process.env.NODE_ENV === 'development' ? 100 : 0);
      
      return () => {
        mounted = false;
        clearTimeout(timeoutId);
        stopVoiceSession();
      };
    }

    return () => {
      mounted = false;
      stopVoiceSession();
    };
  }, [isOpen, resetKey]);

  if (!isOpen) {
    return null;
  }

  // Inline panel variant - designed to fill a parent container (e.g. the TutorSidebar body)
  if (variant === 'panel') {
    const isAiSpeaking = isPlayingRef.current;
    const statusLabel = !isConnected
      ? status || 'Connecting…'
      : isAiSpeaking
        ? 'Speaking'
        : isSpeaking
          ? 'Listening'
          : 'Ready';
    const barMultipliers = [0.55, 0.8, 1.0, 1.15, 1.0, 0.8, 0.55];
    return (
      <div className={cn("flex flex-col h-full w-full bg-white dark:bg-card", className)}>
        <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6">
          {/* Orb */}
          <div className="relative">
            <div
              className={cn(
                "absolute inset-0 rounded-full bg-[#93d333]/25 blur-2xl transition-transform duration-200",
                (isAiSpeaking || isSpeaking) && "animate-pulse"
              )}
              style={{ transform: `scale(${1 + Math.min(audioLevel, 60) / 120})` }}
            />
            <div
              className="relative w-24 h-24 rounded-full bg-[#93d333] flex items-center justify-center shadow-md transition-transform duration-150"
              style={{ transform: `scale(${1 + (isAiSpeaking ? 0.04 : 0) + Math.min(audioLevel, 60) / 600})` }}
            >
              <Bot className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Status */}
          <div className="text-center space-y-1">
            <div className="font-bold text-base text-[#4B4B4B] dark:text-foreground">{tutorName || 'AI Tutor'}</div>
            <div
              className={cn(
                "text-xs font-semibold tracking-wide uppercase",
                !isConnected
                  ? "text-[#AFAFAF] dark:text-muted-foreground"
                  : isAiSpeaking
                    ? "text-[#93d333]"
                    : isSpeaking
                      ? "text-[#1cb0f6]"
                      : "text-[#AFAFAF] dark:text-muted-foreground"
              )}
            >
              {statusLabel}
            </div>
          </div>

          {/* Audio-reactive bars */}
          <div className="flex items-end gap-1.5 h-12">
            {barMultipliers.map((mult, i) => {
              const active = isAiSpeaking || isSpeaking;
              const level = Math.max(6, Math.min(48, 6 + audioLevel * 0.4 * mult));
              return (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 rounded-full transition-all duration-150",
                    active ? "bg-[#93d333]" : "bg-[#E5E5E5] dark:bg-border"
                  )}
                  style={{ height: `${active ? level : 6}px` }}
                />
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="shrink-0 px-6 pb-6 flex items-center justify-center gap-2">
          {onSwitchToText && (
            <Button
              type="button"
              variant="outline"
              onClick={onSwitchToText}
              className="rounded-full border-2 border-[#E5E5E5] dark:border-border border-b-4 active:translate-y-[2px] active:border-b-0 h-10 px-4 text-[#4B4B4B] dark:text-foreground bg-white dark:bg-card hover:bg-[#F7F7F7] dark:hover:bg-muted/50"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="text-xs font-semibold">Text chat</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-full border-2 border-[#E5E5E5] dark:border-border border-b-4 active:translate-y-[2px] active:border-b-0 h-10 w-10 p-0 text-[#AFAFAF] dark:text-muted-foreground bg-white dark:bg-card hover:bg-[#F7F7F7] dark:hover:bg-muted/50"
            title="End voice session"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Compact view - bottom right corner
  if (!isExpanded) {
    return (
      <div className={cn(
        "fixed bottom-6 left-6 z-50 transition-all duration-300",
        className
      )}>
        <div className="flex items-center gap-3 px-4 py-3 bg-card text-card-foreground rounded-full shadow-lg border border-border">
          {/* AI Avatar with Animation */}
          <div className={cn(
            "w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center transition-all duration-200",
            isPlayingRef.current && "animate-pulse bg-blue-200"
          )}>
            <Bot className="h-4 w-4 text-blue-600" />
          </div>
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-700">{tutorName || 'AI Tutor'}</span>
            {isConnected && (
              <div className={cn(
                "w-2 h-2 rounded-full",
                isSpeaking ? "bg-green-500 animate-pulse" : 
                isPlayingRef.current ? "bg-blue-500 animate-pulse" :
                "bg-green-500"
              )} />
            )}
          </div>

          {/* Volume Animation when AI is speaking */}
          {isPlayingRef.current && (
            <div className="flex items-center gap-1">
              <div className="flex space-x-1">
                <div className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                <div className="w-1 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
              </div>
            </div>
          )}

          {/* Expand removed: pill-only mode */}

          {onSwitchToText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSwitchToText}
              className="h-8 w-8 p-0"
              title="Switch to Text Chat"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
          
          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>


      </div>
    );
  }
}