import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // In production, this would send an interrupt signal to Gemini Live API
    console.log('Interrupting Gemini speech...');
    
    return NextResponse.json({ 
      success: true,
      message: 'Gemini speech interrupted'
    });

  } catch (error) {
    console.error('Interrupt failed:', error);
    return NextResponse.json(
      { error: 'Failed to interrupt' },
      { status: 500 }
    );
  }
} 