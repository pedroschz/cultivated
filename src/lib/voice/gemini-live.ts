import { GoogleGenAI, Modality } from '@google/genai';

interface VoiceSessionConfig {
  questionText: string;
  userAnswer: string | number;
  correctAnswer: string | number;
  thinkingAudio: Blob;
  onAudioReceived: (audioData: string) => void;
  onConversationEnd: () => void;
}

export class GeminiVoiceSession {
  private session: any = null;
  private ai: GoogleGenAI;
  private responseQueue: any[] = [];
  private isActive = false;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async startTutorSession(config: VoiceSessionConfig) {
    if (this.isActive) {
      await this.endSession();
    }

    this.isActive = true;
    this.responseQueue = [];

    // Convert thinking audio to required format
    const thinkingAudioData = await this.convertAudioToFormat(config.thinkingAudio);

    // Build tutoring context prompt
    const systemInstruction = `You are an expert SAT tutor. A student just answered a question incorrectly and I have their thinking process recorded. 

Question: ${config.questionText}
Student's Answer: ${config.userAnswer}
Correct Answer: ${config.correctAnswer}

Your job is to:
1. Listen to their thinking process audio and understand where they went wrong
2. Start a natural voice conversation to help them understand the mistake
3. Be encouraging and supportive
4. Explain concepts step-by-step
5. Respond naturally to their questions and clarifications
6. Keep responses conversational and under 30 seconds each

Start by acknowledging what you heard in their thinking and gently guiding them to the correct approach.`;

    try {
      this.session = await this.ai.live.connect({
        model: "gemini-2.5-flash-preview-native-audio-dialog",
        callbacks: {
          onopen: () => {
            console.log('Voice session started');
          },
          onmessage: (message: any) => {
            this.handleMessage(message, config.onAudioReceived);
          },
          onerror: (error: any) => {
            console.error('Voice session error:', error);
          },
          onclose: () => {
            console.log('Voice session ended');
            this.isActive = false;
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
        },
      });

      // Send the student's thinking audio
      await this.session.sendRealtimeInput({
        audio: {
          data: thinkingAudioData,
          mimeType: "audio/pcm;rate=16000"
        }
      });

    } catch (error) {
      console.error('Failed to start voice session:', error);
      this.isActive = false;
      throw error;
    }
  }

  private handleMessage(message: any, onAudioReceived: (audioData: string) => void) {
    if (message.data) {
      // Stream audio data as it comes in
      onAudioReceived(message.data);
    }
  }

  async sendVoiceInput(audioBlob: Blob) {
    if (!this.session || !this.isActive) {
      throw new Error('No active voice session');
    }

    const audioData = await this.convertAudioToFormat(audioBlob);
    
    await this.session.sendRealtimeInput({
      audio: {
        data: audioData,
        mimeType: "audio/pcm;rate=16000"
      }
    });
  }

  async interrupt() {
    if (!this.session || !this.isActive) return;
    
    // Send interrupt signal to stop current audio generation
    await this.session.sendRealtimeInput({
      text: "[INTERRUPT]"
    });
  }

  async endSession() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this.isActive = false;
    this.responseQueue = [];
  }

  private async convertAudioToFormat(audioBlob: Blob): Promise<string> {
    // Convert audio blob to the required format (16-bit PCM, 16kHz, mono)
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // For now, we'll assume the audio is in a compatible format
    // In production, you'd use a library like librosa.js or similar to convert
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    return base64Audio;
  }

  isSessionActive(): boolean {
    return this.isActive;
  }
}

export const geminiVoiceSession = new GeminiVoiceSession(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
); 