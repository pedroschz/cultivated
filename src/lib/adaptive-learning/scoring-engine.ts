import { 
  SubdomainScore, 
  AdaptiveLearningData, 
  ScoreUpdate, 
  ScoringConfig
} from '../types/adaptive-learning';

// Default scoring configuration
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  correctAnswerGain: { easy: 8, medium: 12, hard: 16 },
  incorrectAnswerPenalty: { easy: 6, medium: 9, hard: 12 },
  
  speedBonusThreshold: 0.75, // faster than 75% of optimal time gets bonus
  speedBonusAmount: 2,
  slowPenaltyThreshold: 1.5, // slower than 150% of optimal time gets penalty
  slowPenaltyAmount: 1,
  
  confidenceGainRate: 0.8,
  confidenceLossRate: 1.2,
  
  streakBonusThreshold: 3,
  streakBonusMultiplier: 1.3,
  
  timeDecay: {
    decayRate: 1.5, // points lost per day
    minimumScore: 10, // never goes below 10%
    gracePeriod: 1 // 1 day before decay starts
  }
};

// Optimal time estimates for different difficulty levels (in seconds)
const OPTIMAL_TIME_ESTIMATES = {
  easy: 90,    // 1.5 minutes
  medium: 120, // 2 minutes
  hard: 180    // 3 minutes
};

export class AdaptiveLearningEngine {
  private config: ScoringConfig;

  constructor(config: ScoringConfig = DEFAULT_SCORING_CONFIG) {
    this.config = config;
  }

  /**
   * Initialize a new subdomain score for a user
   */
  initializeSubdomainScore(): SubdomainScore {
    return {
      competencyScore: 50, // Start at neutral
      confidenceLevel: 50,
      lastPracticed: Date.now(),
      lastScoreUpdate: Date.now(),
      totalAttempts: 0,
      correctCount: 0,
      incorrectCount: 0,
      recentAttempts: [],
      recentStreak: 0,
      longestStreak: 0,
      improvementRate: 0,
      timeToMastery: 10,
      difficultyPerformance: {
        easy: { attempts: 0, correct: 0, avgTime: 0 },
        medium: { attempts: 0, correct: 0, avgTime: 0 },
        hard: { attempts: 0, correct: 0, avgTime: 0 }
      },
      averageTimeSpent: 0,
      optimalTimeEstimate: OPTIMAL_TIME_ESTIMATES.medium,
      masteryLevel: 'beginner',
      isStable: false,
      needsReinforcement: false
    };
  }

  /**
   * Update a subdomain score based on a new answer
   */
  updateSubdomainScore(
    currentScore: SubdomainScore, 
    update: ScoreUpdate
  ): SubdomainScore {
    const newScore = { ...currentScore };
    const difficultyLevel = this.getDifficultyLevel(update.difficulty);
    
    // Update basic counters
    newScore.totalAttempts++;
    if (update.isCorrect) {
      newScore.correctCount++;
    } else {
      newScore.incorrectCount++;
    }
    
    // Update recent attempts (keep last 10)
    newScore.recentAttempts = [
      ...newScore.recentAttempts.slice(-9),
      {
        questionId: update.questionId,
        isCorrect: update.isCorrect,
        timeSpent: update.timeSpent,
        difficulty: update.difficulty,
        timestamp: update.timestamp
      }
    ];
    
    // Calculate competency score change
    const scoreChange = this.calculateScoreChange(newScore, update);
    newScore.competencyScore = Math.max(0, Math.min(100, newScore.competencyScore + scoreChange));
    
    // Update confidence level
    newScore.confidenceLevel = this.updateConfidenceLevel(newScore, update);
    
    // Update streak tracking
    this.updateStreakTracking(newScore, update.isCorrect);
    
    // Update difficulty-specific performance
    this.updateDifficultyPerformance(newScore, update, difficultyLevel);
    
    // Update time tracking
    this.updateTimeTracking(newScore, update.timeSpent);
    
    // Update mastery level and other derived metrics
    this.updateDerivedMetrics(newScore);
    
    // Update timestamps
    newScore.lastPracticed = update.timestamp;
    newScore.lastScoreUpdate = update.timestamp;
    
    return newScore;
  }

