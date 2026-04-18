import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';

/**
 * Creates a new AssemblyAI transcription job. Body must include the
 * `upload_url` previously returned from `/api/assemblyai/upload`, plus any
 * extra options forwarded as-is (`format_text`, `punctuate`, etc.).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AssemblyAI key missing on server (ASSEMBLYAI_API_KEY)' },
        { status: 500 },
      );
    }

    const body = await req.json();
    if (!body?.audio_url) {
      return NextResponse.json({ error: 'audio_url is required' }, { status: 400 });
    }

    const upstream = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Create transcript failed', status: upstream.status, body: text },
        { status: 502 },
      );
    }
    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in /api/assemblyai/transcript:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
