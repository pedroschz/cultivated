import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { assertWithinLimits, getGeminiKeyForUser, recordTokenCost } from './lib/aiUsage';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

async function extractUidFromRequest(req: any): Promise<string | null> {
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '');
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export const tutorHelpApi = onRequest({ secrets: [GEMINI_API_KEY], cors: true }, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const uid = await extractUidFromRequest(req);
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const aiState = await assertWithinLimits(uid);

    const { questionContext, passageContext, selectedText, studentRegion } = (req.body || {}) as {
      questionContext?: string;
      passageContext?: string;
      selectedText?: string;
      studentRegion?: string;
    };

    const MODEL_ID = 'gemini-2.0-flash';
    const apiKey = getGeminiKeyForUser(aiState, GEMINI_API_KEY.value());
    if (!apiKey) {
      res.status(500).json({ error: 'API Key missing on server' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    const q = (questionContext || '').trim();
    const p = (passageContext || '').trim();
    const sel = (selectedText || '').trim();
    const region = (studentRegion || '').trim();

    const prompt = [
      'TASK: In ≤40 words, choose ONE path based on what helps most. Plain text only, no quotes, no lists.',
      '- Definition path: If the SELECTED TEXT is likely an unfamiliar term/name to a student from the specified region, provide a brief, region-aware definition in simple words.',
      '- Context path: Otherwise, explain its role/significance in this passage/question (function, relationship, evidence, contrast, cause/effect).',
      'Start your answer with exactly "Definition:" or "Context:" accordingly. Avoid redundancy. Prefer what is most useful for this student.',
      region ? `Student region: ${region}. Adjust for likely background knowledge and avoid region-specific assumptions.` : '',
      q ? `Question: ${q}` : '',
      p ? `Passage: ${p}` : '',
      sel ? `Selected text: ${sel}` : '',
    ].filter(Boolean).join('\n');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text() || '';

    const words = text.trim().split(/\s+/);
    if (words.length > 40) text = `${words.slice(0, 40).join(' ')}…`;

    recordTokenCost(uid, MODEL_ID, response.usageMetadata as any);

    res.status(200).json({ text });
  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message === 'AI_LIMIT_REACHED') {
      res.status(402).json({ error: 'AI_LIMIT_REACHED', reasons: error.details?.reasons || [] });
      return;
    }
    res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
});

export const tutorNotesApi = onRequest({ secrets: [GEMINI_API_KEY], cors: true }, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const uid = await extractUidFromRequest(req);
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const aiState = await assertWithinLimits(uid);

    const { transcript } = (req.body || {}) as { transcript?: string };
    if (!transcript) {
      res.status(400).json({ error: 'Transcript is required' });
      return;
    }

    const MODEL_ID = 'gemini-2.0-flash';
    const apiKey = getGeminiKeyForUser(aiState, GEMINI_API_KEY.value());
    if (!apiKey) {
      res.status(500).json({ error: 'API Key missing on server' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    const instruction = 'Return the key takeaways as short phrases separated by commas. No numbering or quotes.';
    const prompt = `${instruction}\n\nTranscript:\n${transcript}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const notes = text ? text.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

    recordTokenCost(uid, MODEL_ID, response.usageMetadata as any);

    res.status(200).json({ notes });
  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message === 'AI_LIMIT_REACHED') {
      res.status(402).json({ error: 'AI_LIMIT_REACHED', reasons: error.details?.reasons || [] });
      return;
    }
    res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
});