  /**
   * Apply time decay to a subdomain score
   */
  applyTimeDecay(score: SubdomainScore): SubdomainScore {
    const now = Date.now();
    const daysSinceLastPractice = (now - score.lastPracticed) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastPractice <= this.config.timeDecay.gracePeriod) {
      return score; // No decay within grace period
    }
    
    const decayDays = daysSinceLastPractice - this.config.timeDecay.gracePeriod;
    const decayAmount = decayDays * this.config.timeDecay.decayRate;
    
    // Apply forgetting curve - stronger users retain more
    const retentionFactor = Math.max(0.3, score.competencyScore / 100);
    const actualDecay = decayAmount * (1 - retentionFactor * 0.5);
    
    const newScore = { ...score };
    newScore.competencyScore = Math.max(
      this.config.timeDecay.minimumScore,
      newScore.competencyScore - actualDecay
    );
    
    // Also decay confidence slightly
    newScore.confidenceLevel = Math.max(
      this.config.timeDecay.minimumScore,
      newScore.confidenceLevel - actualDecay * 0.3
    );
    
    // Mark as needing reinforcement if significantly decayed
    newScore.needsReinforcement = actualDecay > 5;
    
    return newScore;
  }

  /**
   * Calculate the priority score for question selection
   */
  calculateSubdomainPriority(score: SubdomainScore): number {
    // Multiple factors contribute to priority
    const competencyFactor = (100 - score.competencyScore) * 2; // Lower competency = higher priority
    const confidenceFactor = (100 - score.confidenceLevel) * 1.5;
    const timeFactor = this.getTimeSinceLastPractice(score.lastPracticed) * 0.5;
    const streakFactor = score.recentStreak < 0 ? 20 : -Math.abs(score.recentStreak) * 2;
    const reinforcementFactor = score.needsReinforcement ? 25 : 0;
    
    // NEW: Data reliability factor - prioritize subdomains with insufficient data
    const dataReliabilityFactor = this.calculateDataReliabilityPriority(score.totalAttempts);
    
    // NEW: Learning velocity factor - prioritize based on improvement potential
    const learningVelocityFactor = this.calculateLearningVelocityPriority(score);
    
    // NEW: Time performance factor - prioritize areas where user is struggling with speed
    const timePerformanceFactor = this.calculateTimePerformancePriority(score);
    
    return competencyFactor + confidenceFactor + timeFactor + streakFactor + 
           reinforcementFactor + dataReliabilityFactor + learningVelocityFactor + timePerformanceFactor;
  }

  /**
   * Select the optimal difficulty for a subdomain
   */
  selectOptimalDifficulty(score: SubdomainScore): number {
    if (score.competencyScore < 40) return 0; // Easy
    if (score.competencyScore < 75) return 1; // Medium
    return 2; // Hard
  }

  /**
   * Generate question selection criteria based on current state
   */
  generateQuestionSelectionCriteria(
    adaptiveLearningData: AdaptiveLearningData,
    sessionLength: number = 10
  ) {
    const criteria = [];
    
    // Apply time decay to all subdomains first
    const updatedSubdomains: { [key: string]: SubdomainScore } = {};
    Object.entries(adaptiveLearningData.subdomainScores).forEach(([subdomainId, score]) => {
      updatedSubdomains[subdomainId] = this.applyTimeDecay(score);
    });
    
    // Calculate priorities for all subdomains
    const priorities = Object.entries(updatedSubdomains).map(([subdomainId, score]) => ({
      subdomainId,
      score,
      priority: this.calculateSubdomainPriority(score)
    })).sort((a, b) => b.priority - a.priority);
    
    // Select questions based on strategy
    const weaknessFocus = Math.ceil(sessionLength * 0.6); // 60% on weaknesses
    const reinforcementFocus = Math.ceil(sessionLength * 0.3); // 30% on reinforcement
    const challengeFocus = sessionLength - weaknessFocus - reinforcementFocus; // 10% on challenges
    
    // Add weakness-focused questions
    for (let i = 0; i < Math.min(weaknessFocus, priorities.length); i++) {
      const item = priorities[i];
      criteria.push({
        subdomainId: item.subdomainId,
        difficulty: this.selectOptimalDifficulty(item.score),
        priority: item.priority,
        reason: 'weakness'
      });
    }
    
    // Add reinforcement questions (medium-performing areas)
    const reinforcementCandidates = priorities.filter(p => 
      p.score.competencyScore >= 60 && p.score.competencyScore <= 85
    );
    for (let i = 0; i < Math.min(reinforcementFocus, reinforcementCandidates.length); i++) {
      const item = reinforcementCandidates[i];
      criteria.push({
        subdomainId: item.subdomainId,
        difficulty: this.selectOptimalDifficulty(item.score),
        priority: item.priority,
        reason: 'reinforcement'
      });
    }
    
    // Add challenge questions (strong areas)
    const challengeCandidates = priorities.filter(p => p.score.competencyScore > 85);
    for (let i = 0; i < Math.min(challengeFocus, challengeCandidates.length); i++) {
      const item = challengeCandidates[i];
      criteria.push({
        subdomainId: item.subdomainId,
        difficulty: Math.min(2, this.selectOptimalDifficulty(item.score) + 1), // Bump up difficulty
        priority: item.priority,
        reason: 'challenge'
      });
    }
    
    return criteria.sort((a, b) => b.priority - a.priority);
  }

  // Private helper methods

  private getDifficultyLevel(difficulty: number): 'easy' | 'medium' | 'hard' {
    if (difficulty === 0) return 'easy';
    if (difficulty === 1) return 'medium';
    return 'hard';
  }

  private calculateScoreChange(score: SubdomainScore, update: ScoreUpdate): number {
    const difficultyLevel = this.getDifficultyLevel(update.difficulty);
    
    let baseChange: number;
    if (update.isCorrect) {
      baseChange = this.config.correctAnswerGain[difficultyLevel];
    } else {
      baseChange = -this.config.incorrectAnswerPenalty[difficultyLevel];
    }
    
    // Apply diminishing returns for high scores
    const diminishingFactor = update.isCorrect 
      ? Math.max(0.3, 1 - (score.competencyScore / 120))
      : 1;
    
    // Apply time bonus/penalty
    const timeModifier = this.calculateTimeModifier(update.timeSpent, difficultyLevel);
    
    // Apply streak bonus
    const streakModifier = this.calculateStreakModifier(score.recentStreak, update.isCorrect);
    
    return baseChange * diminishingFactor * (1 + timeModifier + streakModifier);
  }

  private calculateTimeModifier(timeSpent: number, difficulty: 'easy' | 'medium' | 'hard'): number {
    const optimalTime = OPTIMAL_TIME_ESTIMATES[difficulty];
    const timeRatio = timeSpent / optimalTime;
    
    // Exceptional speed (answered very quickly) - bigger bonus
    if (timeRatio < 0.5) {
      return this.config.speedBonusAmount * 1.5 / 100; // 3% bonus for exceptional speed
    }
    
    // Good speed (standard speed bonus)
    if (timeRatio < this.config.speedBonusThreshold) {
      return this.config.speedBonusAmount / 100; // 2% bonus
    }
    
    // Slightly slow (minor penalty)
    if (timeRatio > this.config.slowPenaltyThreshold && timeRatio < 2.0) {
      return -this.config.slowPenaltyAmount / 100; // -1% penalty
    }
    
    // Very slow (bigger penalty)
    if (timeRatio >= 2.0) {
      return -this.config.slowPenaltyAmount * 2 / 100; // -2% penalty for very slow
    }
    
    return 0; // No modifier for normal timing
  }

  private calculateStreakModifier(currentStreak: number, isCorrect: boolean): number {
    if (isCorrect && currentStreak >= this.config.streakBonusThreshold) {
      return (this.config.streakBonusMultiplier - 1);
    }
    return 0;
  }

  private updateConfidenceLevel(score: SubdomainScore, update: ScoreUpdate): number {
    const currentConfidence = score.confidenceLevel;
    const competencyGap = Math.abs(score.competencyScore - currentConfidence);
    
    if (update.isCorrect) {
      // Increase confidence, but not beyond competency score
      const gain = this.config.confidenceGainRate * (1 + competencyGap / 100);
      return Math.min(100, Math.min(score.competencyScore + 10, currentConfidence + gain));
    } else {
      // Decrease confidence
      const loss = this.config.confidenceLossRate * (1 + competencyGap / 100);
      return Math.max(0, currentConfidence - loss);
    }
  }

  private updateStreakTracking(score: SubdomainScore, isCorrect: boolean): void {
    if (isCorrect) {
      score.recentStreak = score.recentStreak >= 0 ? score.recentStreak + 1 : 1;
    } else {
      score.recentStreak = score.recentStreak <= 0 ? score.recentStreak - 1 : -1;
    }
    
    score.longestStreak = Math.max(score.longestStreak, Math.abs(score.recentStreak));
  }

  private updateDifficultyPerformance(
    score: SubdomainScore, 
    update: ScoreUpdate, 
    difficulty: 'easy' | 'medium' | 'hard'
  ): void {
    const diffPerf = score.difficultyPerformance[difficulty];
    const oldTotal = diffPerf.attempts;
    
    diffPerf.attempts++;
    if (update.isCorrect) {
      diffPerf.correct++;
    }
    
    // Update average time with weighted average
    diffPerf.avgTime = ((diffPerf.avgTime * oldTotal) + update.timeSpent) / diffPerf.attempts;
  }

  private updateTimeTracking(score: SubdomainScore, timeSpent: number): void {
    const oldTotal = score.totalAttempts - 1; // -1 because we already incremented
    score.averageTimeSpent = ((score.averageTimeSpent * oldTotal) + timeSpent) / score.totalAttempts;
  }

  private updateDerivedMetrics(score: SubdomainScore): void {
    // Update mastery level
    score.masteryLevel = this.calculateMasteryLevel(score.competencyScore);
    
    // Update stability (performance has stabilized if last 5 attempts show consistent results)
    score.isStable = this.calculateStability(score);
    
    // Calculate improvement rate (change over recent attempts)
    score.improvementRate = this.calculateImprovementRate(score);
    
    // Estimate time to mastery
    score.timeToMastery = this.estimateTimeToMastery(score);
  }

  private calculateMasteryLevel(competencyScore: number): 'beginner' | 'developing' | 'proficient' | 'advanced' | 'master' {
    if (competencyScore >= 90) return 'master';
    if (competencyScore >= 75) return 'advanced';
    if (competencyScore >= 60) return 'proficient';
    if (competencyScore >= 40) return 'developing';
    return 'beginner';
  }

  private calculateStability(score: SubdomainScore): boolean {
    if (score.recentAttempts.length < 5) return false;
    
    const recent = score.recentAttempts.slice(-5);
    const accuracies = recent.map(attempt => attempt.isCorrect ? 1 : 0);
    const variance = this.calculateVariance(accuracies);
    
    return variance < 0.3; // Low variance indicates stability
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateImprovementRate(score: SubdomainScore): number {
    if (score.recentAttempts.length < 3) return 0;
    
    const recent = score.recentAttempts.slice(-6); // Last 6 attempts
    const firstHalf = recent.slice(0, 3);
    const secondHalf = recent.slice(3);
    
    const firstAccuracy = firstHalf.filter(a => a.isCorrect).length / firstHalf.length;
    const secondAccuracy = secondHalf.filter(a => a.isCorrect).length / secondHalf.length;
    
    return (secondAccuracy - firstAccuracy) * 100; // Percentage improvement
  }

  private estimateTimeToMastery(score: SubdomainScore): number {
    const targetScore = 80;
    const currentScore = score.competencyScore;
    
    if (currentScore >= targetScore) return 0;
    
    const improvementRate = Math.max(0.5, score.improvementRate || 1);
    const scoreDifference = targetScore - currentScore;
    
    return Math.ceil(scoreDifference / improvementRate);
  }

  private getTimeSinceLastPractice(lastPracticed: number): number {
    return (Date.now() - lastPracticed) / (1000 * 60 * 60 * 24); // Days
  }

  /**
   * Calculate priority based on data reliability (number of attempts)
   * More attempts = more reliable data = lower priority for data collection
   * Fewer attempts = less reliable data = higher priority for data collection
   */
  private calculateDataReliabilityPriority(totalAttempts: number): number {
    // Insufficient data threshold: less than 5 attempts
    if (totalAttempts < 5) return 15; // High priority for data collection
    
    // Low data threshold: 5-10 attempts  
    if (totalAttempts < 10) return 8; // Medium priority for more data
    
    // Adequate data threshold: 10-20 attempts
    if (totalAttempts < 20) return 3; // Low priority for additional data
    
    // Sufficient data: 20+ attempts
    return 0; // No additional priority for data collection
  }

  /**
   * Calculate priority based on learning velocity and improvement potential
   * Fast improvers with low attempts = high priority
   * Plateau performers = medium priority  
   * Stable high performers = low priority
   */
  private calculateLearningVelocityPriority(score: SubdomainScore): number {
    const improvementRate = score.improvementRate;
    const competencyScore = score.competencyScore;
    const totalAttempts = score.totalAttempts;

    // Fast improvers (positive improvement rate) with low competency
    if (improvementRate > 5 && competencyScore < 70) {
      return 12; // High priority - they're learning fast, keep feeding them questions
    }

    // Struggling learners (negative improvement rate) 
    if (improvementRate < -3) {
      return 10; // High priority - they need help
    }

    // Plateau performers (little improvement, medium competency)
    if (Math.abs(improvementRate) < 2 && competencyScore > 40 && competencyScore < 80 && totalAttempts > 10) {
      return 8; // Medium priority - might need different approach
    }

    // High performers with stable performance
    if (competencyScore > 85 && Math.abs(improvementRate) < 3) {
      return 2; // Low priority - they're doing well
    }

    return 5; // Default medium priority
  }

  /**
   * Calculate priority based on time performance issues
   * Slow but accurate = needs speed practice
   * Fast but inaccurate = needs accuracy practice  
   * Consistent optimal timing = lower priority
   */
  private calculateTimePerformancePriority(score: SubdomainScore): number {
    const avgTime = score.averageTimeSpent;
    const optimalTime = score.optimalTimeEstimate;
    const competencyScore = score.competencyScore;

    if (avgTime === 0 || optimalTime === 0) return 0; // No time data yet

    const timeRatio = avgTime / optimalTime;

    // Slow but accurate (good understanding, needs speed work)
    if (timeRatio > 1.3 && competencyScore > 70) {
      return 8; // Medium-high priority for speed training
    }

    // Very slow (regardless of accuracy)
    if (timeRatio > 1.8) {
      return 12; // High priority - significant time issues
    }

    // Fast but inaccurate (rushing, needs careful practice)
    if (timeRatio < 0.7 && competencyScore < 60) {
      return 10; // High priority for accuracy training
    }

    // Optimal timing
    if (timeRatio >= 0.8 && timeRatio <= 1.2) {
      return 0; // No time-based priority adjustment
    }

    return 3; // Minor time issues
  }
} 