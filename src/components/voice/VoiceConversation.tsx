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
  Loader2
} from 'lucide-react';

interface VoiceConversationProps {
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
  onContinuePractice: () => void;
  className?: string;
}

export function VoiceConversation({
  isOpen,
  question,
  userAnswer,
  thinkingAudio,
  onClose,
  onContinuePractice,
  className
}: VoiceConversationProps) {
  const [isClient, setIsClient] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Ready to connect');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userName, setUserName] = useState<string>('');

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isStreamingRef = useRef(false);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get user name from auth - extract first name only
  useEffect(() => {
    if (auth?.currentUser) {
      const fullName = auth.currentUser.displayName || 'there';
      const firstName = fullName.split(' ')[0];
      setUserName(firstName);
    } else {
      setUserName('there');
    }
  }, []);

  // Start tutoring session when dialog opens
  useEffect(() => {
    if (isClient && isOpen && !isConnected) {
      startTutoringSession();
    }
  }, [isClient, isOpen, isConnected]);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    try {
      isStreamingRef.current = false;
      
      // Clear audio queue and stop playback
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      
      // Stop audio level monitoring
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
    } catch (error) {
      console.error(`Error during cleanup: ${error}`);
    }
  };

  const logMessage = (message: string) => {
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
      setIsSpeaking(normalizedLevel > 5); // Consider speaking if level > 5%
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
      if (!isClient) return null;

      // Initialize AudioContext for processing
      audioContextRef.current = new AudioContext({
        sampleRate: 24000 // Output sample rate
      });

      logMessage('Requesting microphone access...');
      
      // Get microphone access with more specific constraints
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

      // Test if microphone is working
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found');
      }
      
      logMessage(`Microphone access granted: ${audioTracks[0].label}`);
      
      // Set up live audio level monitoring
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;
      
      // Start continuous audio level monitoring for UI
      startAudioLevelMonitoring();

      logMessage('Audio initialized successfully');
      return stream;
    } catch (error) {
      logMessage(`Audio initialization failed: ${error}`);
      throw error;
    }
  };

  const playAudioData = async (base64Data: string) => {
    // Add to queue instead of playing immediately
    audioQueueRef.current.push(base64Data);
    
    // Start processing queue if not already playing
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

        // Decode base64 to array buffer
        const binaryString = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(binaryString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }

        // Convert to Int16Array (16-bit PCM)
        const int16Array = new Int16Array(arrayBuffer);
        
        // Create audio buffer for 24kHz output
        const audioBuffer = audioContextRef.current.createBuffer(1, int16Array.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        
        // Convert Int16 to Float32 and copy to audio buffer
        for (let i = 0; i < int16Array.length; i++) {
          channelData[i] = int16Array[i] / 32768.0;
        }

        // Play the audio
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        
        // Resolve when audio finishes playing
        source.onended = () => resolve();
        
        source.start();
      } catch (error) {
        logMessage(`Audio playback error: ${error}`);
        reject(error);
      }
    });
  };

  // Helper function to convert Blob to PCM format
  const convertBlobToPCM = async (audioBlob: Blob): Promise<string> => {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Convert to 16-bit PCM
    const pcmData = new Int16Array(audioBuffer.length);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    // Convert to base64
    const buffer = new ArrayBuffer(pcmData.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(i * 2, pcmData[i], true); // little-endian
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

      // Initialize audio
      const stream = await initializeAudio();
      if (!stream) {
        throw new Error('Failed to initialize audio');
      }

      // Dynamic import of the Google GenAI SDK
      const { GoogleGenAI, Modality } = await import('@google/genai');
      
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
1. Immediately start by analyzing their wrong answer choice
2. Explain why that choice might seem appealing but is incorrect
3. Guide them through the correct approach

Always:
- Be encouraging and supportive
- Keep responses conversational and under 30 seconds
- Ask follow-up questions to ensure they understand
- Address them by their first name "${userName}" naturally in conversation

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

Start immediately with something like "Hi ${userName}, I can see you chose [their answer] for this question. Let me help you understand where the confusion might be..." then proceed with your tutoring.`;

      const config = {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
      };

      logMessage('Creating Gemini Live tutoring session...');
      
      // Store the session reference locally for use in callbacks
      let sessionInstance: any = null;
      
      // Create the session and assign it immediately
      const session = await ai.live.connect({
        model: 'gemini-2.0-flash-live-001',
        config: config,
        callbacks: {
          onopen: async () => {
            logMessage('Connected to Gemini Live for tutoring!');
            setIsConnected(true);
            setStatus('Connected - Sending context...');
            
            // Send the student's thinking audio as context if available
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
                
                // Give Gemini a moment to process the context, then start live conversation
                setTimeout(() => {
                  logMessage('Starting live audio streaming...');
                  startContinuousAudioStreaming(stream);
                  setStatus('Tutoring session active - Gemini is analyzing and will speak first!');
                }, 1000);
                
              } catch (error) {
                logMessage(`Error sending thinking audio: ${error}`);
                // Still start the conversation even if context fails
                startContinuousAudioStreaming(stream);
                setStatus('Tutoring session active - Gemini will start speaking!');
              }
            } else {
              logMessage('No thinking audio available, starting conversation directly');
              
              // Start live conversation immediately - Gemini will speak first
              startContinuousAudioStreaming(stream);
              setStatus('Tutoring session active - Gemini will start speaking!');
            }
          },
          
          onmessage: (message: any) => {
            // Handle audio response
            if (message.data) {
              logMessage(`Received tutoring audio: ${message.data.length} characters`);
              playAudioData(message.data);
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
            
            // Log any text responses
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

      // Assign the session reference AFTER the connection is established
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
      
      // Create AudioContext for direct PCM processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create a ScriptProcessor node for audio processing
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      let chunkCount = 0;
      
      processor.onaudioprocess = async (event) => {
        if (!isStreamingRef.current || !sessionRef.current) return;
        
        chunkCount++;
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (16-bit PCM)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcmData.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcmData.length; i++) {
          view.setInt16(i * 2, pcmData[i], true); // little-endian
        }
        
        const base64PCM = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        
        try {
          // Send real-time audio input to Gemini
          sessionRef.current.sendRealtimeInput({
            audio: {
              data: base64PCM,
              mimeType: "audio/pcm;rate=16000"
            }
          });
        } catch (error) {
          logMessage(`Audio sending error: ${error}`);
        }
      };
      
      // Connect the audio processing chain
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      logMessage('Direct PCM audio streaming started successfully');
      
    } catch (error) {
      logMessage(`Failed to start audio streaming: ${error}`);
    }
  };

  const endConversation = () => {
    cleanup();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className={cn("w-full max-w-lg flex flex-col", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              AI Voice Tutor - {userName}
            </div>
            <div className="flex items-center gap-2">
              {isPlayingRef.current && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Volume2 className="h-4 w-4" />
                  <span className="text-sm">Speaking...</span>
                </div>
              )}
              {isSpeaking && (
                <div className="flex items-center gap-1 text-green-600">
                  <Mic className="h-4 w-4" />
                  <span className="text-sm">Listening...</span>
                </div>
              )}
            </div>
          </CardTitle>
          
          {/* Question Context */}
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p className="text-gray-700 line-clamp-2">{question.question}</p>
            <div className="flex gap-4 mt-2 text-xs">
              <span>Your Answer: <span className="font-medium text-red-600">
                {Array.isArray(question.options) && typeof userAnswer === 'number'
                  ? String.fromCharCode(65 + userAnswer)
                  : userAnswer}
              </span></span>
              <span>Correct Answer: <span className="font-medium text-green-600">
                {Array.isArray(question.options) && typeof question.answer === 'number'
                  ? String.fromCharCode(65 + question.answer)
                  : question.answer}
              </span></span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col gap-4 p-4">
          {/* Status Display */}
          <div className="text-center">
            <div className="text-lg mb-2">Status: <span className="font-semibold">{status}</span></div>
          </div>

          {/* Voice Activity Visualization */}
          <div className="flex-1 flex items-center justify-center">
            {!isConnected ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2">
                  <Loader2 className="h-8 w-8" />
                </div>
                <p className="text-sm text-muted-foreground">Connecting to AI tutor...</p>
              </div>
            ) : (
              <div className="text-center space-y-4">
                {/* Audio Level Indicator */}
                <div className={cn(
                  "w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-200",
                  isPlayingRef.current ? "border-blue-500 bg-blue-50" : 
                  isSpeaking ? "border-green-500 bg-green-50" : 
                  "border-gray-300 bg-gray-50"
                )}>
                  {isPlayingRef.current ? (
                    <Volume2 className="h-8 w-8 text-blue-600" />
                  ) : isSpeaking ? (
                    <Mic className="h-8 w-8 text-green-600" />
                  ) : (
                    <Bot className="h-8 w-8 text-gray-600" />
                  )}
                </div>
                
                {/* Audio Level Bar */}
                {isSpeaking && (
                  <div className="w-full max-w-xs mx-auto">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-100"
                        style={{ width: `${audioLevel}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Volume: {Math.round(audioLevel)}%</p>
                  </div>
                )}
                
                {/* Instructions */}
                <div className="text-sm text-gray-600 max-w-xs mx-auto">
                  {isConnected && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>Live conversation active</span>
                      </div>
                      <p>The AI tutor is analyzing your work and will start explaining where you went wrong. Listen first, then respond naturally!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            <Button 
              onClick={onContinuePractice}
              className="flex-1 gap-2"
              disabled={!isConnected}
            >
              <CheckCircle className="h-4 w-4" />
              Continue Practice
            </Button>
            <Button 
              onClick={endConversation}
              variant="outline"
              className="gap-2"
            >
              End Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 