import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';

export const dynamic = "force-static";


/**
 * Streams a raw audio body to AssemblyAI's /v2/upload endpoint and returns the
 * resulting `upload_url`. Keeps `ASSEMBLYAI_API_KEY` server-side.
 *
 * Client should POST the audio Blob with `Content-Type: application/octet-stream`
 * (or any binary content type) and an `Authorization: Bearer <Firebase ID
 * token>` header. The body is forwarded as-is to AssemblyAI.
 */
export const runtime = 'nodejs';

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

    const audio = await req.arrayBuffer();
    if (!audio || audio.byteLength === 0) {
      return NextResponse.json({ error: 'Empty audio body' }, { status: 400 });
    }

    const upstream = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: { Authorization: apiKey },
      body: Buffer.from(audio),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Upload failed', status: upstream.status, body: text },
        { status: 502 },
      );
    }
    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in /api/assemblyai/upload:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
