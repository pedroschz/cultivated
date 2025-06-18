import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // In production, this would properly close the Gemini Live API session
    console.log('Ending Gemini voice session...');
    
    return NextResponse.json({ 
      success: true,
      message: 'Voice session ended'
    });

  } catch (error) {
    console.error('Session end failed:', error);
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    );
  }
} 