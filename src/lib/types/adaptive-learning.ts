export interface SubdomainScore {
  // Core competency score (0-100)
  competencyScore: number;
  
  // Confidence level (0-100) - separate from competency
  confidenceLevel: number;
  
  // Time decay tracking
  lastPracticed: number; // timestamp
  lastScoreUpdate: number; // timestamp
  
  // Historical performance data
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  
  // Recent performance tracking (last 5-10 attempts)
  recentAttempts: Array<{
    questionId: string;
    isCorrect: boolean;
    timeSpent: number;
    difficulty: number;
    timestamp: number;
  }>;
  
  // Learning analytics
  recentStreak: number; // consecutive correct/incorrect
  longestStreak: number;
  improvementRate: number; // how quickly user is improving (score change per session)
  timeToMastery: number; // estimated sessions to reach 80%+
  
  // Performance by difficulty level
  difficultyPerformance: {
    easy: { attempts: number; correct: number; avgTime: number };
    medium: { attempts: number; correct: number; avgTime: number };
    hard: { attempts: number; correct: number; avgTime: number };
  };
  
  // Time performance
  averageTimeSpent: number;
  optimalTimeEstimate: number; // what we expect based on difficulty
  
  // Mastery indicators
  masteryLevel: 'beginner' | 'developing' | 'proficient' | 'advanced' | 'master';
  isStable: boolean; // whether performance has stabilized
  needsReinforcement: boolean; // needs more practice due to time decay
}

export interface DomainScore {
  domainId: number;
  averageCompetency: number;
  subdomainScores: { [subdomainId: string]: SubdomainScore };
  lastUpdated: number;
}

export interface AdaptiveLearningProfile {
  // Learning characteristics
  learningVelocity: number; // how quickly they improve (0-10)
  retentionRate: number; // how well they remember (0-10)
  consistencyScore: number; // how consistent their performance is (0-10)
  
  // Time preferences
  sessionOptimalLength: number; // minutes
  averageSessionLength: number;
  
  // Difficulty preferences (auto-calculated)
  preferredDifficultyProgression: number; // how aggressively to increase difficulty
  
  // Weak areas that need focus
  prioritySubdomains: string[]; // subdomain IDs that need immediate attention
  
  // Strengths to maintain
  strongSubdomains: string[]; // subdomain IDs that are strong but need maintenance
}

export interface AdaptiveLearningData {
  // Core scoring data
  subdomainScores: { [subdomainId: string]: SubdomainScore };
  domainSummaries: { [domainId: string]: DomainScore };
  
  // User learning profile
  learningProfile: AdaptiveLearningProfile;
  
  // Overall metrics
  overallCompetency: number;
  totalQuestionsAnswered: number;
  totalTimeSpent: number; // in seconds
  
  // Algorithm metadata
  algorithmVersion: string;
  lastFullUpdate: number;
  lastQuestionUpdate: number;
  
  // Question selection state
  questionQueue: Array<{
    subdomainId: string;
    difficulty: number;
    priority: number;
    reason: 'weakness' | 'reinforcement' | 'challenge' | 'review';
  }>;
}

export interface QuestionSelectionCriteria {
  subdomainId: string;
  difficulty: number;
  priority: number;
  reason: 'weakness' | 'reinforcement' | 'challenge' | 'review';
  excludeQuestionIds?: string[]; // questions to avoid (recently answered)
}

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

// Helper types for scoring calculations
export interface ScoreUpdate {
  subdomainId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  difficulty: number;
  timestamp: number;
}

export interface TimeDecayConfig {
  decayRate: number; // how much scores decay per day
  minimumScore: number; // minimum score after decay
  gracePeriod: number; // days before decay starts
}

export interface ScoringConfig {
  // Score change amounts
  correctAnswerGain: { easy: number; medium: number; hard: number };
  incorrectAnswerPenalty: { easy: number; medium: number; hard: number };
  
  // Time-based modifiers
  speedBonusThreshold: number; // fraction of optimal time for bonus
  speedBonusAmount: number;
  slowPenaltyThreshold: number; // fraction of optimal time for penalty
  slowPenaltyAmount: number;
  
  // Confidence modifiers
  confidenceGainRate: number;
  confidenceLossRate: number;
  
  // Streak bonuses
  streakBonusThreshold: number; // consecutive correct for bonus
  streakBonusMultiplier: number;
  
  // Time decay settings
  timeDecay: TimeDecayConfig;
} 