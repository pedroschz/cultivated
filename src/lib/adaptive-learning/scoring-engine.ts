import { 
  SubdomainScore, 
  AdaptiveLearningData, 
  ScoreUpdate, 
  ScoringConfig
} from '../types/adaptive-learning';
import { DOMAIN_RANGES } from './skill-mapping';
import {
  SCORING_CONSTANTS,
  TIME_ESTIMATES,
  SPEED_MODIFIERS,
  ALGORITHM_CONFIG
} from './constants';

/**
 * Default configuration for the scoring engine.
 * These values are used unless a custom configuration is provided.
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  correctAnswerGain: { easy: 8, medium: 12, hard: 16 },
  incorrectAnswerPenalty: { easy: 6, medium: 9, hard: 12 },
  
  speedBonusThreshold: 0.75, // Faster than 75% of optimal time gets a bonus
  speedBonusAmount: 2,
  slowPenaltyThreshold: 1.5, // Slower than 150% of optimal time gets a penalty
  slowPenaltyAmount: 1,
  
  confidenceGainRate: 0.8,
  confidenceLossRate: 1.2,
  
  streakBonusThreshold: 3,
  streakBonusMultiplier: 1.3,
  
  timeDecay: {
    decayRate: 1.5, // Points lost per day of inactivity
    minimumScore: 10, // Competency score never decays below this value
    gracePeriod: 1 // Days before decay starts
  }
};

/**
 * Estimated optimal time in seconds to answer questions of varying difficulty.
 */
const OPTIMAL_TIME_ESTIMATES = {
  easy: TIME_ESTIMATES.EASY_QUESTION_SECONDS,
  medium: TIME_ESTIMATES.MEDIUM_QUESTION_SECONDS,
  hard: TIME_ESTIMATES.HARD_QUESTION_SECONDS
};

/**
 * The core engine for adaptive learning calculations.
 * This class handles all the logic for scoring, updating user profiles,
 * and determining the next best questions for a user.
 */
export class AdaptiveLearningEngine {
  private config: ScoringConfig;

  constructor(config: ScoringConfig = DEFAULT_SCORING_CONFIG) {
    this.config = config;
  }

