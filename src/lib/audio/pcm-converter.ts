/**
 * Audio conversion utilities for Gemini Live API
 * Handles conversion between WebM/Opus and 16-bit PCM at 16kHz
 */

export class PCMConverter {
  private audioContext: AudioContext | null = null;

  constructor() {
    if (typeof AudioContext !== 'undefined') {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
    }
  }

  /**
   * Convert WebM/Opus audio blob to 16-bit PCM at 16kHz
   */
  async convertToPCM(audioBlob: Blob): Promise<ArrayBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    try {
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode the audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Resample to 16kHz if needed
      const targetSampleRate = 16000;
      let resampledBuffer = audioBuffer;
      
      if (audioBuffer.sampleRate !== targetSampleRate) {
        resampledBuffer = await this.resampleAudioBuffer(audioBuffer, targetSampleRate);
      }
      
      // Convert to mono if stereo
      const monoBuffer = this.convertToMono(resampledBuffer);
      
      // Convert to 16-bit PCM
      const pcmData = this.audioBufferToPCM16(monoBuffer);
      
      return pcmData;
    } catch (error) {
      console.error('Error converting to PCM:', error);
      throw error;
    }
  }

  /**
   * Convert 24kHz PCM data from Gemini to AudioBuffer for playback
   */
  async convertFromPCM(pcmData: ArrayBuffer, sampleRate: number = 24000): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    try {
      // PCM data is 16-bit signed integers
      const pcm16Array = new Int16Array(pcmData);
      const floatArray = new Float32Array(pcm16Array.length);
      
      // Convert 16-bit PCM to float32 (-1.0 to 1.0)
      for (let i = 0; i < pcm16Array.length; i++) {
        floatArray[i] = pcm16Array[i] / 32768.0;
      }
      
      // Create AudioBuffer
      const audioBuffer = this.audioContext.createBuffer(1, floatArray.length, sampleRate);
      audioBuffer.getChannelData(0).set(floatArray);
      
      return audioBuffer;
    } catch (error) {
      console.error('Error converting from PCM:', error);
      throw error;
    }
  }

  /**
   * Resample audio buffer to target sample rate
   */
  private async resampleAudioBuffer(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    const ratio = targetSampleRate / audioBuffer.sampleRate;
    const newLength = Math.round(audioBuffer.length * ratio);
    
    // Create offline context for resampling
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      newLength,
      targetSampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    return await offlineContext.startRendering();
  }

  /**
   * Convert stereo AudioBuffer to mono
   */
  private convertToMono(audioBuffer: AudioBuffer): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    if (audioBuffer.numberOfChannels === 1) {
      return audioBuffer;
    }

    // Create mono buffer
    const monoBuffer = this.audioContext.createBuffer(
      1,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const monoData = monoBuffer.getChannelData(0);
    
    if (audioBuffer.numberOfChannels === 2) {
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.getChannelData(1);
      
      // Average left and right channels
      for (let i = 0; i < audioBuffer.length; i++) {
        monoData[i] = (leftChannel[i] + rightChannel[i]) / 2;
      }
    } else {
      // For more than 2 channels, just use the first channel
      const firstChannel = audioBuffer.getChannelData(0);
      monoData.set(firstChannel);
    }
    
    return monoBuffer;
  }

  /**
   * Convert AudioBuffer to 16-bit PCM
   */
  private audioBufferToPCM16(audioBuffer: AudioBuffer): ArrayBuffer {
    const floatArray = audioBuffer.getChannelData(0);
    const pcm16Array = new Int16Array(floatArray.length);
    
    // Convert float32 (-1.0 to 1.0) to 16-bit signed integers
    for (let i = 0; i < floatArray.length; i++) {
      const sample = Math.max(-1, Math.min(1, floatArray[i]));
      pcm16Array[i] = Math.round(sample * 32767);
    }
    
    return pcm16Array.buffer;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
} 