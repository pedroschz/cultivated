import { GoogleGenerativeAI } from '@google/generative-ai';
import { Question } from '../types/practice';

interface TutorSession {
  questionId: string;
  question: Question;
  userAnswer: string | number;
  isCorrect: boolean;
  thinkingAudio?: Blob;
  transcript?: string;
}

interface TutorResponse {
  text: string;
  audioURL?: string;
  followUpQuestions?: string[];
  conceptsToReview?: string[];
}

class GeminiTutorService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not found');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      // For now, we'll use a placeholder - in production you'd use Google Speech-to-Text
      // or integrate with Gemini's audio capabilities when available
      
      // Convert blob to base64 for processing
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // This is a placeholder - in reality you'd send to speech-to-text service
      return "Placeholder transcription - student was thinking about the problem";
    } catch (error) {
      console.error('Audio transcription failed:', error);
      return "Unable to transcribe audio";
    }
  }

  async generateTutorResponse(session: TutorSession): Promise<TutorResponse> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = this.buildTutorPrompt(session);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse structured response
      const tutorResponse = this.parseTutorResponse(text);

      return tutorResponse;
    } catch (error) {
      console.error('Gemini tutor response failed:', error);
      return {
        text: "I'm having trouble connecting right now. Let's review this concept: the key is to break down the problem step by step.",
        followUpQuestions: ["Would you like to try a similar problem?"],
        conceptsToReview: []
      };
    }
  }

  private buildTutorPrompt(session: TutorSession): string {
    const { question, userAnswer, isCorrect, transcript } = session;
    
    return `
You are an expert SAT tutor having a conversation with a student who just answered a question incorrectly. 
Your goal is to help them understand where they went wrong and guide them to the correct approach.

QUESTION DETAILS:
- Subject: ${question.domain || 'SAT'}
- Question: ${question.question}
- Options: ${Array.isArray(question.options) ? question.options.join(', ') : 'Open-ended'}
- Correct Answer: ${question.answer}
- Student's Answer: ${userAnswer}
- Student's Thinking Process: ${transcript || 'No audio transcript available'}

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
  }

  private parseTutorResponse(rawResponse: string): TutorResponse {
    try {
      // Try to parse JSON response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          text: parsed.text || rawResponse,
          followUpQuestions: parsed.followUpQuestions || [],
          conceptsToReview: parsed.conceptsToReview || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse structured response, using raw text');
    }

    // Fallback to plain text
    return {
      text: rawResponse,
      followUpQuestions: [],
      conceptsToReview: []
    };
  }

  async generateFollowUpResponse(
    previousSession: TutorSession,
    studentResponse: string
  ): Promise<TutorResponse> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `
You are continuing a tutoring conversation. Previously, you helped a student with this SAT question:

ORIGINAL QUESTION: ${previousSession.question.question}
STUDENT'S MISTAKE: They answered ${previousSession.userAnswer} instead of ${previousSession.question.answer}

You just explained the concept, and the student responded: "${studentResponse}"

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

      return this.parseTutorResponse(text);
    } catch (error) {
      console.error('Follow-up response failed:', error);
      return {
        text: "That's a great question! The key thing to remember is to always read carefully and break down the problem step by step.",
        followUpQuestions: [],
        conceptsToReview: []
      };
    }
  }

  async generateEncouragement(): Promise<string> {
    const encouragements = [
      "You're doing great! Every mistake is a learning opportunity.",
      "That's the spirit! Practice makes perfect on the SAT.",
      "Excellent thinking! You're getting better with each question.",
      "Nice work! You're developing strong problem-solving skills.",
      "Keep it up! This kind of practice will really help on test day."
    ];
    
    return encouragements[Math.floor(Math.random() * encouragements.length)];
  }
}

export const geminiTutorService = new GeminiTutorService();
export type { TutorSession, TutorResponse }; 