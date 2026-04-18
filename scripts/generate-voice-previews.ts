/*
  Generates short TTS preview files for all supported voices and saves them
  to public/tts-previews/<voice>.wav. Requires GEMINI_API_KEY (server-only).
*/

import { mkdir, writeFile, access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
// Load env vars from .env.local (Next.js convention) or fallback to .env
import { config as dotenvConfig } from 'dotenv';
try { dotenvConfig({ path: '.env.local' }); } catch {}
try { dotenvConfig(); } catch {}

async function ensureDir(path: string) {
  try {
    await access(path, fsConstants.F_OK);
  } catch {
    await mkdir(path, { recursive: true });
  }
}

function slugifyVoice(voice: string): string {
  return voice.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// Build a WAV buffer from PCM Int16 mono @ 24kHz
function pcmInt16ToWav(int16: Int16Array, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = int16.length * 2; // 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4); // ChunkSize
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // PCM data
  for (let i = 0; i < int16.length; i++) {
    buffer.writeInt16LE(int16[i], 44 + i * 2);
  }

  return buffer;
}

async function generateForVoice(ai: any, voiceName: string, outDir: string) {
  const fileSlug = slugifyVoice(voiceName);
  const outPath = `${outDir}/${fileSlug}.wav`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text: "Hi, I'm your CultivatED tutor!" }] }],
    config: {
      responseModalities: ['AUDIO'],
      // speechConfig: {
      //   voiceConfig: {
      //     prebuiltVoiceConfig: { voiceName }
      //   }
      // }
    }
  });

  const dataB64 = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!dataB64) throw new Error(`No audio data returned for ${voiceName}`);

  const binary = Buffer.from(dataB64, 'base64');
  // Convert to Int16 array for WAV encoding
  const int16 = new Int16Array(binary.buffer, binary.byteOffset, Math.floor(binary.byteLength / 2));
  const wav = pcmInt16ToWav(int16);
  await writeFile(outPath, wav);
  console.log(`Saved ${voiceName} -> ${outPath}`);
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });

  const outDir = 'public/tts-previews';
  await ensureDir(outDir);

  const voices = [
    'Zephyr','Charon','Leda','Umbriel','Rasalgethi','Laomedeia','Schedar','Gacrux'
  ];
//'Kore','Fenrir','Puck','Aoede','Callirrhoe','Orus','Autonoe','Alnilam'
  for (const v of voices) {
    try {
      await generateForVoice(ai, v, outDir);
    } catch (e) {
      console.warn(`Failed to generate ${v}:`, (e as any)?.message || e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


