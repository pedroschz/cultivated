import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'transcribe':
        return handleTranscription(data);
      case 'tutor':
        return handleTutoring(data);
      case 'followup':
        return handleFollowUp(data);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Tutor API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleTranscription(_data: { audioBase64: string }) {
  try {
    // This is a placeholder for audio transcription
    // In production, you'd use Google Speech-to-Text API or similar
    
    // For now, return a mock transcription
    const mockTranscripts = [
      "Let me think about this... I'm looking at the options and trying to eliminate the wrong ones...",
      "This seems like a quadratic equation problem. I need to use the formula...",
      "I'm not sure about this one. Let me read it again carefully...",
      "I think the answer might be B, but I'm also considering C..."
    ];
    
    const transcript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
    
    return NextResponse.json({ 
      success: true, 
      transcript 
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 }
    );
  }
}

async function handleTutoring(data: {
  questionText: string;
  userAnswer: string | number;
  correctAnswer: string | number;
  transcript?: string;
  domain?: string;
}) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
You are an expert SAT tutor having a conversation with a student who just answered a question incorrectly. 
Your goal is to help them understand where they went wrong and guide them to the correct approach.

QUESTION DETAILS:
- Subject: ${data.domain || 'SAT'}
- Question: ${data.questionText}
- Correct Answer: ${data.correctAnswer}
- Student's Answer: ${data.userAnswer}
- Student's Thinking Process: ${data.transcript || 'No audio transcript available'}

TUTORING GUIDELINES:
1. Be encouraging and supportive
2. Identify the specific mistake in their reasoning
3. Explain the correct approach step-by-step
4. Connect to broader concepts they should remember
5. Ask follow-up questions to check understanding
6. Keep responses conversational and under 150 words

RESPONSE FORMAT:
Return your response as a JSON object with these fields:
{
  "text": "Your main tutoring response",
  "followUpQuestions": ["Question 1", "Question 2"],
  "conceptsToReview": ["Concept 1", "Concept 2"]
}

Generate your tutoring response now:
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to parse JSON response
    let tutorResponse;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        tutorResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      // Fallback to plain text
      tutorResponse = {
        text: text,
        followUpQuestions: ["Does that make sense?", "Would you like to try a similar problem?"],
        conceptsToReview: []
      };
    }

    return NextResponse.json({
      success: true,
      response: tutorResponse
    });
  } catch (error) {
    console.error('Tutoring error:', error);
    return NextResponse.json(
      { 
        success: true,
        response: {
          text: "I'm having trouble connecting right now, but let me help you understand this concept. The key is to break down the problem step by step and identify what the question is really asking.",
          followUpQuestions: ["Would you like me to explain the concept differently?", "Should we try a similar problem?"],
          conceptsToReview: ["Problem Analysis"]
        }
      }
    );
  }
}

async function handleFollowUp(data: {
  previousQuestion: string;
  previousAnswer: string | number;
  correctAnswer: string | number;
  studentResponse: string;
}) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
You are continuing a tutoring conversation. Previously, you helped a student with this SAT question:

ORIGINAL QUESTION: ${data.previousQuestion}
STUDENT'S MISTAKE: They answered ${data.previousAnswer} instead of ${data.correctAnswer}

You just explained the concept, and the student responded: "${data.studentResponse}"

Continue the conversation by:
1. Acknowledging their response
2. Clarifying any remaining confusion
3. Ensuring they understand the concept
4. Offering encouragement

Keep your response under 100 words and conversational.

Respond in JSON format:
{
  "text": "Your response",
  "followUpQuestions": ["Any follow-up questions"],
  "conceptsToReview": ["Any additional concepts to review"]
}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to parse JSON response
    let tutorResponse;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        tutorResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      // Fallback to plain text
      tutorResponse = {
        text: text,
        followUpQuestions: ["Any other questions?"],
        conceptsToReview: []
      };
    }

    return NextResponse.json({
      success: true,
      response: tutorResponse
    });
  } catch (error) {
    console.error('Follow-up error:', error);
    return NextResponse.json(
      { 
        success: true,
        response: {
          text: "That's a great question! The key thing to remember is to always read carefully and break down the problem step by step.",
          followUpQuestions: ["Ready to continue practicing?"],
          conceptsToReview: []
        }
      }
    );
  }
}

 