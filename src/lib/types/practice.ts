export type QuestionField = number; // 0-46 (47 total fields/subdomains)
export type QuestionDifficulty = 0 | 1 | 2;

// Enhanced option type that can be text, image, or both
export interface QuestionOption {
  text?: string;
  imageURL?: string;
  alt?: string; // Alternative text for accessibility
}

// Image metadata for optimization
export interface QuestionImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
}

export interface Question {
  id: string;
  field: QuestionField;
  domain: number;
  difficulty: QuestionDifficulty;
  question: string;
  
  // Enhanced options - can be string array (legacy), QuestionOption array, or single string
  options: string[] | QuestionOption[] | string;
  
  answer: number | string;
  
  // Enhanced image support
  imageURL?: string; // Legacy support
  questionImage?: QuestionImage; // New enhanced image support
  
  token?: string;
  passage?: string;
}

export type PracticeSessionDuration = 5 | 10 | 15 | 20 | 30 | 60;

export interface UserAnswer {
  questionId: string;
  answer: number | string;
  isCorrect: boolean;
  timeSpent: number;
}

export interface PracticeSession {
  duration: PracticeSessionDuration;
  questions: Question[];
  currentQuestionIndex: number;
  startTime: number;
  endTime: number;
  isComplete: boolean;
  userAnswers: { [key: string]: UserAnswer };
  questionStartTimes: { [key: string]: number };
  stats?: {
    totalAnswered: number;
    correctAnswers: number;
    accuracy: number;
    averageTime: number;
    domains: { [key: string]: { answered: number; correct: number } };
  };
}

export interface PracticeSessionState {
  session: PracticeSession | null;
  isActive: boolean;
  timeRemaining: number;
  showResults: boolean;
  stats?: {
    totalQuestions: number;
    answeredQuestions: number;
    correctAnswers: number;
    accuracy: number;
    averageTime: number;
  };
} 