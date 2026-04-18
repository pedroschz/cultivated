import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyAuth } from '@/lib/api-auth';
import { assertWithinLimits, getGeminiKeyForUser, recordTokenCost } from '@/lib/ai/aiUsageServer';

export const dynamic = "force-static";


export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const uid = user.uid;
    const aiState = await assertWithinLimits(uid);

    const { transcript } = await req.json();
    if (!transcript) {
        return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    const MODEL_ID = 'gemini-2.0-flash';
    const apiKey = getGeminiKeyForUser(aiState, process.env.GEMINI_API_KEY || '');
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key missing on server' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    const instruction = 'Return the key takeaways as short phrases separated by commas. No numbering or quotes.';
    const prompt = `${instruction}\n\nTranscript:\n${transcript}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const notes = text ? text.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

    recordTokenCost(uid, MODEL_ID, (response as any).usageMetadata);

    return NextResponse.json({ notes });

  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message === 'AI_LIMIT_REACHED') {
      return NextResponse.json({ error: 'AI_LIMIT_REACHED', reasons: error.reasons || [] }, { status: 402 });
    }
    console.error('Error generating notes:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
