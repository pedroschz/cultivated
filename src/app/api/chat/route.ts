import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyAuth } from '@/lib/api-auth';
import { assertWithinLimits, getGeminiKeyForUser, recordChatMessage, recordTokenCost } from '@/lib/ai/aiUsageServer';

// Define the tool definition here to keep it secure and consistent
const TOOLS = [{
  functionDeclarations: [{
    name: "ask_question",
    description: "Ask the user a question with specific options to choose from.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        text: { type: "STRING" as any, description: "The question text to display." },
        options: { 
          type: "ARRAY" as any, 
          items: { type: "STRING" as any }, 
          description: "List of options for the user to choose from." 
        },
        allow_other: { type: "BOOLEAN" as any, description: "Whether to allow the user to type a custom answer." }
      },
      required: ["text", "options"]
    }
  }]
}];

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Authentication (Optional based on requirements, but good practice)
    // The frontend should send the token if the user is logged in.
    // If we want to allow guest access (e.g. some parts of the site), we might skip this or make it optional.
    // For now, let's try to verify if a token is present, but proceed if it's a valid use case.
    // However, since this calls a paid API, we should strictly require auth if possible.
    // The previous code used `auth.currentUser`, so a user is likely logged in.
    
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const uid = user.uid;

    const aiState = await assertWithinLimits(uid);

    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { message, history, systemInstruction } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required and must be a string' }, { status: 400 });
    }

    const MODEL_ID = 'gemini-2.0-flash';
    const apiKey = getGeminiKeyForUser(aiState, process.env.GEMINI_API_KEY || '');
    if (!apiKey) {
      console.error('GEMINI_API_KEY is missing');
      return NextResponse.json({ error: 'API Key missing on server' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: MODEL_ID,
      tools: TOOLS,
      systemInstruction: systemInstruction ? {
        role: 'system',
        parts: [{ text: systemInstruction }]
      } : undefined
    });

    const chat = model.startChat({
      history: history || []
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    
    // Extract text and function calls with error handling
    let text = '';
    try {
      text = response.text() || '';
    } catch (textError: any) {
      console.error('Error extracting text from response:', textError);
      text = '';
    }

    let functionCalls: Array<{ name: string; args: any }> = [];
    try {
      const calls = response.functionCalls();
      functionCalls = calls ? calls.map(call => ({
        name: call.name,
        args: call.args
      })) : [];
    } catch (callsError: any) {
      console.error('Error extracting function calls from response:', callsError);
      functionCalls = [];
    }

    recordChatMessage(uid);
    recordTokenCost(uid, MODEL_ID, (response as any).usageMetadata);

    return NextResponse.json({
      text,
      functionCalls
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message === 'AI_LIMIT_REACHED') {
      return NextResponse.json({ error: 'AI_LIMIT_REACHED', reasons: error.reasons || [], text: '', functionCalls: [] }, { status: 402 });
    }
    console.error('Error in chat API:', error);
    return NextResponse.json({ 
      error: error?.message || 'Internal Server Error',
      text: '',
      functionCalls: []
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }
}