  /**
   * Initializes a new score object for a specific subdomain.
   * @returns A new SubdomainScore object with default values.
   */
  initializeSubdomainScore(): SubdomainScore {
    return {
      competencyScore: SCORING_CONSTANTS.INITIAL_COMPETENCY,
      confidenceLevel: SCORING_CONSTANTS.INITIAL_CONFIDENCE,
      lastPracticed: Date.now(),
      lastScoreUpdate: Date.now(),
      totalAttempts: 0,
      correctCount: 0,
      incorrectCount: 0,
      recentAttempts: [],
      recentStreak: 0,
      longestStreak: 0,
      improvementRate: 0,
      timeToMastery: SCORING_CONSTANTS.INITIAL_TIME_TO_MASTERY,
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
   * Updates a subdomain score based on a user's answer to a question.
   * @param currentScore - The current score for the subdomain.
   * @param update - The details of the user's answer.
   * @returns The updated subdomain score.
   */
  updateSubdomainScore(
    currentScore: SubdomainScore, 
    update: ScoreUpdate
  ): SubdomainScore {
    const newScore = { ...currentScore };
    const difficultyLevel = this.getDifficultyLevel(update.difficulty);
    
    newScore.totalAttempts++;
    if (update.isCorrect) {
      newScore.correctCount++;
    } else {
      newScore.incorrectCount++;
    }
    
    // Keep track of the last N attempts
    newScore.recentAttempts = [
      ...newScore.recentAttempts.slice(-(SCORING_CONSTANTS.RECENT_ATTEMPTS_LIMIT - 1)),
      {
        questionId: update.questionId,
        isCorrect: update.isCorrect,
        timeSpent: update.timeSpent,
        difficulty: update.difficulty,
        timestamp: update.timestamp
      }
    ];
    
    const scoreChange = this.calculateScoreChange(newScore, update);
    newScore.competencyScore = Math.max(
      SCORING_CONSTANTS.MIN_SCORE, 
      Math.min(SCORING_CONSTANTS.MAX_SCORE, newScore.competencyScore + scoreChange)
    );
    
    newScore.confidenceLevel = this.updateConfidenceLevel(newScore, update);
    this.updateStreakTracking(newScore, update.isCorrect);
    this.updateDifficultyPerformance(newScore, update, difficultyLevel);
    this.updateTimeTracking(newScore, update.timeSpent);
    this.updateDerivedMetrics(newScore);
    
    newScore.lastPracticed = update.timestamp;
    newScore.lastScoreUpdate = update.timestamp;
    
    return newScore;
  }

  /**
   * Recalculates overall metrics like domain summaries and overall competency
   * based on the full set of subdomain scores.
   * @param subdomainScores - A map of all subdomain scores for a user.
   * @returns An object containing domain summaries and the overall competency score.
   */
  recalculateOverallMetrics(
    subdomainScores: { [key: string]: SubdomainScore }
  ): { domainSummaries: { [key: string]: any }, overallCompetency: number } {
    const domainSummaries: { [key: string]: any } = {};
    Object.entries(DOMAIN_RANGES).forEach(([domainId, range]) => {
      const [start, end] = range;
      let totalCompetency = 0;
      let count = 0;
      for (let i = start; i <= end; i++) {
        const subdomainId = i.toString();
        if (subdomainScores[subdomainId]) {
          totalCompetency += subdomainScores[subdomainId].competencyScore;
          count++;
        }
      }
      domainSummaries[domainId] = {
        domainId: parseInt(domainId),
        averageCompetency: count > 0 ? totalCompetency / count : 0,
        lastUpdated: Date.now()
      };
    });

    const totalCompetency = Object.values(subdomainScores).reduce(
      (acc: number, score: SubdomainScore) => acc + score.competencyScore, 0
    );
    const overallCompetency = Object.keys(subdomainScores).length > 0
      ? totalCompetency / Object.keys(subdomainScores).length
      : 0;

    return { domainSummaries, overallCompetency };
  }

  /**
   * Applies a time-based decay to a subdomain score to simulate forgetting.
   * @param score - The subdomain score to decay.
   * @returns The updated subdomain score after applying decay.
   */
  applyTimeDecay(score: SubdomainScore): SubdomainScore {
    const now = Date.now();
    const daysSinceLastPractice = (now - score.lastPracticed) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastPractice <= this.config.timeDecay.gracePeriod) {
      return score;
    }
    
    const decayDays = daysSinceLastPractice - this.config.timeDecay.gracePeriod;
    const decayAmount = decayDays * this.config.timeDecay.decayRate;
    
    // Users with higher competency forget more slowly.
    const retentionFactor = Math.max(
      SCORING_CONSTANTS.TIME_DECAY.RETENTION_FACTOR_MIN, 
      score.competencyScore / SCORING_CONSTANTS.MAX_SCORE
    );
    const actualDecay = decayAmount * (1 - retentionFactor * SCORING_CONSTANTS.TIME_DECAY.RETENTION_FACTOR_MULTIPLIER);
    
    const newScore = { ...score };
    newScore.competencyScore = Math.max(
      this.config.timeDecay.minimumScore,
      newScore.competencyScore - actualDecay
    );
    
    newScore.confidenceLevel = Math.max(
      this.config.timeDecay.minimumScore,
      newScore.confidenceLevel - actualDecay * SCORING_CONSTANTS.TIME_DECAY.CONFIDENCE_DECAY_MULTIPLIER
    );
    
    newScore.needsReinforcement = actualDecay > SCORING_CONSTANTS.TIME_DECAY.REINFORCEMENT_THRESHOLD;
    
    return newScore;
  }

  /**
   * Calculates a priority score for a subdomain to determine if it should be
   * included in the next practice session.
   * @param score - The score of the subdomain.
   * @returns A numerical priority score.
   */
  calculateSubdomainPriority(score: SubdomainScore): number {
    // Rebalanced weights to reduce dominance of competency/confidence and increase recency and learning signals
    const competencyFactor = (SCORING_CONSTANTS.MAX_SCORE - score.competencyScore) * SCORING_CONSTANTS.PRIORITY_WEIGHTS.COMPETENCY_FACTOR;
    const confidenceFactor = (SCORING_CONSTANTS.MAX_SCORE - score.confidenceLevel) * SCORING_CONSTANTS.PRIORITY_WEIGHTS.CONFIDENCE_FACTOR;
    const timeFactor = this.getTimeSinceLastPractice(score.lastPracticed) * SCORING_CONSTANTS.PRIORITY_WEIGHTS.TIME_FACTOR;
    const streakFactor = score.recentStreak < 0 ? 30 : -Math.abs(score.recentStreak) * SCORING_CONSTANTS.PRIORITY_WEIGHTS.STREAK_PENALTY;
    const reinforcementFactor = score.needsReinforcement ? SCORING_CONSTANTS.PRIORITY_WEIGHTS.REINFORCEMENT_BONUS : 0;
    const dataReliabilityFactor = this.calculateDataReliabilityPriority(score.totalAttempts);
    const learningVelocityFactor = this.calculateLearningVelocityPriority(score);
    const timePerformanceFactor = this.calculateTimePerformancePriority(score);

    return competencyFactor + confidenceFactor + timeFactor + streakFactor +
           reinforcementFactor + dataReliabilityFactor + learningVelocityFactor + timePerformanceFactor;
  }

  /**
   * Selects the optimal difficulty level for a question in a given subdomain.
   * @param score - The score of the subdomain.
   * @returns The optimal difficulty level (0 for easy, 1 for medium, 2 for hard).
   */
  selectOptimalDifficulty(score: SubdomainScore): number {
    if (score.competencyScore < SCORING_CONSTANTS.EASY_THRESHOLD) return 0; // Easy
    if (score.competencyScore < SCORING_CONSTANTS.MEDIUM_THRESHOLD) return 1; // Medium
    return 2; // Hard
  }

  /**
   * Generates a set of criteria for selecting questions for a practice session.
   * @param adaptiveLearningData - The user's complete adaptive learning data.
   * @param sessionLength - The desired number of questions.
   * @returns An array of criteria for question selection.
   */
  generateQuestionSelectionCriteria(
    adaptiveLearningData: AdaptiveLearningData,
    sessionLength: number = 10
  ) {
    type Criterion = { subdomainId: string; difficulty: number; priority: number };
    const criteria: Criterion[] = [];

    // Apply time decay to compute base priorities
    const updatedSubdomains: { [key: string]: SubdomainScore } = {};
    Object.entries(adaptiveLearningData.subdomainScores).forEach(([subdomainId, score]) => {
      updatedSubdomains[subdomainId] = this.applyTimeDecay(score);
    });

    // Build criteria purely by priority, with a one-time boost for unseen skills
    for (const [subdomainId, score] of Object.entries(updatedSubdomains)) {
      const basePriority = this.calculateSubdomainPriority(score);
      const isUnassessed = (adaptiveLearningData.subdomainScores[subdomainId]?.totalAttempts || 0) === 0;
      const priority = isUnassessed ? SCORING_CONSTANTS.PRIORITY_WEIGHTS.UNSEEN_SKILL_BONUS : basePriority;
      // For unseen skills, set difficulty based on initial competency (rather than defaulting to easy)
      const difficulty = this.selectOptimalDifficulty(score);
      criteria.push({ subdomainId, difficulty, priority });
    }

    // Return the top-N by priority
    return criteria
      .sort((a, b) => b.priority - a.priority)
      .slice(0, sessionLength);
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
    
    // Apply diminishing returns as the user approaches mastery.
    const diminishingFactor = update.isCorrect 
      ? Math.max(SCORING_CONSTANTS.TIME_DECAY.RETENTION_FACTOR_MIN, 1 - (score.competencyScore / ALGORITHM_CONFIG.COMPETENCY_DIMINISHING_FACTOR))
      : 1;
    
    const timeModifier = this.calculateTimeModifier(update);
    const streakModifier = this.calculateStreakModifier(score.recentStreak, update.isCorrect);
    
    return baseChange * diminishingFactor * (1 + timeModifier + streakModifier);
  }

  private calculateTimeModifier(update: ScoreUpdate): number {
    const timeSpent = update.timeSpent;
    const sectionTime = this.getSectionOptimalTime(update.subdomainId);

    // Positive region (fast answers):
    // t = 0.5 at time = 0.5 * sectionTime, dropping smoothly to 0 at time = sectionTime
    let tPositive = 0;
    const halfTime = sectionTime / 2;
    if (timeSpent <= sectionTime) {
      const clampedTime = Math.max(timeSpent, halfTime);
      const x = (clampedTime - halfTime) / (sectionTime - halfTime); // in [0,1]
      // Cosine ease: 1 -> 0 over x in [0,1]
      const ease = (1 + Math.cos(Math.PI * x)) / 2; // 1 at x=0, 0 at x=1
      tPositive = 0.5 * ease; // 0.5 at halfTime, 0 at sectionTime
    }

    // Negative region (very slow answers):
    // From sectionTime + 60s (t=0) to sectionTime + 120s (t=-0.5), smooth
    let tNegative = 0;
    const negStart = sectionTime + 60; // seconds
    const negEnd = sectionTime + 120; // seconds
    if (timeSpent >= negStart) {
      const y = Math.min(1, Math.max(0, (timeSpent - negStart) / (negEnd - negStart)));
      // Smooth ramp 0 -> 1 via cosine ease, then scale to -0.5
      const easeNeg = (1 - Math.cos(Math.PI * y)) / 2; // 0 at y=0, 1 at y=1
      tNegative = -0.5 * easeNeg;
    }

    let t = tPositive + tNegative;

    // Do not allow time to reduce penalties on incorrect answers (no forgiveness when wrong)
    if (!update.isCorrect && t < 0) {
      t = 0;
    }

    return t;
  }

  private getSectionOptimalTime(subdomainId: string | number): number {
    const subId = Number(subdomainId);
    let domainId: number | null = null;
    for (const [domainKey, [start, end]] of Object.entries(DOMAIN_RANGES)) {
      if (subId >= start && subId <= end) {
        domainId = Number(domainKey);
        break;
      }
    }
    // Math domains 0-3 → 95s; Reading & Writing domains 4-7 → 71s
    if (domainId !== null && domainId >= 0 && domainId <= 3) return 95;
    return 71;
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
      const gain = this.config.confidenceGainRate * (1 + competencyGap / SCORING_CONSTANTS.MAX_SCORE);
      return Math.min(
        SCORING_CONSTANTS.MAX_SCORE, 
        Math.min(score.competencyScore + ALGORITHM_CONFIG.CONFIDENCE_CAP_OFFSET, currentConfidence + gain)
      );
    } else {
      const loss = this.config.confidenceLossRate * (1 + competencyGap / SCORING_CONSTANTS.MAX_SCORE);
      return Math.max(SCORING_CONSTANTS.MIN_SCORE, currentConfidence - loss);
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
    
    diffPerf.avgTime = ((diffPerf.avgTime * oldTotal) + update.timeSpent) / diffPerf.attempts;
  }

  private updateTimeTracking(score: SubdomainScore, timeSpent: number): void {
    const oldTotal = score.totalAttempts - 1;
    score.averageTimeSpent = ((score.averageTimeSpent * oldTotal) + timeSpent) / score.totalAttempts;
  }

  private updateDerivedMetrics(score: SubdomainScore): void {
    score.masteryLevel = this.calculateMasteryLevel(score.competencyScore);
    score.isStable = this.calculateStability(score);
    score.improvementRate = this.calculateImprovementRate(score);
    score.timeToMastery = this.estimateTimeToMastery(score);
  }

  private calculateMasteryLevel(competencyScore: number): 'beginner' | 'developing' | 'proficient' | 'advanced' | 'master' {
    if (competencyScore >= SCORING_CONSTANTS.MASTER_MIN) return 'master';
    if (competencyScore >= SCORING_CONSTANTS.PROFICIENT_MAX) return 'advanced';
    if (competencyScore >= SCORING_CONSTANTS.DEVELOPING_MAX) return 'proficient';
    if (competencyScore >= SCORING_CONSTANTS.BEGINNER_MAX) return 'developing';
    return 'beginner';
  }

  private calculateStability(score: SubdomainScore): boolean {
    if (score.recentAttempts.length < SCORING_CONSTANTS.RECENT_ATTEMPTS_FOR_STABILITY) return false;
    
    const recentAccuracies = score.recentAttempts.slice(-SCORING_CONSTANTS.RECENT_ATTEMPTS_FOR_STABILITY).map(a => a.isCorrect ? 1 : 0);
    const variance = this.calculateVariance(recentAccuracies);
    
    return variance < SCORING_CONSTANTS.VARIANCE_STABILITY_THRESHOLD;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateImprovementRate(score: SubdomainScore): number {
    if (score.recentAttempts.length < SCORING_CONSTANTS.MIN_ATTEMPTS_FOR_IMPROVEMENT) return 0;
    
    const recent = score.recentAttempts.slice(-SCORING_CONSTANTS.IMPROVEMENT_SAMPLE_SIZE);
    const firstHalf = recent.slice(0, SCORING_CONSTANTS.MIN_ATTEMPTS_FOR_IMPROVEMENT);
    const secondHalf = recent.slice(SCORING_CONSTANTS.MIN_ATTEMPTS_FOR_IMPROVEMENT);
    
    if (firstHalf.length < SCORING_CONSTANTS.MIN_ATTEMPTS_FOR_IMPROVEMENT || secondHalf.length < SCORING_CONSTANTS.MIN_ATTEMPTS_FOR_IMPROVEMENT) return 0;

    const firstAccuracy = firstHalf.filter(a => a.isCorrect).length / firstHalf.length;
    const secondAccuracy = secondHalf.filter(a => a.isCorrect).length / secondHalf.length;
    
    return (secondAccuracy - firstAccuracy) * SCORING_CONSTANTS.MAX_SCORE;
  }

  private estimateTimeToMastery(score: SubdomainScore): number {
    const targetScore = SCORING_CONSTANTS.ADVANCED_MAX;
    if (score.competencyScore >= targetScore) return 0;
    
    const improvementRate = Math.max(SCORING_CONSTANTS.MIN_IMPROVEMENT_RATE, score.improvementRate || 1);
    const scoreDifference = targetScore - score.competencyScore;
    
    return Math.ceil(scoreDifference / improvementRate);
  }

  private getTimeSinceLastPractice(lastPracticed: number): number {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    return (Date.now() - lastPracticed) / millisecondsPerDay;
  }

  private calculateDataReliabilityPriority(totalAttempts: number): number {
    if (totalAttempts < SCORING_CONSTANTS.DATA_RELIABILITY.LOW_ATTEMPTS_THRESHOLD) {
      return SCORING_CONSTANTS.DATA_RELIABILITY.LOW_PRIORITY;
    }
    if (totalAttempts < SCORING_CONSTANTS.DATA_RELIABILITY.MEDIUM_ATTEMPTS_THRESHOLD) {
      return SCORING_CONSTANTS.DATA_RELIABILITY.MEDIUM_PRIORITY;
    }
    if (totalAttempts < SCORING_CONSTANTS.DATA_RELIABILITY.HIGH_ATTEMPTS_THRESHOLD) {
      return SCORING_CONSTANTS.DATA_RELIABILITY.HIGH_PRIORITY;
    }
    return 0;
  }

  private calculateLearningVelocityPriority(score: SubdomainScore): number {
    const { LEARNING_VELOCITY: LV } = SCORING_CONSTANTS;
    
    if (score.improvementRate > LV.FAST_IMPROVEMENT_THRESHOLD && score.competencyScore < LV.FAST_COMPETENCY_THRESHOLD) {
      return 12; // High priority for fast learners.
    }
    if (score.improvementRate < LV.STRUGGLING_IMPROVEMENT_THRESHOLD) {
      return 10; // High priority for struggling learners.
    }
    if (Math.abs(score.improvementRate) < LV.PLATEAU_IMPROVEMENT_THRESHOLD && 
        score.competencyScore > LV.PLATEAU_MIN_COMPETENCY && 
        score.competencyScore < LV.PLATEAU_MAX_COMPETENCY && 
        score.totalAttempts > LV.PLATEAU_MIN_ATTEMPTS) {
      return 8; // Medium priority for plateaued learners.
    }
    if (score.competencyScore > LV.HIGH_PERFORMER_COMPETENCY && 
        Math.abs(score.improvementRate) < LV.STABLE_IMPROVEMENT_THRESHOLD) {
      return 2; // Low priority for stable high-performers.
    }
    return 7;
  }

  private calculateTimePerformancePriority(score: SubdomainScore): number {
    if (score.averageTimeSpent === 0 || score.optimalTimeEstimate === 0) return 0;

    const timeRatio = score.averageTimeSpent / score.optimalTimeEstimate;
    const { TIME_PERFORMANCE: TP } = SCORING_CONSTANTS;

    if (timeRatio > TP.SLOW_ACCURATE_THRESHOLD && score.competencyScore > TP.SLOW_ACCURATE_MIN_COMPETENCY) {
      return 8; // Medium-high priority for slow but accurate users.
    }
    if (timeRatio > TP.VERY_SLOW_THRESHOLD) {
      return 12; // High priority for very slow users.
    }
    if (timeRatio < TP.FAST_INACCURATE_THRESHOLD && score.competencyScore < TP.FAST_INACCURATE_MAX_COMPETENCY) {
      return 10; // High priority for fast but inaccurate users.
    }
    if (timeRatio >= TP.OPTIMAL_TIME_MIN && timeRatio <= TP.OPTIMAL_TIME_MAX) {
      return 0; // No priority adjustment for optimal timing.
    }
    return 3;
  }
}
