import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { verifyAuth } from '@/lib/api-auth';
import { assertWithinLimits, getGeminiKeyForUser, recordTokenCost } from '@/lib/ai/aiUsageServer';

export const dynamic = "force-static";


export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const uid = user.uid;
    const aiState = await assertWithinLimits(uid);

    const { history, message, mode } = await req.json();
    const apiKey = getGeminiKeyForUser(aiState, process.env.GEMINI_API_KEY || '');

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const MODEL_ID = 'gemini-2.0-flash';

    const client = new GoogleGenAI({ 
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' } 
    });

    let systemPrompt = `You are a friendly and enthusiastic AI tutor for a high school student.
      Your goal is to get to know the student better by asking about their interests (hobbies, sports, movies, books, etc.).
      
      Rules:
      1. Be concise, warm, and encouraging.
      2. If the user's answer is short or vague (e.g., "I like sports"), ask a specific follow-up question to dig deeper (e.g. "Oh cool! Do you play or watch? Which sport?").
      3. If the user's answer is specific, say "Anything else you want your Tutor to know?" to wrap up.
      4. Keep your responses short (under 20 words).
      5. Sound like a helpful peer or mentor, not a robot.`;

    if (mode === 'generate_question') {
        systemPrompt = `You are a friendly AI tutor. The student just told you their interests.
        Your goal: Ask ONE specific, engaging follow-up question to learn more about it.
        
        Rules:
        1. Do NOT say "That's cool" or "Nice". Just ask the question directly.
        2. Keep it under 20 words.
        3. Make it relevant to what they just said.
        4. Example: User says "I like golf", You ask: "What's your favorite golf course?"`;
    }

    if (mode === 'generate_cheers') {
        systemPrompt = `You are a friendly AI tutor. The student just told you about their interests.
        Your goal: Generate 20 distinct "cheer" lines inspired by their interest to use when they get a question right.
        
        Rules:
        1. Return a JSON array of strings. No other text.
        2. Each line should be a short, encouraging phrase (under 10 words).
        3. Use metaphors, puns, or references related to their interest.
        4. Be positive and fun.
        5. Example (for Star Wars interest): ["The Force is strong with this one!", "Jabba called, he wants his math skills back!", "Yoda would be proud.", "Han Solo approves.", "Great shot, kid, that was one in a million!", "Light speed ahead!", "The galaxy is safe with you.", "You are the chosen one.", "Stormtrooper aim? Not you!", "Chewie roars in approval!", "Rebel alliance worthy.", "Sith lords fear your logic.", "Jedi master in training.", "Pod racing champion!", "Ewok dance party time!", "R2-D2 beep boops happily.", "Death Star destroyed!", "Kessel run in 12 parsecs!", "Mandalorian nod.", "This is the way."]`;
        
        const content = { role: 'user', parts: [{ text: `My interest is: ${message}. Generate 20 cheer lines.` }] };
        const result = await client.models.generateContent({
            model: MODEL_ID,
            config: {
                responseMimeType: 'application/json',
                systemInstruction: { parts: [{ text: systemPrompt }] }
            },
            contents: [content]
        });
        
        let responseText = '';
        if (typeof (result as any).text === 'function') {
            try { responseText = (result as any).text(); } catch {}
        } else if (typeof (result as any).text === 'string') {
            responseText = (result as any).text;
        }

        recordTokenCost(uid, MODEL_ID, (result as any).usageMetadata);
        
        return NextResponse.json({ response: responseText });
    }

    // Filter and map history to ensure valid roles and structure
    const validHistory = (history || [])
        .filter((msg: any) => msg.role === 'user' || msg.role === 'model')
        .map((msg: any) => ({
            role: msg.role,
            parts: msg.parts
        }));

    // Remove initial model message if present (conversation must start with user)
    if (validHistory.length > 0 && validHistory[0].role === 'model') {
      validHistory.shift();
    }
    
    const newContent = { role: 'user', parts: [{ text: message }] };
    const contents = [...validHistory, newContent];

    const result = await client.models.generateContent({
      model: MODEL_ID,
      config: {
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        }
      },
      contents: contents
    });

    // Robust text extraction for @google/genai SDK
    let responseText = '';
    
    // Try getting text directly if available (newer SDK versions)
    if (typeof (result as any).text === 'function') {
        try { responseText = (result as any).text(); } catch {}
    } else if (typeof (result as any).text === 'string') {
        responseText = (result as any).text;
    }

    // Try extracting from candidates if text() didn't work
    if (!responseText && (result as any).candidates?.[0]?.content?.parts?.[0]?.text) {
        responseText = (result as any).candidates[0].content.parts[0].text;
    }
    
    // Fallback: check nested response object (legacy structure in some versions)
    if (!responseText && (result as any).response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        responseText = (result as any).response.candidates[0].content.parts[0].text;
    }

    if (!responseText) {
        console.error('Gemini response structure:', JSON.stringify(result, null, 2));
        throw new Error('No text in response');
    }

    recordTokenCost(uid, MODEL_ID, (result as any).usageMetadata);

    return NextResponse.json({ response: responseText });
  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message === 'AI_LIMIT_REACHED') {
      return NextResponse.json({ error: 'AI_LIMIT_REACHED', reasons: error.reasons || [] }, { status: 402 });
    }
    console.error('Error calling Gemini:', error);
    if (error.response) {
       console.error('Gemini API Error Response:', JSON.stringify(error.response, null, 2));
    }
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
