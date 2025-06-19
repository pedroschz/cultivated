import { NextRequest, NextResponse } from 'next/server';

let activeSession: any = null;

export async function POST(request: NextRequest) {
  try {
    const body: Record<string, unknown> = await request.json();

    // End any existing session
    if (activeSession) {
      try {
        activeSession.close();
      } catch (error) {
        console.log('Error closing previous session:', error);
      }
    }

    const systemInstruction = `You are an expert SAT tutor. A student just answered a question incorrectly and I have their thinking process recorded. 

Question: ${body.questionText}
Student's Answer: ${body.userAnswer}
Correct Answer: ${body.correctAnswer}

Your job is to:
1. Listen to their thinking process audio and understand where they went wrong
2. Start a natural voice conversation to help them understand the mistake
3. Be encouraging and supportive
4. Explain concepts step-by-step
5. Respond naturally to their questions and clarifications
6. Keep responses conversational and under 30 seconds each

Start by acknowledging what you heard in their thinking and gently guiding them to the correct approach.`;

    // Mock implementation for now - in production use actual Gemini Live API
    // This simulates the session startup
    activeSession = {
      id: Date.now().toString(),
      systemInstruction,
      thinkingAudio: body.thinkingAudio,
      isActive: true
    };

    // Simulate starting the conversation
    setTimeout(() => {
      // This would normally be handled by Gemini Live API WebSocket
      console.log('Voice session started with context');
    }, 1000);

    return NextResponse.json({ 
      success: true, 
      sessionId: activeSession.id 
    });

  } catch (error) {
    console.error('Voice session startup failed:', error);
    return NextResponse.json(
      { error: 'Failed to start voice session' },
      { status: 500 }
    );
  }
} 