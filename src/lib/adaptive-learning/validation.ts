/**
 * Validation utilities for the adaptive learning system.
 * These functions ensure data integrity and type safety throughout the system.
 */

import { ScoreUpdate, SubdomainScore } from '../types/adaptive-learning';
import { Question } from '../types/practice';
import { SCORING_CONSTANTS } from './constants';
import { 
  AdaptiveLearningValidationError, 
  AdaptiveLearningDataError,
  ERROR_CODES 
} from './errors';
import { SkillService } from './skill-mapping';

/**
 * Validates a score update object
 */
export function validateScoreUpdate(update: Partial<ScoreUpdate>): asserts update is ScoreUpdate {
  if (!update.subdomainId) {
    throw new AdaptiveLearningValidationError(
      'SubdomainId is required for score updates',
      'subdomainId',
      update.subdomainId,
      { code: ERROR_CODES.MISSING_REQUIRED_FIELD }
    );
  }

  if (!update.questionId) {
    throw new AdaptiveLearningValidationError(
      'QuestionId is required for score updates',
      'questionId',
      update.questionId,
      { code: ERROR_CODES.MISSING_REQUIRED_FIELD }
    );
  }

  if (typeof update.isCorrect !== 'boolean') {
    throw new AdaptiveLearningValidationError(
      'isCorrect must be a boolean value',
      'isCorrect',
      update.isCorrect,
      { code: ERROR_CODES.INVALID_SCORE_RANGE }
    );
  }

  if (typeof update.timeSpent !== 'number' || update.timeSpent < 0) {
    throw new AdaptiveLearningValidationError(
      'timeSpent must be a non-negative number',
      'timeSpent',
      update.timeSpent,
      { code: ERROR_CODES.INVALID_TIME_VALUE }
    );
  }

  if (typeof update.difficulty !== 'number' || ![0, 1, 2].includes(update.difficulty)) {
    throw new AdaptiveLearningValidationError(
      'difficulty must be 0 (easy), 1 (medium), or 2 (hard)',
      'difficulty',
      update.difficulty,
      { code: ERROR_CODES.INVALID_DIFFICULTY_LEVEL }
    );
  }

  if (typeof update.timestamp !== 'number' || update.timestamp <= 0) {
    throw new AdaptiveLearningValidationError(
      'timestamp must be a positive number',
      'timestamp',
      update.timestamp,
      { code: ERROR_CODES.INVALID_TIME_VALUE }
    );
  }
}

/**
 * Validates a subdomain score object
 */
export function validateSubdomainScore(score: Partial<SubdomainScore>): asserts score is SubdomainScore {
  if (typeof score.competencyScore !== 'number' || 
      score.competencyScore < SCORING_CONSTANTS.MIN_SCORE || 
      score.competencyScore > SCORING_CONSTANTS.MAX_SCORE) {
    throw new AdaptiveLearningValidationError(
      `competencyScore must be between ${SCORING_CONSTANTS.MIN_SCORE} and ${SCORING_CONSTANTS.MAX_SCORE}`,
      'competencyScore',
      score.competencyScore,
      { code: ERROR_CODES.INVALID_SCORE_RANGE }
    );
  }

  if (typeof score.confidenceLevel !== 'number' || 
      score.confidenceLevel < SCORING_CONSTANTS.MIN_SCORE || 
      score.confidenceLevel > SCORING_CONSTANTS.MAX_SCORE) {
    throw new AdaptiveLearningValidationError(
      `confidenceLevel must be between ${SCORING_CONSTANTS.MIN_SCORE} and ${SCORING_CONSTANTS.MAX_SCORE}`,
      'confidenceLevel',
      score.confidenceLevel,
      { code: ERROR_CODES.INVALID_SCORE_RANGE }
    );
  }

  if (typeof score.totalAttempts !== 'number' || score.totalAttempts < 0) {
    throw new AdaptiveLearningValidationError(
      'totalAttempts must be a non-negative number',
      'totalAttempts',
      score.totalAttempts,
      { code: ERROR_CODES.INVALID_SCORE_RANGE }
    );
  }

  if (typeof score.correctCount !== 'number' || score.correctCount < 0) {
    throw new AdaptiveLearningValidationError(
      'correctCount must be a non-negative number',
      'correctCount',
      score.correctCount,
      { code: ERROR_CODES.INVALID_SCORE_RANGE }
    );
  }

  if (typeof score.incorrectCount !== 'number' || score.incorrectCount < 0) {
    throw new AdaptiveLearningValidationError(
      'incorrectCount must be a non-negative number',
      'incorrectCount',
      score.incorrectCount,
      { code: ERROR_CODES.INVALID_SCORE_RANGE }
    );
  }

  if (score.correctCount + score.incorrectCount !== score.totalAttempts) {
    throw new AdaptiveLearningValidationError(
      'correctCount + incorrectCount must equal totalAttempts',
      'attempts',
      { correctCount: score.correctCount, incorrectCount: score.incorrectCount, totalAttempts: score.totalAttempts },
      { code: ERROR_CODES.CORRUPTED_SUBDOMAIN_SCORES }
    );
  }
}

