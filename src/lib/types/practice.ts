/**
 * This file contains all the type definitions and interfaces related to practice sessions,
 * questions, and user answers.
 */

/** A legacy identifier for a question's skill field. */
export type QuestionField = number;

/** Defines the possible difficulty levels for a question. */
export type QuestionDifficulty = 0 | 1 | 2; // 0: Easy, 1: Medium, 2: Hard

/**
 * Represents a single option for a multiple-choice question.
 * An option can contain text, an image, or both.
 */
export interface QuestionOption {
  text?: string;
  imageURL?: string;
  alt?: string; // Alt text for image accessibility
}

/**
 * Represents an image associated with a question, including metadata for optimization.
 */
export interface QuestionImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
}

/**
 * Represents a cultural context note that can be added to a question to provide
 * region-specific clarification.
 */
export interface ContextNote {
  culture: string; // e.g., 'NG' (Nigeria), 'GB' (Great Britain), 'US' (United States)
  text: string;
}

/**
 * Represents a single practice question.
 * This interface is designed to be flexible and support various question formats,
 * including text-only, image-based, and questions with reading passages.
 */
export interface Question {
  id: string;
  /** The domain this question belongs to (e.g., Algebra, Geometry). */
  domain: number;
  domainName?: string;
  /** The specific skill being tested by this question. */
  skill: string;
  difficulty: QuestionDifficulty;
  /** The main text or prompt of the question. */
  question: string;
  
  /** The answer options for the question. */
  options: string[] | QuestionOption[] | null;
  
  /** The correct answer(s) to the question. */
  answer: number | string | (number | string)[];
  
  /** A detailed explanation of the correct answer. */
  explanation?: string;
  /** URL of an image associated with the question. */
  image?: string | null;
  /** Description of the image for accessibility. */
  image_description?: string | null;
  /** A reading passage associated with the question. */
  passage?: string;
  
  token?: string; // Legacy field
  contextNotes?: ContextNote[];
  /** A flag indicating if the question has been reported by a user. */
  reported?: boolean;
}

/** Defines the possible durations for a practice session in minutes. */
export type PracticeSessionDuration = 5 | 10 | 15 | 20 | 30 | 60;

/** Subject of a practice session. */
export type PracticeSubject = 'Math' | 'Reading & Writing';

/**
 * Represents a user's answer to a single question within a practice session.
 */
export interface UserAnswer {
  questionId: string;
  answer: number | string;
  isCorrect: boolean;
  timeSpent: number; // in seconds
}

export interface TabSwitchEvent {
  timestamp: number;
  duration?: number; // ms away
}

/**
 * Represents the state of an entire practice session.
 */
export interface PracticeSession {
  duration: PracticeSessionDuration;
  /** Subject area for this session */
  subject: PracticeSubject;
  questions: Question[];
  currentQuestionIndex: number;
  startTime: number; // timestamp
  endTime: number; // timestamp
  isComplete: boolean;
  /** A map of user's answers, keyed by question ID. */
  userAnswers: { [key: string]: UserAnswer };
  /** A map of start times for each question, keyed by question ID. */
  questionStartTimes: { [key: string]: number };
  /** Count of how many times the user switched tabs or minimized the window. */
  tabSwitches?: number;
  /** Log of tab switch events. */
  tabSwitchEvents?: TabSwitchEvent[];
  /** Optional statistics for the completed session. */
  stats?: {
    totalAnswered: number;
    correctAnswers: number;
    accuracy: number;
    averageTime: number;
    domains: { [key: string]: { answered: number; correct: number } };
  };
}

/**
 * Represents the overall state of the practice session context, including the
 * session itself and UI-related state.
 */
export interface PracticeSessionState {
  session: PracticeSession | null;
  isActive: boolean;
  isPaused: boolean;
  timeRemaining: number; // in seconds
  showResults: boolean;
  stats?: {
    totalQuestions: number;
    answeredQuestions: number;
    correctAnswers: number;
    accuracy: number;
    averageTime: number;
  };
}
