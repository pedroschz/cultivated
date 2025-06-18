'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function TestVoiceMode() {
  const [isClient, setIsClient] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Ready to connect');
  const [conversationLog, setConversationLog] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const sessionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isStreamingRef = useRef(false);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsClient(true);
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
      logMessage(`Audio track settings: ${JSON.stringify(audioTracks[0].getSettings())}`);
      
      // Set up live audio level monitoring
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      // Test audio levels for 2 seconds initially
      let maxLevel = 0;
      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const level = Math.max(...dataArray);
        maxLevel = Math.max(maxLevel, level);
      };
      
      const interval = setInterval(checkAudio, 100);
      setTimeout(() => {
        clearInterval(interval);
        logMessage(`Microphone test complete. Max audio level detected: ${maxLevel}/255`);
        if (maxLevel < 10) {
          logMessage('WARNING: Very low audio levels detected. Check microphone settings.');
        }
        
        // Start continuous audio level monitoring for UI
        startAudioLevelMonitoring();
      }, 2000);

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

  // New function for starting a tutoring session with context
  const startTutoringSession = async (
    questionText: string,
    userAnswer: string,
    correctAnswer: string,
    thinkingAudio: Blob | null
  ) => {
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

      // Dynamic import of the Google GenAI SDK with proper ES module handling
      const GoogleGenAIModule = await import('@google/genai');
      const { GoogleGenAI, Modality } = GoogleGenAIModule;
      
      const ai = new GoogleGenAI({ apiKey });
      
      // Create tutoring-specific system instruction
      const systemInstruction = `You are an expert SAT tutor helping a student who just got a question wrong. 

Question: ${questionText}
Student's Answer: ${userAnswer}
Correct Answer: ${correctAnswer}

The student has just recorded their thinking process while solving this question. Listen carefully to their reasoning and:

1. Acknowledge what you heard in their thinking process
2. Identify where their reasoning went wrong
3. Gently guide them to the correct approach
4. Be encouraging and supportive
5. Keep responses conversational and under 30 seconds
6. Ask follow-up questions to ensure they understand

Start by saying something like "I listened to your thinking process, and I can see that you..." then proceed with your tutoring.`;

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
                  setStatus('Tutoring session active - Speak naturally!');
                }, 1000);
                
              } catch (error) {
                logMessage(`Error sending thinking audio: ${error}`);
                // Still start the conversation even if context fails
                startContinuousAudioStreaming(stream);
                setStatus('Tutoring session active - Speak naturally!');
              }
            } else {
              logMessage('No thinking audio available, starting conversation directly');
              // Send a text message to start the conversation without audio context
              await sessionInstance?.sendClientContent({
                turns: [{
                  role: "user",
                  parts: [{ text: "I just got this question wrong and I'm not sure why. Can you help me understand where I went wrong?" }]
                }],
                turnComplete: true
              });
              
              startContinuousAudioStreaming(stream);
              setStatus('Tutoring session active - Speak naturally!');
            }
          },
          
          onmessage: (message: any) => {
            // Same message handling as the regular session
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
            
            // Handle audio response
            if (message.data) {
              playAudioData(message.data);
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

  const startVoiceSession = async () => {
    try {
      setStatus('Connecting...');
      logMessage('Starting voice session...');

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not found');
      }

      // Initialize audio
      const stream = await initializeAudio();
      if (!stream) {
        throw new Error('Failed to initialize audio');
      }

      // Dynamic import of the Google GenAI SDK with proper ES module handling
      const GoogleGenAIModule = await import('@google/genai');
      const { GoogleGenAI, Modality } = GoogleGenAIModule;
      
      const ai = new GoogleGenAI({ apiKey });
      
      const config = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "You are a helpful and friendly AI assistant. Wait for the user to speak first, then respond naturally and conversationally. Keep your responses concise and engaging.",
      };

      logMessage('Creating Gemini Live session...');
      
      // Create the session and assign it immediately
      const session = await ai.live.connect({
        model: 'gemini-2.0-flash-live-001',
        config: config,
        callbacks: {
          onopen: () => {
            logMessage('Connected to Gemini Live!');
            setIsConnected(true);
            setStatus('Connected - Waiting for setup...');
            
            // Start audio streaming now that session is established
            logMessage('Starting audio streaming with established session...');
            logMessage(`Session check: sessionRef.current exists = ${!!sessionRef.current}`);
            startContinuousAudioStreaming(stream);
          },
          
          onmessage: (message: any) => {
            // Only log the message type, not the full audio data
            if (message.data) {
              logMessage(`Received audio data: ${message.data.length} characters`);
            } else {
              logMessage(`Received message: ${JSON.stringify(message, null, 2)}`);
            }
            
            if (message.setupComplete) {
              logMessage('Setup completed successfully - ready for voice input');
              logMessage('Please speak to start the conversation...');
              setStatus('Ready - Please speak to start conversation');
            }
            
            if (message.serverContent?.interrupted) {
              logMessage('Interruption detected - clearing audio queue');
              // Clear audio queue when interrupted
              audioQueueRef.current = [];
              isPlayingRef.current = false;
            }
            
            if (message.serverContent?.turnComplete) {
              logMessage('Turn completed - AI finished speaking');
            }
            
            if (message.serverContent?.modelTurn) {
              logMessage('Model turn detected');
            }
            
            // Handle audio response
            if (message.data) {
              logMessage('Playing received audio data');
              playAudioData(message.data);
            }
            
            // Log any text responses
            if (message.text) {
              logMessage(`Received text: ${message.text}`);
            }
          },
          
          onerror: (error: any) => {
            logMessage(`Connection error: ${error.message || error}`);
            setIsConnected(false);
            setStatus('Error occurred');
          },
          
          onclose: (event: any) => {
            logMessage(`Connection closed: ${event.reason || 'Unknown reason'}`);
            setIsConnected(false);
            setStatus('Disconnected');
            isStreamingRef.current = false;
          }
        }
      });

      // Assign the session reference AFTER the connection is established
      sessionRef.current = session;
      logMessage(`Session assigned: sessionRef.current exists = ${!!sessionRef.current}`);

    } catch (error) {
      logMessage(`Failed to connect: ${error}`);
      setStatus('Failed to connect');
      setIsConnected(false);
    }
  };

  const startContinuousAudioStreaming = (stream: MediaStream) => {
    try {
      isStreamingRef.current = true;
      
      logMessage('Setting up direct PCM audio streaming...');
      
      // Check if the stream has active tracks
      const audioTracks = stream.getAudioTracks();
      logMessage(`Stream has ${audioTracks.length} audio tracks`);
      audioTracks.forEach((track, index) => {
        logMessage(`Track ${index}: ${track.label}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
      });
      
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
          logMessage(`Sending PCM audio chunk ${chunkCount} (${base64PCM.length} chars)`);
          
          // Send real-time audio input to Gemini
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
      
      // Connect the audio processing chain
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      logMessage('Direct PCM audio streaming started successfully');
      
      // Store references for cleanup
      audioContextRef.current = audioContext;
      
    } catch (error) {
      logMessage(`Failed to start audio streaming: ${error}`);
    }
  };

  const stopVoiceSession = () => {
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
      logMessage('Voice session stopped');
    } catch (error) {
      logMessage(`Error stopping session: ${error}`);
    }
  };

  if (!isClient) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Gemini Live Voice Test</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <div className="text-lg mb-4">Status: <span className="font-semibold">{status}</span></div>
            
            <div className="space-x-4">
              <button
                onClick={startVoiceSession}
                disabled={isConnected}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg disabled:bg-gray-400 hover:bg-blue-600 transition-colors"
              >
                Start Voice Session
              </button>
              
              <button
                onClick={stopVoiceSession}
                disabled={!isConnected}
                className="px-6 py-3 bg-red-500 text-white rounded-lg disabled:bg-gray-400 hover:bg-red-600 transition-colors"
              >
                Stop Session
              </button>
              
              <button
                onClick={() => {
                  if (sessionRef.current) {
                    logMessage('Sending test message...');
                    sessionRef.current.sendClientContent({
                      turns: [{
                        role: "user",
                        parts: [{ text: "Can you hear me? Please respond." }]
                      }],
                      turnComplete: true
                    });
                  }
                }}
                disabled={!isConnected}
                className="px-6 py-3 bg-green-500 text-white rounded-lg disabled:bg-gray-400 hover:bg-green-600 transition-colors"
              >
                Send Test Message
              </button>
              
              <button
                onClick={() => {
                  // Test tutoring session with mock data
                  const mockQuestion = "If 2x + 3 = 11, what is the value of x?";
                  const mockUserAnswer = "x = 7";
                  const mockCorrectAnswer = "x = 4";
                  
                  startTutoringSession(mockQuestion, mockUserAnswer, mockCorrectAnswer, null);
                }}
                disabled={isConnected}
                className="px-6 py-3 bg-purple-500 text-white rounded-lg disabled:bg-gray-400 hover:bg-purple-600 transition-colors"
              >
                Test Tutoring Mode
              </button>
            </div>
          </div>

          {/* Audio Level Visualizer */}
          {isConnected && (
            <div className="mb-6">
              <div className="text-center mb-4">
                <div className="inline-flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-800 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live conversation active - speak naturally!</span>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3 text-center">Microphone Level</h3>
                
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                  <span className="text-sm">{isSpeaking ? 'Speaking detected' : 'Listening...'}</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-100 ${
                      audioLevel > 30 ? 'bg-green-500' : 
                      audioLevel > 15 ? 'bg-yellow-500' : 
                      audioLevel > 5 ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(audioLevel, 100)}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Silent</span>
                  <span className="font-mono">{audioLevel.toFixed(1)}%</span>
                  <span>Loud</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Session Log</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {conversationLog.length === 0 ? (
              <p className="text-gray-500 italic">No messages yet...</p>
            ) : (
              conversationLog.map((log, index) => (
                <div key={index} className="text-sm font-mono bg-gray-50 p-2 rounded">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>This test page demonstrates continuous live conversation with Gemini.</p>
          <p>No manual recording controls - just natural conversation flow!</p>
        </div>
      </div>
    </div>
  );
}