/**
 * Validates a question object for use in adaptive learning
 */
export function validateQuestion(question: Partial<Question>): asserts question is Question {
  if (!question.id) {
    throw new AdaptiveLearningValidationError(
      'Question id is required',
      'id',
      question.id,
      { code: ERROR_CODES.MISSING_REQUIRED_FIELD }
    );
  }

  if (!question.skill) {
    throw new AdaptiveLearningValidationError(
      'Question skill is required for adaptive learning',
      'skill',
      question.skill,
      { code: ERROR_CODES.MISSING_REQUIRED_FIELD }
    );
  }

  // Validate that the skill exists in our mapping (O(1))
  const skillMapping = SkillService.getBySkillName(question.skill);
  if (!skillMapping) {
    throw new AdaptiveLearningValidationError(
      `Unknown skill: ${question.skill}`,
      'skill',
      question.skill,
      { code: ERROR_CODES.SKILL_MAPPING_NOT_FOUND }
    );
  }

  if (typeof question.difficulty !== 'number' || ![0, 1, 2].includes(question.difficulty)) {
    throw new AdaptiveLearningValidationError(
      'Question difficulty must be 0 (easy), 1 (medium), or 2 (hard)',
      'difficulty',
      question.difficulty,
      { code: ERROR_CODES.INVALID_DIFFICULTY_LEVEL }
    );
  }

  if (typeof question.domain !== 'number') {
    throw new AdaptiveLearningValidationError(
      'Question domain must be a number',
      'domain',
      question.domain,
      { code: ERROR_CODES.MISSING_REQUIRED_FIELD }
    );
  }
}

/**
 * Validates user ID format
 */
export function validateUserId(userId: string): asserts userId is string {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new AdaptiveLearningValidationError(
      'Valid userId is required',
      'userId',
      userId,
      { code: ERROR_CODES.INVALID_USER_ID }
    );
  }
}

/**
 * Validates subdomain ID format and existence
 */
export function validateSubdomainId(subdomainId: string): asserts subdomainId is string {
  if (!subdomainId || typeof subdomainId !== 'string') {
    throw new AdaptiveLearningValidationError(
      'Valid subdomainId is required',
      'subdomainId',
      subdomainId,
      { code: ERROR_CODES.INVALID_SUBDOMAIN_ID }
    );
  }
}

/**
 * Validates session length parameter
 */
export function validateSessionLength(sessionLength: number): asserts sessionLength is number {
  if (typeof sessionLength !== 'number' || sessionLength <= 0 || sessionLength > 100) {
    throw new AdaptiveLearningValidationError(
      'sessionLength must be a positive number between 1 and 100',
      'sessionLength',
      sessionLength,
      { code: ERROR_CODES.INVALID_SCORE_RANGE }
    );
  }
}

/**
 * Type guard to safely check if a question has the required properties
 */
export function isValidQuestionForAdaptiveLearning(question: any): question is Question {
  try {
    validateQuestion(question);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to safely check if a score update is valid
 */
export function isValidScoreUpdate(update: any): update is ScoreUpdate {
  try {
    validateScoreUpdate(update);
    return true;
  } catch {
    return false;
  }
}