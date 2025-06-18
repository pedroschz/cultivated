import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '@/lib/utils';
import { 
  Bot, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  ArrowRight,
  CheckCircle,
  Pause,
  Play
} from 'lucide-react';

interface VoiceConversationProps {
  isOpen: boolean;
  questionText: string;
  userAnswer: string | number;
  correctAnswer: string | number;
  thinkingAudio: Blob | null;
  onClose: () => void;
  onContinuePractice: () => void;
  className?: string;
}

export function VoiceConversation({
  isOpen,
  questionText,
  userAnswer,
  correctAnswer,
  thinkingAudio,
  onClose,
  onContinuePractice,
  className
}: VoiceConversationProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const outputAudioRef = useRef<HTMLAudioElement | null>(null);

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && isOpen && !conversationStarted) {
      initializeVoiceSession();
    }
  }, [isClient, isOpen, conversationStarted]);

  // Add debug logging for prop changes
  useEffect(() => {
    console.log('VoiceConversation props changed:', {
      isOpen,
      questionText: questionText.substring(0, 50) + '...',
      userAnswer,
      correctAnswer,
      hasThinkingAudio: !!thinkingAudio,
      conversationStarted,
      isClient
    });
  }, [isOpen, questionText, userAnswer, correctAnswer, thinkingAudio, conversationStarted, isClient]);

  useEffect(() => {
    // Cleanup on unmount or close
    return () => {
      if (isClient && audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (isClient && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isClient]);

  const initializeVoiceSession = async () => {
    if (!isClient) return;
    
    setIsInitializing(true);
    
    try {
      // Start the Gemini voice session with context
      const response = await fetch('/api/voice/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText,
          userAnswer,
          correctAnswer,
          thinkingAudio: thinkingAudio ? await audioToBase64(thinkingAudio) : null
        })
      });

      if (response.ok) {
        setConversationStarted(true);
        console.log('Voice session started successfully');
        
        // For now, directly use fallback since we don't have real Gemini Live API
        // In production, this would start listening for Gemini's audio stream
        setTimeout(() => {
          speakFallbackMessage();
        }, 1000);
      } else {
        throw new Error('Failed to start voice session');
      }
    } catch (error) {
      console.error('Voice session error:', error);
      // Always use fallback message
      setTimeout(() => {
        speakFallbackMessage();
      }, 500);
      setConversationStarted(true);
    } finally {
      setIsInitializing(false);
    }
  };

  const audioToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      if (!isClient || typeof FileReader === 'undefined') {
        resolve('');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  };

  const startListeningForGeminiAudio = () => {
    if (!isClient || typeof Audio === 'undefined') return;
    
    // Create audio element for playback
    outputAudioRef.current = new Audio();
    outputAudioRef.current.onended = () => {
      setIsSpeaking(false);
      // Automatically start listening for user response
      startListening();
    };

    // Start receiving audio stream from WebSocket
    if (typeof WebSocket !== 'undefined') {
      try {
        const ws = new WebSocket(`ws://localhost:3000/api/voice/stream`);
        
        ws.onmessage = (event) => {
          const audioData = JSON.parse(event.data);
          if (audioData.audio) {
            playGeminiAudio(audioData.audio);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsSpeaking(false);
        };
      } catch (error) {
        console.error('WebSocket connection failed:', error);
      }
    }
  };

  const playGeminiAudio = (base64Audio: string) => {
    if (!isClient || !outputAudioRef.current || typeof URL === 'undefined') return;
    
    try {
      const audioBlob = base64ToBlob(base64Audio, 'audio/wav');
      const audioUrl = URL.createObjectURL(audioBlob);
      outputAudioRef.current.src = audioUrl;
      outputAudioRef.current.play();
      setIsSpeaking(true);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    if (!isClient || typeof atob === 'undefined') {
      return new Blob();
    }
    
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
    } catch (error) {
      console.error('Error converting base64 to blob:', error);
      return new Blob();
    }
  };

  const startListening = async () => {
    if (!isClient || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      console.error('Media devices not available');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio level monitoring
      if (typeof AudioContext !== 'undefined') {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const analyser = audioContextRef.current.createAnalyser();
        source.connect(analyser);
        
        monitorAudioLevel(analyser);
      }
      
      // Set up recording
      if (typeof MediaRecorder !== 'undefined') {
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };
        
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          sendVoiceToGemini(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current.start();
        setIsListening(true);
      }
      
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopListening = () => {
    if (!isClient) return;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    setAudioLevel(0);
  };

  const monitorAudioLevel = (analyser: AnalyserNode) => {
    if (!isClient) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(Math.min(100, (average / 255) * 100));
      
      if (isListening) {
        requestAnimationFrame(updateLevel);
      }
    };
    
    updateLevel();
  };

  const sendVoiceToGemini = async (audioBlob: Blob) => {
    if (!isClient) return;
    
    try {
      const base64Audio = await audioToBase64(audioBlob);
      
      const response = await fetch('/api/voice/send-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio })
      });
      
      if (response.ok) {
        setIsSpeaking(true);
      }
    } catch (error) {
      console.error('Error sending voice:', error);
    }
  };

  const interruptGemini = async () => {
    if (!isClient) return;
    
    try {
      await fetch('/api/voice/interrupt', { method: 'POST' });
      
      if (outputAudioRef.current) {
        outputAudioRef.current.pause();
        outputAudioRef.current.currentTime = 0;
      }
      
      setIsSpeaking(false);
      startListening();
    } catch (error) {
      console.error('Error interrupting:', error);
    }
  };

  const speakFallbackMessage = () => {
    if (!isClient || typeof speechSynthesis === 'undefined') return;
    
    const message = `I see you chose ${userAnswer}, but the correct answer is ${correctAnswer}. Let me help you understand where the confusion might be coming from. Can you tell me what made you choose that answer?`;
    
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      startListening();
    };
    
    speechSynthesis.speak(utterance);
  };

  const endConversation = async () => {
    if (!isClient) return;
    
    try {
      await fetch('/api/voice/end-session', { method: 'POST' });
    } catch (error) {
      console.error('Error ending session:', error);
    }
    
    onClose();
  };

  // Don't render anything on server side
  if (!isClient || !isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className={cn("w-full max-w-lg flex flex-col", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              AI Voice Tutor
            </div>
            <div className="flex items-center gap-2">
              {isSpeaking && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Volume2 className="h-4 w-4" />
                  <span className="text-sm">Speaking...</span>
                </div>
              )}
              {isListening && (
                <div className="flex items-center gap-1 text-green-600">
                  <Mic className="h-4 w-4" />
                  <span className="text-sm">Listening...</span>
                </div>
              )}
            </div>
          </CardTitle>
          
          {/* Question Context */}
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p className="text-gray-700 line-clamp-2">{questionText}</p>
            <div className="flex gap-4 mt-2 text-xs">
              <span>Your Answer: <span className="font-medium text-red-600">{userAnswer}</span></span>
              <span>Correct Answer: <span className="font-medium text-green-600">{correctAnswer}</span></span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col gap-4 p-4">
          {/* Voice Activity Visualization */}
          <div className="flex-1 flex items-center justify-center">
            {isInitializing ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Analyzing your thinking...</p>
              </div>
            ) : (
              <div className="text-center space-y-4">
                {/* Audio Level Indicator */}
                <div className={cn(
                  "w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-200",
                  isSpeaking ? "border-blue-500 bg-blue-50" : 
                  isListening ? "border-green-500 bg-green-50" : 
                  "border-gray-300 bg-gray-50"
                )}>
                  {isSpeaking ? (
                    <Volume2 className="h-8 w-8 text-blue-600" />
                  ) : isListening ? (
                    <Mic className="h-8 w-8 text-green-600" />
                  ) : (
                    <Bot className="h-8 w-8 text-gray-600" />
                  )}
                </div>
                
                {/* Audio Level Bar */}
                {isListening && (
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
                
                <div>
                  {isInitializing && (
                    <p className="text-sm text-gray-600">Setting up voice conversation...</p>
                  )}
                  {isSpeaking && (
                    <p className="text-sm text-blue-600">Gemini is explaining the concept</p>
                  )}
                  {isListening && (
                    <p className="text-sm text-green-600">Speak naturally - ask questions or respond</p>
                  )}
                  {!isSpeaking && !isListening && !isInitializing && (
                    <p className="text-sm text-gray-600">Voice conversation ready</p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div className="space-y-3">
            {conversationStarted && (
              <div className="flex gap-2">
                {isSpeaking ? (
                  <Button 
                    onClick={interruptGemini}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    Interrupt & Speak
                  </Button>
                ) : isListening ? (
                  <Button 
                    onClick={stopListening}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <MicOff className="h-4 w-4" />
                    Stop Speaking
                  </Button>
                ) : (
                  <Button 
                    onClick={startListening}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <Mic className="h-4 w-4" />
                    Start Speaking
                  </Button>
                )}
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={onContinuePractice}
                className="flex-1 gap-2"
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 