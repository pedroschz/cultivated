/**
 * This file contains all the type definitions and interfaces for the adaptive learning system.
 * These structures define the shape of the data used to track user performance,
 * calculate scores, and generate personalized learning experiences.
 */

/**
 * Represents a user's performance and mastery level for a single, specific skill or subdomain.
 */
export interface SubdomainScore {
  /** The core competency score for this subdomain, ranging from 0 to 100. */
  competencyScore: number;
  
  /** A user's self-assessed or inferred confidence level (0-100), separate from competency. */
  confidenceLevel: number;
  
  /** Timestamp of the last time this subdomain was practiced. */
  lastPracticed: number;
  /** Timestamp of the last time this score was updated. */
  lastScoreUpdate: number;
  
  /** Total number of questions attempted in this subdomain. */
  totalAttempts: number;
  /** Total number of correct answers. */
  correctCount: number;
  /** Total number of incorrect answers. */
  incorrectCount: number;
  
  /** A log of the last 10 attempts to track recent performance. */
  recentAttempts: Array<{
    questionId: string;
    isCorrect: boolean;
    timeSpent: number;
    difficulty: number;
    timestamp: number;
  }>;
  
  /** The current streak of consecutive correct or incorrect answers. */
  recentStreak: number;
  /** The longest streak of correct answers achieved. */
  longestStreak: number;
  /** The rate at which the user's score is improving. */
  improvementRate: number;
  /** An estimation of how many more questions are needed to achieve mastery. */
  timeToMastery: number;
  
  /** Performance breakdown by question difficulty level. */
  difficultyPerformance: {
    easy: { attempts: number; correct: number; avgTime: number };
    medium: { attempts: number; correct: number; avgTime: number };
    hard: { attempts: number; correct: number; avgTime: number };
  };
  
  /** The user's average time spent on questions in this subdomain. */
  averageTimeSpent: number;
  /** The estimated optimal time for questions in this subdomain. */
  optimalTimeEstimate: number;
  
  /** The user's current mastery level in this subdomain. */
  masteryLevel: 'beginner' | 'developing' | 'proficient' | 'advanced' | 'master';
  /** A flag indicating if the user's performance has stabilized. */
  isStable: boolean;
  /** A flag indicating if the skill needs to be reinforced due to time decay. */
  needsReinforcement: boolean;
}

/**
 * Represents a summary of a user's performance across a broader domain.
 */
export interface DomainScore {
  domainId: number;
  averageCompetency: number;
  subdomainScores: { [subdomainId: string]: SubdomainScore };
  lastUpdated: number;
}

/**
 * Captures a user's learning characteristics and preferences.
 */
export interface AdaptiveLearningProfile {
  /** How quickly the user improves their score (0-10). */
  learningVelocity: number;
  /** How well the user retains information over time (0-10). */
  retentionRate: number;
  /** How consistent the user's performance is (0-10). */
  consistencyScore: number;
  
  /** The optimal session length for this user in minutes. */
  sessionOptimalLength: number;
  /** The user's average session length. */
  averageSessionLength: number;
  
  /** How aggressively to increase question difficulty. */
  preferredDifficultyProgression: number;
  
  /** Subdomains identified as areas needing the most improvement. */
  prioritySubdomains: string[];
  
  /** Subdomains where the user is strong but need occasional review. */
  strongSubdomains: string[];
}

/**
 * The main data structure for a user's entire adaptive learning state.
 */
export interface AdaptiveLearningData {
  /** A map of all subdomain scores for the user. */
  subdomainScores: { [subdomainId: string]: SubdomainScore };
  /** A summary of scores for each domain. */
  domainSummaries: { [domainId: string]: DomainScore };
  /** Optional daily history of mastery for trend visualization. */
  masteryHistory?: MasteryHistoryEntry[];
  
  /** The user's personalized learning profile. */
  learningProfile: AdaptiveLearningProfile;
  
  /** The user's overall competency score across all domains. */
  overallCompetency: number;
  totalQuestionsAnswered: number;
  totalTimeSpent: number; // in seconds
  
  /** Metadata for the adaptive learning algorithm. */
  algorithmVersion: string;
  lastFullUpdate: number;
  lastQuestionUpdate: number;
  /** Whether a one-time history backfill has been executed. */
  masteryHistoryBackfilled?: boolean;
  
  /** A queue of questions prioritized for the user's next session. */
  questionQueue: Array<{
    subdomainId: string;
    difficulty: number;
    priority: number;
    reason: 'weakness' | 'reinforcement' | 'challenge' | 'review';
  }>;
}

/**
 * Captures a daily snapshot of overall and domain mastery for trend charts.
 * `date` must be in ISO format YYYY-MM-DD to make daily updates idempotent.
 */
export interface MasteryHistoryEntry {
  date: string; // YYYY-MM-DD
  overall: number;
  /** Average competency across math domains (0-3). */
  math: number;
  /** Average competency across reading & writing domains (4-7). */
  readingWriting: number;
  /** Optional per-domain competencies for future use. */
  domainCompetency?: { [domainId: string]: number };
  /** Total seconds studied for Math on this date. Does not carry forward. */
  secondsStudiedMath?: number;
  /** Total seconds studied for Reading & Writing on this date. Does not carry forward. */
  secondsStudiedReadingWriting?: number;
}

/**
 * Defines the criteria for selecting the next question for a user.
 */
export interface QuestionSelectionCriteria {
  subdomainId: string;
  difficulty: number;
  priority: number;
  reason: 'weakness' | 'reinforcement' | 'challenge' | 'review';
  excludeQuestionIds?: string[];
}

/**
 * Represents a specific insight or piece of feedback for the user.
 */
export interface LearningInsight {
  type: 'strength' | 'weakness' | 'improvement' | 'plateau' | 'regression';
  subdomainId: string;
  subdomainName: string;
  domainId: string;
  domainName: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  actionable: boolean;
  recommendation?: string;
}

/**
 * Represents the data from a single answer to a question.
 */
export interface ScoreUpdate {
  subdomainId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  difficulty: number;
  timestamp: number;
}

/**
 * Configuration for the time-based decay of scores.
 */
export interface TimeDecayConfig {
  decayRate: number; // Points lost per day
  minimumScore: number; // The lowest a score can decay to
  gracePeriod: number; // Days before decay begins
}

/**
 * Configuration for the entire scoring engine.
 */
export interface ScoringConfig {
  correctAnswerGain: { easy: number; medium: number; hard: number };
  incorrectAnswerPenalty: { easy: number; medium: number; hard: number };
  
  speedBonusThreshold: number; // % of optimal time to get a bonus
  speedBonusAmount: number;
  slowPenaltyThreshold: number; // % of optimal time to get a penalty
  slowPenaltyAmount: number;
  
  confidenceGainRate: number;
  confidenceLossRate: number;
  
  streakBonusThreshold: number;
  streakBonusMultiplier: number;
  
  timeDecay: TimeDecayConfig;
}
