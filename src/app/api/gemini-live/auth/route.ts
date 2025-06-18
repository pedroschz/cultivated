import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // For Gemini Live API, we need to provide the WebSocket URL with authentication
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    
    return NextResponse.json({
      wsUrl,
      success: true
    });

  } catch (error) {
    console.error('Error setting up Gemini Live auth:', error);
    return NextResponse.json(
      { error: 'Failed to setup authentication' },
      { status: 500 }
    );
  }
} 