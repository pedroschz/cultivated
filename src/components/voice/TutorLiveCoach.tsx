"use client";
/*
  TutorLiveCoach – Live model config quick-notes

  Native Audio (Current):
  - Model: 'gemini-2.5-flash-native-audio-preview-12-2025'
  - Config:
      responseModalities: [Modality.AUDIO]
      systemInstruction: { role: 'system', parts: [{ text: sys }] }
      enableAffectiveDialog: true
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ... } } }

  (Previous Half-cascade model 'gemini-live-2.5-flash-preview' is deprecated)
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adaptiveLearningService } from '@/lib/adaptive-learning/adaptive-service';
import { app, auth } from '@/lib/firebaseClient';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { geminiSessionManager } from '@/lib/voice/GeminiSessionManager';
import { triggerAiLimitPopup } from '@/lib/ai/usageClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Loader2, Mic, MicOff, Play, StopCircle } from 'lucide-react';
 

type Insights = Awaited<ReturnType<typeof adaptiveLearningService.getLearningInsights>>;

interface TutorLiveCoachProps {
  userId: string;
  displayName: string;
  tutorName?: string;
  tutorVoice?: string;
  className?: string;
  autoStart?: boolean;
}

//

export function TutorLiveCoach({ userId, displayName, tutorName, tutorVoice, className, autoStart = false }: TutorLiveCoachProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [statusText, setStatusText] = useState<string>('Ready');
  const [aiLevel, setAiLevel] = useState<number>(0);
  const [log, setLog] = useState<string[]>([]);
  const [blobShape, setBlobShape] = useState<{ tl: number; tr: number; br: number; bl: number; rot: number; skewX: number; skewY: number; scale: number }>({ tl: 50, tr: 50, br: 50, bl: 50, rot: 0, skewX: 0, skewY: 0, scale: 1 });
  type TranscriptEntry = { id: string; role: 'assistant' | 'user'; text: string; createdAt: number };
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [notes, setNotes] = useState<Array<{ id: string; text: string; createdAt: number }>>([]);
  const [userInterests, setUserInterests] = useState<{role: string, text: string}[]>([]);
  const deleteNote = useCallback(async (noteId: string) => {
    try {
      if (!app) return;
      const db = getFirestore(app);
      const userRef = doc(db, 'users', userId);
      // Optimistic UI update
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      // Remove by re-writing array (arrayRemove is tricky for objects without exact match)
      const snap = await getDoc(userRef);
      const data = snap.exists() ? (snap.data() as any) : {};
      const list = Array.isArray(data?.tutorNotes) ? data.tutorNotes : [];
      const next = list.filter((n: any) => String(n?.id) !== String(noteId));
      await updateDoc(userRef, { tutorNotes: next });
      console.log('[Notes] Deleted note id=', noteId);
    } catch (e) {
      console.warn('[Notes] Failed to delete note id=', noteId, e);
    }
  }, [userId]);

  const sessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const playbackClockRef = useRef<number>(0);
  const aiSpeakingRef = useRef<boolean>(false);
  const aiSpeakTimerRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);
  type QueuedChunk = { data: string; rate: number };
  const audioQueueRef = useRef<QueuedChunk[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const receivedFlagsRef = useRef<{ audio: boolean; text: boolean }>({ audio: false, text: false });
  const lastKnownSampleRateRef = useRef<number>(24000);
  const assistantPcmChunksRef = useRef<Int16Array[]>([]);
  const userPcmChunksRef = useRef<Int16Array[]>([]);
  const sessionStartMsRef = useRef<number>(0);
  const assistantSegsRef = useRef<Array<{ tMs: number; pcm16k: Int16Array }>>([]);
  const userSegsRef = useRef<Array<{ tMs: number; pcm16k: Int16Array }>>([]);

  // Removed chunked transcript ordering; transcripts are only sent on session stop

  // Removed chunk flushers; we only send final transcripts on stop

  const [ctxLoading, setCtxLoading] = useState(true);
  const [contextSummary, setContextSummary] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setCtxLoading(true);
        const data = await adaptiveLearningService.getUserAdaptiveLearningData(userId);
        const insights = await adaptiveLearningService.getLearningInsights(userId);
        if (cancelled) return;
        const overall = Math.round(data?.overallCompetency || 0);
        const totalQuestionsAnswered = data?.totalQuestionsAnswered || 0;
        const totalTimeSpentSeconds = data?.totalTimeSpent || 0;
        const topStrengthSkills = insights.strengths.map(s => s.subdomainName).slice(0, 6);
        const topWeaknessSkills = insights.weaknesses.map(s => s.subdomainName).slice(0, 6);
        const priorityImprovementAreas = insights.improvementAreas.map(i => `${i.subdomainName}: ${i.reason}`).slice(0, 6);
        const domainAverages: Record<string, number> = {};
        if (data?.domainSummaries) {
          Object.keys(data.domainSummaries).forEach(k => {
            domainAverages[k] = Math.round(data.domainSummaries[k].averageCompetency);
          });
        }
        setContextSummary({ overallCompetency: overall, totalQuestionsAnswered, totalTimeSpentSeconds, topStrengthSkills, topWeaknessSkills, priorityImprovementAreas, domainAverages });
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [userId]);

  // Note-taking API removed for rebuild

  const logMsg = useCallback((m: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${m}`].slice(-100));
  }, []);

  // Load existing tutor notes on mount
  useEffect(() => {
    (async () => {
      try {
        if (!app || !userId) return;
        const db = getFirestore(app);
        const ref = doc(db, 'users', userId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const list = Array.isArray(data?.tutorNotes) ? data.tutorNotes : [];
        const normalized = list
          .filter((n: any) => n && typeof n.text === 'string')
          .map((n: any) => ({ id: String(n.id), text: String(n.text), createdAt: Number(n.createdAt || Date.now()) }))
          .sort((a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt)
          .slice(0, 100);
        setNotes(normalized);
        if (Array.isArray(data.interests)) {
          setUserInterests(data.interests);
        }
        console.log(`[Notes] Loaded ${normalized.length} existing notes from Firestore`);
      } catch {}
    })();
  }, [userId]);

  const appendAssistantTranscript = useCallback((text: string) => {
    if (!text || !text.trim()) return;
    const entry: TranscriptEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'assistant',
      text: text.trim(),
      createdAt: Date.now(),
    };
    setTranscript((prev) => [...prev, entry].slice(-500));
  }, []);

  const ensureInputAudio = useCallback(async () => {
    const ctx = new AudioContext({ sampleRate: 16000 });
    inputAudioContextRef.current = ctx;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: { ideal: 16000 }, sampleSize: 16 },
    });
    micStreamRef.current = stream;
    return { ctx, stream };
  }, []);

  const playAIChunk = useCallback(async (base64Data: string, sampleRate: number) => {
    return new Promise<void>(async (resolve) => {
      try {
        // Use device-default output context; WebAudio handles resampling smoothly
        if (!outputAudioContextRef.current) {
          outputAudioContextRef.current = new AudioContext({ latencyHint: 'playback' });
          outputGainRef.current = outputAudioContextRef.current.createGain();
          outputGainRef.current.gain.value = 1.0;
          outputGainRef.current.connect(outputAudioContextRef.current.destination);
        }
        const ctx = outputAudioContextRef.current!;
        const binaryString = atob(base64Data);
        const byteLength = binaryString.length;
        const arrayBuffer = new ArrayBuffer(byteLength);
        const bytes = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteLength; i++) bytes[i] = binaryString.charCodeAt(i) & 0xff;

        // Decode 16-bit PCM into both Float32 (for playback) and Int16 (for transcript accumulation)
        const view = new DataView(arrayBuffer);
        const sampleCount = Math.floor(byteLength / 2);
        const float32 = new Float32Array(sampleCount);
        const int16 = new Int16Array(sampleCount);
        let sumSq = 0;
        for (let i = 0; i < sampleCount; i++) {
          const s = view.getInt16(i * 2, true);
          int16[i] = s;
          const v = Math.max(-1, Math.min(1, s / 32768));
          float32[i] = v;
          sumSq += v * v;
        }
        // Accumulate AI audio (legacy)
        assistantPcmChunksRef.current.push(int16);
        // Store 16kHz segment with relative timestamp for unified transcript
        try {
          const startMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - (sessionStartMsRef.current || 0);
          const pcm16k = resampleFloatTo16k(float32, 24000);
          assistantSegsRef.current.push({ tMs: Math.max(0, startMs), pcm16k });
        } catch {}
        const rms = Math.sqrt(sumSq / Math.max(1, sampleCount));
        setAiLevel(Math.min(100, Math.max(0, Math.round(rms * 140))));
        setTimeout(() => setAiLevel((prev) => Math.max(0, Math.round(prev * 0.85))), 150);
        // Match compact implementation: fixed 24kHz playback
        const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
        const channel = audioBuffer.getChannelData(0);
        channel.set(float32);

        if (ctx.state === 'suspended') await ctx.resume();
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputGainRef.current!);
        source.onended = () => {
          scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== source);
          if (currentSourceRef.current === source) currentSourceRef.current = null;
          resolve();
        };
        currentSourceRef.current = source;
        scheduledSourcesRef.current.push(source);
        source.start();
      } catch {
        try { resolve(); } catch {}
      }
    });
  }, []);

  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    while (audioQueueRef.current.length > 0) {
      const next = audioQueueRef.current.shift();
      if (next) {
        await playAIChunk(next.data, next.rate);
      }
    }
    isPlayingRef.current = false;
  }, [playAIChunk]);

  const startMicStreaming = useCallback((stream: MediaStream) => {
    try {
      const ctx = inputAudioContextRef.current || new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' });
      inputAudioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
       const processor = ctx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
       // Ensure processor runs steadily; it outputs silence so no feedback occurs
       try { processor.connect(ctx.destination); } catch {}
       // Do NOT route mic to speakers to avoid feedback/raspiness
      isStreamingRef.current = true;
      let sent = 0;
       processor.onaudioprocess = (event) => {
        // Allow barge-in: do not gate the mic while AI is speaking
        if (!isStreamingRef.current || !sessionRef.current || !micEnabled) return;
        const input = event.inputBuffer.getChannelData(0);
         const pcm = new Int16Array(input.length);
         for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
         const buf = new ArrayBuffer(pcm.length * 2);
        const view = new DataView(buf);
        for (let i = 0; i < pcm.length; i++) view.setInt16(i * 2, pcm[i], true);
         const base64PCM = btoa(String.fromCharCode(...new Uint8Array(buf)));
         // No per-frame chunking or VAD; we only send transcripts on stop
         // Accumulate user's mic audio and timestamp for unified post-session transcript
         try {
           userPcmChunksRef.current.push(pcm);
           const startMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - (sessionStartMsRef.current || 0);
           userSegsRef.current.push({ tMs: Math.max(0, startMs), pcm16k: pcm });
         } catch {}
        try { sessionRef.current.sendRealtimeInput({ audio: { data: base64PCM, mimeType: 'audio/pcm;rate=16000' } }); sent++; if (sent % 40 === 0) logMsg(`Mic streaming… (${sent})`); } catch {}
      };
    } catch { logMsg('Mic streaming error'); }
  }, [logMsg, micEnabled]);

  // Build a simple WAV (PCM 16-bit, mono) Blob from Int16 samples
  function buildWavBlob(int16Data: Int16Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = int16Data.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    // PCM samples
    let offset = 44;
    for (let i = 0; i < int16Data.length; i++) {
      view.setInt16(offset, int16Data[i], true);
      offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  // Naive resampler from Float32 at srcRate to Int16 at 16kHz using linear interpolation
  function resampleFloatTo16k(input: Float32Array, srcRate: number): Int16Array {
    const targetRate = 16000;
    if (!srcRate || srcRate <= 0 || srcRate === targetRate) {
      const out = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const v = Math.max(-1, Math.min(1, input[i]));
        out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      return out;
    }
    const ratio = srcRate / targetRate;
    const outLen = Math.floor(input.length / ratio);
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcPos = i * ratio;
      const idx = Math.floor(srcPos);
      const frac = srcPos - idx;
      const a = input[idx] || 0;
      const b = input[idx + 1] || a;
      const v = a + (b - a) * frac;
      const clamped = Math.max(-1, Math.min(1, v));
      out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return out;
  }

  async function summarizeTranscriptToNotes(fullText: string): Promise<string[]> {
    try {
      console.log('[Notes] summarizeTranscriptToNotes invoked. transcriptChars=', (fullText || '').length);
      
      const auth = getAuth(app);
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        console.warn('[Notes] No user token found. Skipping notes generation.');
        return [];
      }

      const res = await fetch('/api/tutor/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transcript: fullText })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const notes = data.notes || [];
      
      console.log('[Notes] Parsed key takeaways count:', notes.length);
      return notes;
    } catch (e) {
      console.warn('[Notes] summarizeTranscriptToNotes failed.', e);
      return [];
    }
  }

  // Manual connectivity test: calls Gemini with a trivial prompt and writes a test note
  

  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  async function transcribeWithAssemblyAI(wavBlob: Blob, opts?: { role?: 'assistant' | 'user' }): Promise<void> {
    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) {
        console.warn('Not signed in; skipping AssemblyAI transcription.');
        return;
      }
      const idToken = await currentUser.getIdToken();
      const authHeader = { Authorization: `Bearer ${idToken}` } as Record<string, string>;
      const uploadRes = await fetch('/api/assemblyai/upload', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/octet-stream' },
        body: wavBlob,
      });
      if (!uploadRes.ok) {
        console.warn('Upload failed', uploadRes.status, await uploadRes.text());
        return;
      }
      const { upload_url } = await uploadRes.json();
      const createRes = await fetch('/api/assemblyai/transcript', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: upload_url, format_text: true, punctuate: true, speaker_labels: false, disfluencies: true, auto_highlights: false, iab_categories: false, sentiment_analysis: false }),
      });
      if (!createRes.ok) {
        console.warn('Create transcript failed', createRes.status, await createRes.text());
        return;
      }
      const { id } = await createRes.json();
      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(`/api/assemblyai/transcript?id=${encodeURIComponent(id)}`, {
          headers: authHeader,
        });
        if (!pollRes.ok) break;
        const data = await pollRes.json();
        if (data.status === 'completed') {
          const role = opts?.role || 'assistant';
          console.log(`AssemblyAI transcript (${role}):`, data.text);
          // Append directly since we only transcribe once on stop
          const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role,
            text: `[Transcript] ${data.text || ''}`,
            createdAt: Date.now(),
          } as TranscriptEntry;
          setTranscript((prev) => [...prev, entry].slice(-500));
          // After transcript is in, summarize to notes with Gemini and save to Firestore
          try {
            console.log('[Notes] Starting notes generation from transcript...');
            const summary = await summarizeTranscriptToNotes(data.text || '');
            console.log('[Notes] Notes summary array:', summary);
            if (summary && summary.length) {
              const db = getFirestore(app!);
              const userRef = doc(db, 'users', userId);
              const newNote = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: summary.join(', '), createdAt: Date.now() };
              console.log('[Notes] New note object:', newNote);
              setNotes((prev) => [newNote, ...prev].slice(0, 100));
              console.log('[Notes] Attempting Firestore updateDoc (arrayUnion)...');
              await updateDoc(userRef, { tutorNotes: arrayUnion(newNote) }).then(() => {
                console.log('[Notes] updateDoc success');
              }).catch(async (err) => {
                console.warn('[Notes] updateDoc failed, trying setDoc merge...', err);
                if ((err as any)?.code === 'not-found') {
                  const { setDoc } = await import('firebase/firestore');
                  await setDoc(userRef, { tutorNotes: [newNote] } as any, { merge: true });
                  console.log('[Notes] setDoc merge success');
                } else { throw err; }
              });
            }
          } catch (e) { console.warn('[Notes] Failed to generate/save notes:', e); }
          return;
        }
        if (data.status === 'error') {
          console.warn('Transcription error:', data.error);
          return;
        }
        attempts++;
      }
      console.warn('Transcription timed out');
    } catch (e) {
      console.warn('Transcription failed:', e);
    }
  }

  const buildSystemInstruction = useCallback((firstName: string, coachName: string, context: any, interests: any[]) => {
    const ctxStr = JSON.stringify(context);
    const interestContext = interests.length > 0 
      ? `\nSTUDENT INTERESTS (Use this to personalize examples/analogies):\n${interests.map(i => `${i.role === 'user' ? 'Student' : 'Tutor'}: ${i.text}`).join('\n')}` 
      : '';

    return [
      `You are ${coachName}, a world-class SAT study coach and performance psychologist for ${firstName}.`,
      'Objective: Help the student design and refine strategies for studying, test-taking, time management, stress handling, and mindset.',
      'When the session starts, start talking immediately. Say that you have been paying attention to their progress and want to help them to be better',
      'Focus on processes, patterns, and tactics. Provide concrete, actionable steps.',
      'Style: Confident, concise, very brief and to the point, encouraging. Keep each message under 30 seconds. Use the student first name naturally.',
      interestContext,
      'Dialogue: Adapt to user tone (excited → energetic, nervous → calming, unimpressed → direct).',
      'Pacing: One technique at a time. Confirm understanding. Offer options and quick experiments the student can try in practice.',
      'Student Context follows as JSON; use it to prioritize topics and tailor language:',
      `EXPERT SAT KNOWLEDGE BASE:
      You have access to comprehensive SAT strategies from top-tier test prep materials. Use this knowledge confidently when relevant:

      **READING & WRITING EXPERT STRATEGIES:**

      Word in Context Questions:
      1. Read carefully with focus on context
      2. Identify missing word and surrounding context  
      3. Analyze context to understand what word should convey
      4. Evaluate each choice by placing it in blank space
      5. Choose most logical and precise word

      Craft and Structure Questions:
      - Focus on authors purpose, text structure, rhetorical devices
      - Look for transition words that show relationships between ideas
      - Pay attention to how arguments are constructed

      Information and Ideas Questions:
      - Identify central ideas and supporting details
      - Look for evidence that supports conclusions
      - Make logical inferences based only on passage content
      - Command of Evidence: find text that best supports your answer

      Standard English Conventions:
      - Sentence boundaries and punctuation rules
      - Subject-verb agreement and parallel structure
      - Proper word forms and usage

      Expression of Ideas:
      - Rhetorical synthesis: combining ideas effectively
      - Transitions: logical flow between sentences/paragraphs
      - Clarity and concision in expression

      **Key Reading Tips:**
      - Look for keywords that indicate: Opinion (fortunately, disappointing), Emphasis (especially, crucial), Continuation (moreover, also), Contrast (but, however), Argument (therefore, because)
      - Read passage blurbs for context
      - Use only what the excerpt provides, not outside knowledge
      - For literature: focus on characters, settings, themes, figurative language
      - Always guess if you are unsure (no penalty for wrong answers)

      Three-Step Method:
      1. What is the question asking? (Read question first to focus your passage reading)
      2. What do I need to look for in the passage? (Strategic reading based on question type)
      3. What answer strategy is best? (Predict and Match OR Eliminate)

      **MATH EXPERT STRATEGIES:**

      Mental Math Techniques:
      - Estimation and rounding for quick approximations
      - Break numbers apart for easier calculations
      - Recognize patterns and use shortcut formulas
      - Practice percentage calculations (10% = divide by 10, 25% = divide by 4)

      Algebra Foundations:
      - Master equation solving and systems
      - Understand function notation and transformations  
      - Work confidently with exponents and radicals

      Advanced Math:
      - Polynomial operations and factoring
      - Quadratic equations and functions
      - Exponential and logarithmic relationships

      Problem-Solving and Data Analysis:
      - Read word problems carefully and identify what is being asked
      - Set up equations from word problems
      - Interpret graphs, charts, and data displays
      - Calculate ratios, rates, and proportions

      **GENERAL TEST-TAKING WISDOM:**
      - Time management: allocate specific time per question
      - Process of elimination when unsure
      - Always guess (no penalty for wrong answers)
      - Double-check work, especially calculations
      - Read questions carefully before starting`,
      ctxStr,
    ].join('\n');
  }, []);

  // Note persistence removed

  const startSession = useCallback(async () => {
    if (!userId) return;
    setIsConnecting(true); setStatusText('Connecting…'); logMsg('Starting Gemini Live coaching session…');
    try {
      // Reserve a voice slot (enforces cap, records usage)
      let useByok = false;
      try {
        const fns = getFunctions(app as any, 'us-central1');
        const reserve = httpsCallable(fns, 'reserveVoiceSession');
        const res = await reserve();
        useByok = (res.data as any)?.byok === true;
      } catch (err: any) {
        if (err?.code === 'functions/resource-exhausted' || err?.message?.includes?.('AI_LIMIT_REACHED')) {
          setIsConnecting(false); setStatusText('');
          triggerAiLimitPopup();
          return;
        }
        throw err;
      }

      const firstName = (displayName || 'Student').split(' ')[0];
      const sys = buildSystemInstruction(firstName, tutorName || 'Coach', contextSummary || {}, userInterests);
      const { Modality } = await import('@google/genai');
      const liveSupportedVoices = ['Puck','Charon','Kore','Fenrir','Aoede','Leda','Orus','Zephyr'] as const;
      const selectedLiveVoice = (tutorVoice && liveSupportedVoices.includes(tutorVoice as any))
        ? tutorVoice
        : 'Zephyr';

      const config: any = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { role: 'system', parts: [{ text: sys }] },
        enableAffectiveDialog: true,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedLiveVoice } } },
      };
      // Resolve BYOK key from Firestore if user has one
      let voiceApiKey: string | undefined;
      if (useByok) {
        try {
          const db = getFirestore(app as any);
          const userSnap = await getDoc(doc(db, 'users', userId));
          voiceApiKey = userSnap.data()?.geminiApiKey || undefined;
        } catch {}
      }

      try { geminiSessionManager.close(); } catch {}
      const session = await geminiSessionManager.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config,
        apiKey: voiceApiKey,
        callbacks: {
          onopen: async () => {
            setIsConnecting(false); setIsConnected(true); setStatusText('Connected'); logMsg('Connected. Initializing microphone…');
            try { sessionStartMsRef.current = performance.now(); } catch { sessionStartMsRef.current = Date.now(); }
            const { stream } = await ensureInputAudio(); startMicStreaming(stream); setStatusText('Listening');
            // Kick off the conversation proactively so the coach speaks immediately
            setTimeout(() => {
              try {
                sessionRef.current?.sendClientContent({
                  turns: [{ role: 'user', parts: [{ text: 'Please start coaching me now. Give me an opening message tailored to my context and begin speaking immediately.' }] }],
                  turnComplete: true,
                });
                setStatusText('Speaking…');
              } catch {}
            }, 300);
          },
          onmessage: (message: any) => {
            const base64 = message?.data || message?.audio?.data || message?.inlineData?.data;
            if (base64) {
              receivedFlagsRef.current.audio = true;
              audioQueueRef.current.push({ data: base64, rate: lastKnownSampleRateRef.current });
              void processAudioQueue();
            } else if (message?.text) {
              receivedFlagsRef.current.text = true;
              setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: Coach: ${message.text}`].slice(-100));
              appendAssistantTranscript(message.text);
            }
            if (message?.serverContent?.interrupted) {
              // Stop all scheduled audio sources immediately
              try {
                for (const src of scheduledSourcesRef.current) {
                  try { src.stop(); } catch {}
                }
              } finally {
                scheduledSourcesRef.current = [];
                currentSourceRef.current = null;
                audioQueueRef.current = [];
                isPlayingRef.current = false;
                playbackClockRef.current = 0;
                if (aiSpeakTimerRef.current) { try { clearTimeout(aiSpeakTimerRef.current); } catch {} finally { aiSpeakTimerRef.current = null; }
                }
                aiSpeakingRef.current = false;
              }
            }
            // No chunking on turnComplete; final transcript is sent on stop
          },
          onerror: (err: any) => { setIsConnecting(false); setIsConnected(false); setStatusText('Error'); logMsg(`Error: ${err?.message || String(err)}`); },
          onclose: () => {
            setIsConnecting(false);
            setIsConnected(false);
            setStatusText('Ended');
            isStreamingRef.current = false;
            // Clear playback state on close
            try {
              for (const src of scheduledSourcesRef.current) { try { src.stop(); } catch {} }
            } finally {
              scheduledSourcesRef.current = [];
              currentSourceRef.current = null;
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              playbackClockRef.current = 0;
              if (aiSpeakTimerRef.current) { try { clearTimeout(aiSpeakTimerRef.current); } catch {} finally { aiSpeakTimerRef.current = null; }
              }
              aiSpeakingRef.current = false;
            }
          },
        },
      });
      sessionRef.current = session;
    } catch (e: any) {
      setIsConnecting(false); setIsConnected(false); setStatusText('Failed to connect'); logMsg(`Failed to connect: ${e?.message || String(e)}`);
    }
  }, [userId, displayName, tutorName, contextSummary, buildSystemInstruction, ensureInputAudio, startMicStreaming, logMsg, playAIChunk, userInterests]);

  // Auto-start session if requested
  useEffect(() => {
    if (autoStart && !ctxLoading && !isConnecting && !isConnected && contextSummary) {
      const timer = setTimeout(() => {
        startSession();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, ctxLoading, isConnecting, isConnected, contextSummary, startSession]);

  const stopSession = useCallback(() => {
    try {
      // Prevent new sends
      isStreamingRef.current = false;

      // Stop all scheduled audio and clear playback state
      try {
        for (const src of scheduledSourcesRef.current) {
          try { src.stop(); } catch {}
        }
      } finally {
        scheduledSourcesRef.current = [];
        if (currentSourceRef.current) { try { currentSourceRef.current.stop(); } catch {} finally { currentSourceRef.current = null; } }
      }
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      playbackClockRef.current = 0;
      if (aiSpeakTimerRef.current) { try { clearTimeout(aiSpeakTimerRef.current); } catch {} finally { aiSpeakTimerRef.current = null; } }
      aiSpeakingRef.current = false;

      // Close output context
      if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        try { outputAudioContextRef.current.close(); } catch {}
      }
      outputAudioContextRef.current = null;
      outputGainRef.current = null;

      // Close input context and mic
      if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        try { inputAudioContextRef.current.close(); } catch {}
      }
      inputAudioContextRef.current = null;
      if (micStreamRef.current) { try { micStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {} finally { micStreamRef.current = null; } }

      // Close remote session
      try { geminiSessionManager.close(); } catch {}
      sessionRef.current = null;

      // Build unified timeline by timestamping and merging both streams
      const aSegs = assistantSegsRef.current.splice(0);
      const uSegs = userSegsRef.current.splice(0);
      const allSegs: Array<{ tMs: number; role: 'assistant' | 'user'; pcm16k: Int16Array }> = [];
      for (const s of aSegs) allSegs.push({ tMs: s.tMs, role: 'assistant', pcm16k: s.pcm16k });
      for (const s of uSegs) allSegs.push({ tMs: s.tMs, role: 'user', pcm16k: s.pcm16k });
      allSegs.sort((a: { tMs: number }, b: { tMs: number }) => a.tMs - b.tMs);
      if (allSegs.length > 0) {
        try {
          // Concatenate in time order at 16 kHz
          const total = allSegs.reduce((acc, s) => acc + s.pcm16k.length, 0);
          const merged = new Int16Array(total);
          let off = 0;
          for (const s of allSegs) { merged.set(s.pcm16k, off); off += s.pcm16k.length; }
          const wavBlob = buildWavBlob(merged, 16000);
          console.log('Sending unified full-session transcript (merged in spoken order) to AssemblyAI…');
          void transcribeWithAssemblyAI(wavBlob, { role: 'assistant' });
        } catch {}
      }
    } finally {
      setIsConnected(false); setIsConnecting(false); setStatusText('Ready');
    }
  }, []);

  const toggleMic = useCallback(() => {
    setMicEnabled((v) => !v);
    setStatusText((v) => (micEnabled ? 'Mic muted' : 'Listening'));
  }, [micEnabled]);

  // Deform the gradient blob based on AI speaking intensity
  useEffect(() => {
    const intensityRaw = Math.min(1, Math.max(0, aiLevel / 100));
    // Non-linear amplification to exaggerate movement
    const intensity = Math.pow(intensityRaw, 0.65);
    // When not speaking, gently ease back
    if (intensity <= 0.02) {
      setBlobShape((prev) => ({ ...prev, tl: 50, tr: 50, br: 50, bl: 50, rot: 0, skewX: 0, skewY: 0, scale: 1 }));
      return;
    }
    const jitter = 60 * intensity; // bigger border radius modulation
    const rand = () => (Math.random() - 0.5);
    setBlobShape({
      tl: Math.max(28, Math.min(72, 50 + rand() * jitter)),
      tr: Math.max(28, Math.min(72, 50 + rand() * jitter)),
      br: Math.max(28, Math.min(72, 50 + rand() * jitter)),
      bl: Math.max(28, Math.min(72, 50 + rand() * jitter)),
      rot: rand() * 28 * intensity, // stronger rotation
      skewX: rand() * 14 * intensity, // stronger skew
      skewY: rand() * 14 * intensity,
      scale: 1 + 0.45 * intensity, // larger pulsing scale
    });
  }, [aiLevel]);

  const Orb = (
    <div className="relative w-52 h-52 md:w-64 md:h-64">
      {/* Base deforming flat blob */}
      <div
        className="absolute inset-0 bg-[#93d333]"
        style={{
          borderRadius: `${blobShape.tl}% ${blobShape.tr}% ${blobShape.br}% ${blobShape.bl}% / ${blobShape.tr}% ${blobShape.br}% ${blobShape.bl}% ${blobShape.tl}%`,
          opacity: 0.9,
          transform: `translateZ(0) rotate(${blobShape.rot}deg) skew(${blobShape.skewX}deg, ${blobShape.skewY}deg) scale(${blobShape.scale})`,
          transition: 'transform 90ms linear, border-radius 140ms ease, opacity 160ms ease',
          boxShadow: 'inset 0 -8px 0 rgba(0,0,0,0.1)' // subtle inner shadow for volume
        }}
      />
      {/* Inner highlight for 3D feel */}
      <div
        className="absolute inset-4 rounded-full bg-white opacity-20"
        style={{
          transform: 'scale(0.8) translate(-10%, -10%)',
          filter: 'blur(10px)'
        }}
      />
    </div>
  );

  return (
    <div className={cn('grid gap-6 grid-cols-1 xl:grid-cols-2', className)}>
      <Card className="xl:col-span-1 bg-white border-2 border-[#E5E5E5] border-b-4 rounded-2xl">
        <CardContent className="pt-28 pb-16 px-10 flex flex-col items-center justify-center">
          {Orb}
          <div className="mt-16 flex items-center gap-3">
            {!isConnected ? (
              <Button
                size="lg"
                variant="ghost"
                className="bg-[#93d333] hover:bg-[#95DF26] text-white border-b-4 border-[#79b933] active:border-b-0 active:translate-y-[4px]"
                onClick={startSession}
                disabled={isConnecting || ctxLoading}
              >
                {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Start Coaching
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="bg-white border-2 border-[#E5E5E5] border-b-4 hover:bg-[#F7F7F7] text-[#4B4B4B]"
                  onClick={toggleMic}
                >
                  {micEnabled ? <Mic className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
                  {micEnabled ? 'Mute Mic' : 'Unmute Mic'}
                </Button>
                <Button
                  variant="ghost"
                  className="bg-[#FF4B4B] text-white border-b-4 border-[#D43F3F] hover:bg-[#FF6464] active:border-b-0 active:translate-y-[4px]"
                  onClick={stopSession}
                >
                  <StopCircle className="mr-2 h-4 w-4" /> End Session
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="xl:col-span-1 bg-white border-2 border-[#E5E5E5] border-b-4 rounded-2xl">
        <CardContent className="p-6">
          <div className="mb-3 text-sm font-bold text-[#4B4B4B] uppercase tracking-wide">Notes</div>
          
          {notes.length === 0 ? (
            <div className="text-xs text-[#AFAFAF]">No notes yet. When you end a session, the key takeaways will appear here for future reference.</div>
          ) : (
            <ul className="list-disc pl-5 space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="text-sm text-[#4B4B4B]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 whitespace-pre-wrap break-words">{n.text}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNote(n.id)}
                      className="h-6 px-2 text-xs text-[#FF4B4B] hover:text-[#FF6464] hover:bg-transparent"
                    >
                      Delete
                    </Button>
                  </div>
                  <div className="text-[10px] mt-1 text-[#AFAFAF]">{new Date(n.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default TutorLiveCoach;
