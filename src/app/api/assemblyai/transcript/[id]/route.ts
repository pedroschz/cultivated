import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';

// No static paths to pre-render for this dynamic API route.
// In static-export mode the route is served via Firebase Functions.
export function generateStaticParams() {
  return [];
}

/**
 * Polls the status of an AssemblyAI transcription job by id.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid transcript id' }, { status: 400 });
    }

    const upstream = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { Authorization: apiKey },
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Poll failed', status: upstream.status, body: text },
        { status: 502 },
      );
    }
    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in /api/assemblyai/transcript/[id]:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
