/**
 * Error handling classes for the adaptive learning system.
 * These provide structured error handling with specific error codes and context.
 */

export class AdaptiveLearningError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AdaptiveLearningError';
  }
}

export class AdaptiveLearningScoringError extends AdaptiveLearningError {
  constructor(
    message: string,
    public subdomainId: string,
    public questionId?: string,
    context?: Record<string, any>
  ) {
    super(message, 'SCORING_ERROR', { subdomainId, questionId, ...context });
    this.name = 'AdaptiveLearningScoringError';
  }
}

export class AdaptiveLearningDataError extends AdaptiveLearningError {
  constructor(
    message: string,
    public userId: string,
    public field?: string,
    context?: Record<string, any>
  ) {
    super(message, 'DATA_ERROR', { userId, field, ...context });
    this.name = 'AdaptiveLearningDataError';
  }
}

export class AdaptiveLearningValidationError extends AdaptiveLearningError {
  constructor(
    message: string,
    public field: string,
    public value: any,
    context?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR', { field, value, ...context });
    this.name = 'AdaptiveLearningValidationError';
  }
}

export class AdaptiveLearningQuestionSelectionError extends AdaptiveLearningError {
  constructor(
    message: string,
    public userId: string,
    public sessionLength: number,
    context?: Record<string, any>
  ) {
    super(message, 'QUESTION_SELECTION_ERROR', { userId, sessionLength, ...context });
    this.name = 'AdaptiveLearningQuestionSelectionError';
  }
}

export class AdaptiveLearningDatabaseError extends AdaptiveLearningError {
  constructor(
    message: string,
    public operation: string,
    public userId?: string,
    context?: Record<string, any>
  ) {
    super(message, 'DATABASE_ERROR', { operation, userId, ...context });
    this.name = 'AdaptiveLearningDatabaseError';
  }
}

/**
 * Error codes used throughout the adaptive learning system
 */
export const ERROR_CODES = {
  // Validation errors
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_SCORE_RANGE: 'INVALID_SCORE_RANGE',
  INVALID_DIFFICULTY_LEVEL: 'INVALID_DIFFICULTY_LEVEL',
  INVALID_TIME_VALUE: 'INVALID_TIME_VALUE',
  INVALID_SUBDOMAIN_ID: 'INVALID_SUBDOMAIN_ID',
  INVALID_QUESTION_ID: 'INVALID_QUESTION_ID',
  INVALID_USER_ID: 'INVALID_USER_ID',
  
  // Data errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ADAPTIVE_LEARNING_DATA_NOT_FOUND: 'ADAPTIVE_LEARNING_DATA_NOT_FOUND',
  QUESTION_DATA_INCOMPLETE: 'QUESTION_DATA_INCOMPLETE',
  CORRUPTED_SUBDOMAIN_SCORES: 'CORRUPTED_SUBDOMAIN_SCORES',
  
  // Scoring errors
  SCORE_CALCULATION_FAILED: 'SCORE_CALCULATION_FAILED',
  PRIORITY_CALCULATION_FAILED: 'PRIORITY_CALCULATION_FAILED',
  TIME_DECAY_CALCULATION_FAILED: 'TIME_DECAY_CALCULATION_FAILED',
  
  // Question selection errors
  NO_QUESTIONS_AVAILABLE: 'NO_QUESTIONS_AVAILABLE',
  INSUFFICIENT_QUESTION_POOL: 'INSUFFICIENT_QUESTION_POOL',
  SKILL_MAPPING_NOT_FOUND: 'SKILL_MAPPING_NOT_FOUND',
  
  // Database errors
  FIRESTORE_READ_FAILED: 'FIRESTORE_READ_FAILED',
  FIRESTORE_WRITE_FAILED: 'FIRESTORE_WRITE_FAILED',
  FIRESTORE_UPDATE_FAILED: 'FIRESTORE_UPDATE_FAILED',
  FIRESTORE_BATCH_FAILED: 'FIRESTORE_BATCH_FAILED'
} as const;

/**
 * Utility function to check if an error is an adaptive learning error
 */
export function isAdaptiveLearningError(error: any): error is AdaptiveLearningError {
  return error instanceof AdaptiveLearningError;
}

/**
 * Utility function to extract error information for logging
 */
export function getErrorInfo(error: any): {
  message: string;
  code?: string;
  context?: Record<string, any>;
  stack?: string;
} {
  if (isAdaptiveLearningError(error)) {
    return {
      message: error.message,
      code: error.code,
      context: error.context,
      stack: error.stack
    };
  }
  
  return {
    message: error.message || 'Unknown error',
    stack: error.stack
  };
}

/**
 * Logging utility for adaptive learning errors
 */
export function logAdaptiveLearningError(error: any, operation?: string): void {
  const errorInfo = getErrorInfo(error);
  console.error('[AdaptiveLearning Error]', {
    operation,
    ...errorInfo,
    timestamp: new Date().toISOString()
  });
}