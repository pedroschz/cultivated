import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAuth } from 'firebase-admin/auth';
import { assertWithinLimits, getGeminiKeyForUser, recordChatMessage, recordTokenCost, type AiState } from './lib/aiUsage';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const TOOLS = [{
  functionDeclarations: [{
    name: 'ask_question',
    description: 'Ask the user a question with specific options to choose from.',
    parameters: {
      type: 'OBJECT' as any,
      properties: {
        text: { type: 'STRING' as any, description: 'The question text to display.' },
        options: {
          type: 'ARRAY' as any,
          items: { type: 'STRING' as any },
          description: 'List of options for the user to choose from.',
        },
        allow_other: { type: 'BOOLEAN' as any, description: 'Whether to allow the user to type a custom answer.' },
      },
      required: ['text', 'options'],
    },
  }],
}];

type ChatHistoryItem = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

type ChatInput = {
  message?: unknown;
  history?: unknown;
  systemInstruction?: unknown;
};

async function runChatTutor(data: ChatInput, uid: string, aiState: AiState) {
  const { message, history, systemInstruction } = (data || {}) as {
    message?: unknown;
    history?: unknown;
    systemInstruction?: unknown;
  };

  if (typeof message !== 'string' || !message.trim()) {
    throw new HttpsError('invalid-argument', 'Message is required and must be a string');
  }

  if (systemInstruction !== undefined && typeof systemInstruction !== 'string') {
    throw new HttpsError('invalid-argument', 'systemInstruction must be a string when provided');
  }

  const safeHistory: ChatHistoryItem[] = Array.isArray(history)
    ? history
      .filter((item: any) => item?.role === 'user' || item?.role === 'model')
      .map((item: any) => ({
        role: item.role,
        parts: Array.isArray(item.parts) && typeof item.parts?.[0]?.text === 'string'
          ? [{ text: item.parts[0].text }]
          : [{ text: '' }],
      }))
    : [];

  const apiKey = getGeminiKeyForUser(aiState, GEMINI_API_KEY.value());
  if (!apiKey) {
    throw new HttpsError('internal', 'API key not configured');
  }

  const MODEL_ID = 'gemini-2.0-flash';

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      tools: TOOLS,
      systemInstruction: systemInstruction ? {
        role: 'system',
        parts: [{ text: systemInstruction }],
      } : undefined,
    });

    const chat = model.startChat({
      history: safeHistory,
    });

    const result = await chat.sendMessage(message);
    const response = result.response;

    const text = response.text() || '';
    const calls = response.functionCalls();
    const functionCalls = calls ? calls.map((call) => ({
      name: call.name,
      args: call.args,
    })) : [];

    // Record usage (best-effort, never blocks)
    recordChatMessage(uid);
    recordTokenCost(uid, MODEL_ID, response.usageMetadata as any);

    return { text, functionCalls };
  } catch (error: any) {
    throw new HttpsError('internal', error?.message || 'Failed to call chat tutor');
  }
}

export const chatTutor = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = request.auth.uid;
  const aiState = await assertWithinLimits(uid);
  return runChatTutor(request.data as ChatInput, uid, aiState);
});

// Compatibility endpoint for legacy clients still calling /api/chat.
export const chatApi = onRequest({ secrets: [GEMINI_API_KEY], cors: true }, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    // Extract and verify Bearer token
    const authHeader = String(req.headers?.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const aiState = await assertWithinLimits(uid);
    const body = (req.body || {}) as ChatInput;
    const result = await runChatTutor(body, uid, aiState);
    res.status(200).json(result);
  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message === 'AI_LIMIT_REACHED') {
      res.status(402).json({ error: 'AI_LIMIT_REACHED', reasons: error.details?.reasons || [], text: '', functionCalls: [] });
      return;
    }
    const message = error?.message || 'Internal error';
    const statusCode = typeof error?.code === 'string' && error.code === 'invalid-argument' ? 400 : 500;
    res.status(statusCode).json({ error: message, text: '', functionCalls: [] });
  }
});
