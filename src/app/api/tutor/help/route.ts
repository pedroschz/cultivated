import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyAuth } from '@/lib/api-auth';
import { assertWithinLimits, getGeminiKeyForUser, recordTokenCost } from '@/lib/ai/aiUsageServer';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const uid = user.uid;
    const aiState = await assertWithinLimits(uid);

    const { questionContext, passageContext, selectedText, studentRegion } = await req.json();

    const MODEL_ID = 'gemini-2.0-flash';
    const apiKey = getGeminiKeyForUser(aiState, process.env.GEMINI_API_KEY || '');
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key missing on server' }, { status: 500 });
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
    if (words.length > 40) text = words.slice(0, 40).join(' ') + '…';

    recordTokenCost(uid, MODEL_ID, (response as any).usageMetadata);

    return NextResponse.json({ text });

  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message === 'AI_LIMIT_REACHED') {
      return NextResponse.json({ error: 'AI_LIMIT_REACHED', reasons: error.reasons || [] }, { status: 402 });
    }
    console.error('Error generating help text:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
