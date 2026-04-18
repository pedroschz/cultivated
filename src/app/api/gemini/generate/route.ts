import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { verifyAuth } from '@/lib/api-auth';
import { assertWithinLimits, getGeminiKeyForUser, recordTokenCost } from '@/lib/ai/aiUsageServer';

/**
 * Generic server-side proxy for one-shot `models.generateContent` calls so the
 * browser never needs the project's Gemini API key. Used by the procedure
 * canvas (handwriting OCR + analysis).
 *
 * Body shape:
 *   {
 *     model?: string,
 *     contents: any,           // forwarded as-is to GoogleGenAI
 *     config?: any,            // e.g. { responseMimeType: 'application/json' }
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const uid = user.uid;
    const aiState = await assertWithinLimits(uid);

    const { model, contents, config } = await req.json();
    if (!contents) {
      return NextResponse.json({ error: 'contents is required' }, { status: 400 });
    }
    const MODEL_ID: string = model || 'gemini-2.5-flash-lite';

    const apiKey = getGeminiKeyForUser(aiState, process.env.GEMINI_API_KEY || '');
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key missing on server' }, { status: 500 });
    }

    const client: any = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });

    const result: any = await client.models.generateContent({
      model: MODEL_ID,
      contents,
      config,
    });

    try {
      recordTokenCost(uid, MODEL_ID, result?.usageMetadata);
    } catch {}

    return NextResponse.json({ result });
  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message === 'AI_LIMIT_REACHED') {
      return NextResponse.json(
        { error: 'AI_LIMIT_REACHED', reasons: error.reasons || [] },
        { status: 402 },
      );
    }
    console.error('Error in /api/gemini/generate:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
