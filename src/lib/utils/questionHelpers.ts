import { Question, QuestionOption, QuestionImage as QuestionImageType } from '@/lib/types/practice';

/**
 * Type guard to check if options are enhanced QuestionOption objects
 */
export function isEnhancedOptions(options: Question['options']): options is QuestionOption[] {
  return Array.isArray(options) && 
         options.length > 0 && 
         typeof options[0] === 'object' && 
         ('text' in options[0] || 'imageURL' in options[0]);
}

/**
 * Type guard to check if options are legacy string array
 */
export function isStringOptions(options: Question['options']): options is string[] {
  return Array.isArray(options) && 
         options.length > 0 && 
         typeof options[0] === 'string';
}

/**
 * Type guard to check if options is a single string (for text input questions)
 */
export function isSingleStringOption(options: Question['options']): options is string {
  return typeof options === 'string';
}

/**
 * Convert legacy question format to enhanced format
 */
export function normalizeQuestionOptions(question: Question): QuestionOption[] | string {
  // If it's already enhanced options, return as-is
  if (isEnhancedOptions(question.options)) {
    return question.options;
  }
  
  // If it's a single string (text input), return as-is
  if (isSingleStringOption(question.options)) {
    return question.options;
  }
  
  // Convert legacy string array to enhanced options
  if (isStringOptions(question.options)) {
    return question.options.map(text => ({ text }));
  }
  
  // Fallback - shouldn't happen with proper typing
  return [];
}

/**
 * Get the question image (either legacy or enhanced format)
 */
export function getQuestionImage(question: Question): QuestionImageType | string | null {
  // Prefer new enhanced format
  if (question.questionImage) {
    return question.questionImage;
  }
  
  // Fall back to legacy format
  if (question.imageURL && question.imageURL.trim() !== '') {
    return question.imageURL;
  }
  
  return null;
}

/**
 * Check if a question has any images (question or options)
 */
export function questionHasImages(question: Question): boolean {
  // Check question image
  if (getQuestionImage(question)) {
    return true;
  }
  
  // Check option images
  if (isEnhancedOptions(question.options)) {
    return question.options.some(option => option.imageURL && option.imageURL.trim() !== '');
  }
  
  return false;
}

/**
 * Check if any options have images
 */
export function hasOptionImages(question: Question): boolean {
  if (isEnhancedOptions(question.options)) {
    return question.options.some(option => option.imageURL && option.imageURL.trim() !== '');
  }
  return false;
}

/**
 * Check if any options have text
 */
export function hasOptionText(question: Question): boolean {
  if (isEnhancedOptions(question.options)) {
    return question.options.some(option => option.text && option.text.trim() !== '');
  }
  
  if (isStringOptions(question.options)) {
    return question.options.some(text => text.trim() !== '');
  }
  
  return false;
}

/**
 * Determine the display mode for options
 */
export function getOptionDisplayMode(question: Question): 'text' | 'image' | 'mixed' | 'input' {
  if (isSingleStringOption(question.options)) {
    return 'input';
  }
  
  if (!isEnhancedOptions(question.options)) {
    return 'text'; // Legacy string array
  }
  
  const hasImages = hasOptionImages(question);
  const hasText = hasOptionText(question);
  
  if (hasImages && hasText) {
    return 'mixed';
  } else if (hasImages) {
    return 'image';
  } else {
    return 'text';
  }
}

/**
 * Get display text for an option (handles both legacy and enhanced formats)
 */
export function getOptionText(question: Question, index: number): string {
  const options = question.options;
  
  if (isStringOptions(options)) {
    return options[index] || '';
  }
  
  if (isEnhancedOptions(options)) {
    return options[index]?.text || `Option ${String.fromCharCode(65 + index)}`;
  }
  
  return '';
}

/**
 * Get image URL for an option
 */
export function getOptionImageURL(question: Question, index: number): string | null {
  if (isEnhancedOptions(question.options)) {
    const option = question.options[index];
    return option?.imageURL && option.imageURL.trim() !== '' ? option.imageURL : null;
  }
  
  return null;
}

/**
 * Convert a URL string to QuestionImageType format
 */
export function urlToQuestionImage(url: string, alt?: string): QuestionImageType {
  return {
    url,
    alt: alt || 'Question illustration'
  };
} 