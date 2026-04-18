import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { assertWithinLimits, getGeminiKeyForUser } from '@/lib/ai/aiUsageServer';

export const dynamic = "force-static";


/**
 * Mints a short-lived ephemeral Gemini auth token for the Live API so the
 * browser can open the WebSocket directly to Google without ever seeing the
 * project's `GEMINI_API_KEY`.
 *
 * Returned `token` is meant to be passed as `apiKey` to a browser-side
 * `GoogleGenAI` client; it expires after a short window (configured below).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const uid = user.uid;

    const aiState = await assertWithinLimits(uid);
    const apiKey = getGeminiKeyForUser(aiState, process.env.GEMINI_API_KEY || '');
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key missing on server' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    const model: string =
      body?.model || 'gemini-2.5-flash-native-audio-preview-12-2025';

    const { GoogleGenAI } = await import('@google/genai');
    const client: any = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });

    if (!client?.authTokens?.create) {
      return NextResponse.json(
        { error: 'authTokens API unavailable in installed @google/genai version' },
        { status: 500 },
      );
    }

    const nowMs = Date.now();
    const expireMs = nowMs + 30 * 60 * 1000;
    const newSessionExpireMs = nowMs + 60 * 1000;

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(expireMs).toISOString(),
        newSessionExpireTime: new Date(newSessionExpireMs).toISOString(),
        liveConnectConstraints: { model },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    const tokenName: string | undefined =
      typeof token === 'string' ? token : token?.name;
    if (!tokenName) {
      return NextResponse.json({ error: 'Failed to mint ephemeral token' }, { status: 500 });
    }

    return NextResponse.json({
      token: tokenName,
      expiresAt: expireMs,
      sessionExpiresAt: newSessionExpireMs,
      model,
    });
  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message === 'AI_LIMIT_REACHED') {
      return NextResponse.json(
        { error: 'AI_LIMIT_REACHED', reasons: error.reasons || [] },
        { status: 402 },
      );
    }
    console.error('Error minting Gemini live token:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
