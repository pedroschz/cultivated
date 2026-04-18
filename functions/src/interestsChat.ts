import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { defineSecret } from 'firebase-functions/params';
import { assertWithinLimits, getGeminiKeyForUser, recordTokenCost } from './lib/aiUsage';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

export const generateInterestsChat = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  logger.info("generateInterestsChat called", { 
    mode: request.data.mode, 
    messageLength: request.data.message?.length,
    hasAuth: !!request.auth 
  });

  if (!request.auth) {
    logger.error("Missing authentication");
    throw new HttpsError('unauthenticated', 'Missing authentication.');
  }

  const uid = request.auth.uid;
  const aiState = await assertWithinLimits(uid);

  const { history, message, mode } = request.data;
  const apiKey = getGeminiKeyForUser(aiState, GEMINI_API_KEY.value());

  if (!apiKey) {
    logger.error("API key not configured");
    throw new HttpsError('internal', 'API key not configured');
  }

  const MODEL_ID = 'gemini-2.0-flash';

  try {
    const client = new GoogleGenerativeAI(apiKey);
    
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
        
        const model = client.getGenerativeModel({ 
            model: MODEL_ID,
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                responseMimeType: 'application/json'
            }
        });

        logger.info("Calling Gemini for cheers generation");
        const result = await model.generateContent(`My interest is: ${message}. Generate 20 cheer lines.`);
        const response = result.response;
        const text = response.text();
        logger.info("Gemini cheers response received", { textLength: text.length });
        recordTokenCost(uid, MODEL_ID, response.usageMetadata as any);
        return { response: text };
    }

    const model = client.getGenerativeModel({ 
      model: MODEL_ID,
      systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }]
      }
    });

    // Filter and map history to ensure valid roles and structure
    const validHistory = (history || [])
        .filter((msg: any) => msg.role === 'user' || msg.role === 'model')
        .map((msg: any) => ({
            role: msg.role,
            parts: [{ text: msg.parts?.[0]?.text || msg.text || '' }]
        }));

    // Remove initial model message if present (conversation must start with user)
    if (validHistory.length > 0 && validHistory[0].role === 'model') {
      validHistory.shift();
    }
    
    const chat = model.startChat({
        history: validHistory
    });

    logger.info("Sending message to Gemini chat", { message });
    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();
    logger.info("Gemini chat response received", { text });
    recordTokenCost(uid, MODEL_ID, response.usageMetadata as any);
    
    return { response: text };
  } catch (error: any) {
    logger.error("Error in generateInterestsChat", error);
    throw new HttpsError('internal', error.message || 'Internal error calling AI service');
  }
});

