import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/firebaseClient';
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
  Maximize2
} from 'lucide-react';

interface CompactVoiceConversationProps {
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

export function CompactVoiceConversation({
  isOpen,
  question,
  userAnswer,
  thinkingAudio,
  onClose,
  className
}: CompactVoiceConversationProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Ready to connect');
  const [conversationLog, setConversationLog] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [userName, setUserName] = useState('');

  const sessionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isStreamingRef = useRef(false);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const user = auth?.currentUser;
    if (user?.displayName) {
      setUserName(user.displayName.split(' ')[0]);
    }
  }, []);

  const logMessage = (message: string) => {
    setConversationLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(`${new Date().toLocaleTimeString()}: ${message}`);
  };

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

  const stopAudioLevelMonitoring = () => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    setAudioLevel(0);
    setIsSpeaking(false);
  };

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
      return stream;
    } catch (error) {
      logMessage(`Audio initialization failed: ${error}`);
      throw error;
    }
  };

  const playAudioData = async (base64Data: string) => {
    audioQueueRef.current.push(base64Data);
    if (!isPlayingRef.current) {
      processAudioQueue();
    }
  };

  const processAudioQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const base64Data = audioQueueRef.current.shift();
      if (base64Data) {
        await playAudioChunk(base64Data);
      }
    }

    isPlayingRef.current = false;
  };

  const playAudioChunk = async (base64Data: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (!audioContextRef.current) {
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

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => resolve();
        source.start();
      } catch (error) {
        logMessage(`Audio playback error: ${error}`);
        reject(error);
      }
    });
  };

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

  const startTutoringSession = async () => {
    try {
      setStatus('Starting tutoring session...');
      logMessage('Starting tutoring session with context...');

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not found');
      }

      const stream = await initializeAudio();
      if (!stream) {
        throw new Error('Failed to initialize audio');
      }

      // Dynamic import with proper ES module handling
      const GoogleGenAIModule = await import('@google/genai');
      const { GoogleGenAI, Modality } = GoogleGenAIModule;
      const ai = new GoogleGenAI({ apiKey });
      
      // Create tutoring-specific system instruction with user's name and complete context
      const optionsText = Array.isArray(question.options) 
        ? question.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')
        : question.options;
      
      // Convert user answer to letter format if it's a number (multiple choice)
      const userAnswerDisplay = Array.isArray(question.options) && typeof userAnswer === 'number'
        ? String.fromCharCode(65 + userAnswer) // Convert 0->A, 1->B, 2->C, 3->D
        : userAnswer;
      
      // Convert correct answer to letter format if it's a number (multiple choice)  
      const correctAnswerDisplay = Array.isArray(question.options) && typeof question.answer === 'number'
        ? String.fromCharCode(65 + question.answer) // Convert 0->A, 1->B, 2->C, 3->D
        : question.answer;
      
      const passageText = question.passage ? `\n\nReading Passage:\n${question.passage}` : '';
      const isReadingWritingQuestion = !!question.passage; // Has passage = Reading/Writing section
      
      const systemInstruction = `You are an expert SAT tutor helping ${userName} who just got a question wrong.

${isReadingWritingQuestion ? 'This is a READING AND WRITING question with a passage.' : 'This is a MATH question.'} 

Question: ${question.question}
${passageText}

Answer Choices:
${optionsText}

Student's Answer: ${userAnswerDisplay}
Correct Answer: ${correctAnswerDisplay}

The student has just recorded their thinking process while solving this question. 

IMPORTANT: You should START SPEAKING IMMEDIATELY when the session begins. Do not wait for the student to speak first.

If you hear their thinking audio:
1. Acknowledge what you heard in their thinking process
2. Identify where their reasoning went wrong
3. Gently guide them to the correct approach

If no thinking audio is available:
1. Let them know that for some system error you didn't hear them, but you can still help.
2. Immediately start by analyzing their wrong answer choice
3. Explain why that choice might seem appealing but is incorrect
4. Guide them through the correct approach

Always:
- Be encouraging, supportive and with a friendly tone.
- Keep responses conversational and under 30 seconds
- Ask follow-up questions to ensure they understand
- Address them by their name when you talk to them, but don't overdo it too much.

For Reading and Writing questions, you can mention these expert strategies when relevant:

**Three-Step Method:**
1. What is the question asking? (Read question first to focus your passage reading)
2. What do I need to look for in the passage? (Strategic reading based on question type)
3. What answer strategy is best? (Predict and Match OR Eliminate)

**Key Reading Tips:**
- Look for keywords that indicate: Opinion (fortunately, disappointing), Emphasis (especially, crucial), Continuation (moreover, also), Contrast (but, however), Argument (therefore, because)
- Read passage blurbs for context
- Use only what the excerpt provides, not outside knowledge
- For literature: focus on characters, settings, themes, figurative language
- Always guess if you're unsure (no penalty for wrong answers)

**Answer Strategies:**
- Predict and Match: Make your own prediction, then find matching answer choice
- Eliminate: Rule out choices that don't directly answer based on passage info

Only mention these strategies if they're relevant to the specific mistake the student made.

Start immediately with something like "Hi ${userName}, I can see you chose ${userAnswerDisplay} for this question. Let me help you understand where the confusion might be..." then proceed with your tutoring.`;

      const config = {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
      };

      logMessage('Creating Gemini Live tutoring session...');
      
      let sessionInstance: any = null;
      
      const session = await ai.live.connect({
        model: 'gemini-2.0-flash-live-001',
        config: config,
        callbacks: {
          onopen: async () => {
            logMessage('Connected to Gemini Live for tutoring!');
            setIsConnected(true);
            setStatus('Connected - Sending context...');
            
            if (thinkingAudio) {
              try {
                logMessage('Converting and sending student thinking audio...');
                const base64PCM = await convertBlobToPCM(thinkingAudio);
                
                await sessionInstance?.sendRealtimeInput({
                  audio: {
                    data: base64PCM,
                    mimeType: "audio/pcm;rate=16000"
                  }
                });
                
                logMessage('Student thinking audio sent successfully');
                setStatus('Context sent - Starting conversation...');
                
                setTimeout(async () => {
                  logMessage('Starting live audio streaming...');
                  startContinuousAudioStreaming(stream);
                  setStatus('AI will analyze your thinking and respond...');
                  
                  // Give the AI a moment to process the audio, then trigger it to start speaking
                  setTimeout(async () => {
                    await sessionInstance?.sendClientContent({
                      turns: [{
                        role: "user",
                        parts: [{ text: "Please analyze my thinking process and help me understand my mistake." }]
                      }],
                      turnComplete: true
                    });
                    setStatus('AI Tutor is analyzing and speaking...');
                  }, 1000);
                }, 1000);
                
              } catch (error) {
                logMessage(`Error sending thinking audio: ${error}`);
                startContinuousAudioStreaming(stream);
                setStatus('Tutoring session active - Speak naturally!');
              }
            } else {
              logMessage('No thinking audio available, starting conversation directly');
              // Start streaming first, then trigger the AI to begin speaking
              startContinuousAudioStreaming(stream);
              setStatus('Tutoring session active - AI will begin shortly...');
              
              // Give a moment for streaming to be established, then trigger AI to start
              setTimeout(async () => {
                await sessionInstance?.sendClientContent({
                  turns: [{
                    role: "user", 
                    parts: [{ text: "Please start the tutoring session now and help me understand my mistake." }]
                  }],
                  turnComplete: true
                });
                setStatus('AI Tutor is speaking...');
              }, 500);
            }
          },
          
          onmessage: (message: any) => {
            if (message.data) {
              logMessage(`Received tutoring audio: ${message.data.length} characters`);
            } else {
              logMessage(`Received tutoring message: ${JSON.stringify(message, null, 2)}`);
            }
            
            if (message.setupComplete) {
              logMessage('Tutoring setup completed successfully');
            }
            
            if (message.serverContent?.interrupted) {
              logMessage('Tutoring interrupted - clearing audio queue');
              audioQueueRef.current = [];
              isPlayingRef.current = false;
            }
            
            if (message.serverContent?.turnComplete) {
              logMessage('Tutor finished speaking');
            }
            
            if (message.data) {
              playAudioData(message.data);
            }
            
            if (message.text) {
              logMessage(`Tutor text: ${message.text}`);
            }
          },
          
          onerror: (error: any) => {
            logMessage(`Tutoring connection error: ${error.message || error}`);
            setIsConnected(false);
            setStatus('Tutoring error occurred');
          },
          
          onclose: (event: any) => {
            logMessage(`Tutoring connection closed: ${event.reason || 'Unknown reason'}`);
            setIsConnected(false);
            setStatus('Tutoring session ended');
            isStreamingRef.current = false;
          }
        }
      });

      sessionInstance = session;
      sessionRef.current = session;
      logMessage(`Tutoring session assigned: sessionRef.current exists = ${!!sessionRef.current}`);

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
      isStreamingRef.current = false;
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      stopAudioLevelMonitoring();
      
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      setIsConnected(false);
      setStatus('Disconnected');
      logMessage('Voice session stopped');
    } catch (error) {
      logMessage(`Error stopping session: ${error}`);
    }
  };

  // Auto-start tutoring session when opened
  useEffect(() => {
    if (isOpen && !isConnected) {
      startTutoringSession();
    }
  }, [isOpen]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopVoiceSession();
    }
    return () => {
      stopVoiceSession();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  // Compact view - bottom right corner
  if (!isExpanded) {
    return (
      <div className={cn(
        "fixed bottom-6 left-6 z-50 transition-all duration-300",
        className
      )}>
        <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-full shadow-lg border border-blue-200">
          {/* AI Avatar with Animation */}
          <div className={cn(
            "w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center transition-all duration-200",
            isPlayingRef.current && "animate-pulse bg-blue-200"
          )}>
            <Bot className="h-4 w-4 text-blue-600" />
          </div>
          
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-700">AI Tutor</span>
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
                <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '100ms' }}></div>
                <div className="w-1 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
              </div>
            </div>
          )}

          {/* Expand Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="h-8 w-8 p-0"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
          
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

  // Expanded view - larger but still in corner
  return (
    <div className={cn(
      "fixed bottom-6 left-6 z-50 w-96 transition-all duration-300",
      className
    )}>
      <Card className="shadow-xl border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-600" />
              AI Tutor - {userName}
            </div>
            <div className="flex items-center gap-1">
              {isPlayingRef.current && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Volume2 className="h-3 w-3" />
                  <span className="text-xs">Speaking...</span>
                </div>
              )}
              {isSpeaking && (
                <div className="flex items-center gap-1 text-green-600">
                  <Mic className="h-3 w-3" />
                  <span className="text-xs">Listening...</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6 p-0"
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* Question Context */}
          <div className="p-2 bg-gray-50 rounded text-xs">
            <p className="text-gray-700 line-clamp-2">{question.question}</p>
            <div className="flex gap-3 mt-1 text-xs">
              <span>Your: <span className="font-medium text-red-600">
                {Array.isArray(question.options) && typeof userAnswer === 'number'
                  ? String.fromCharCode(65 + userAnswer)
                  : userAnswer}
              </span></span>
              <span>Correct: <span className="font-medium text-green-600">
                {Array.isArray(question.options) && typeof question.answer === 'number'
                  ? String.fromCharCode(65 + question.answer)
                  : question.answer}
              </span></span>
            </div>
          </div>

          {/* Status */}
          <div className="text-center">
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs",
              isConnected ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-500" : "bg-gray-400"
              )} />
              {status}
            </div>
          </div>

          {/* Status Message */}
          <div className="text-center text-xs text-gray-500">
            Continue from the main interface when ready
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 