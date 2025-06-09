export type QuestionField = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type QuestionDifficulty = 0 | 1 | 2;

export interface Question {
  id: string;
  field: QuestionField;
  domain: number;
  difficulty: QuestionDifficulty;
  question: string;
  options: string[];
  answer: number;
  imageURL?: string;
  token?: string;
}

export type PracticeSessionDuration = 5 | 10 | 15 | 20 | 30 | 60;

export interface UserAnswer {
  questionId: string;
  answer: number;
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