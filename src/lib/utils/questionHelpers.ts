import { Question, QuestionOption, QuestionImage as QuestionImageType } from '@/lib/types/practice';

/**
 * This module provides a set of helper functions for processing and extracting
 * data from `Question` objects. It helps handle different data formats (e.g., legacy vs. enhanced options)
 * and extract specific content like images or graph data from question text.
 */

/**
 * Type guard to determine if a question's options are in the enhanced `QuestionOption[]` format.
 * @param options - The options array from a Question object.
 * @returns True if the options are enhanced `QuestionOption` objects.
 */
export function isEnhancedOptions(options: Question['options']): options is QuestionOption[] {
  return Array.isArray(options) && 
         options.length > 0 && 
         typeof options[0] === 'object' && 
         options[0] !== null &&
         ('text' in options[0] || 'imageURL' in options[0]);
}

/**
 * Type guard to determine if a question's options are a legacy `string[]`.
 * @param options - The options array from a Question object.
 * @returns True if the options are a simple array of strings.
 */
export function isStringOptions(options: Question['options']): options is string[] {
  return Array.isArray(options) && 
         options.length > 0 && 
         typeof options[0] === 'string';
}

/**
 * Normalizes a question's options to the enhanced `QuestionOption[]` format.
 * If the options are already in the enhanced format, it returns them as is.
 * If they are a legacy string array, it converts them.
 * @param question - The question object.
 * @returns The normalized options array, or null if the question has no options.
 */
export function normalizeQuestionOptions(question: Question): QuestionOption[] | null {
  if (isEnhancedOptions(question.options) || question.options === null) {
    return question.options;
  }
  
  if (isStringOptions(question.options)) {
    return question.options.map(text => ({ text }));
  }
  
  return []; // Fallback for unknown formats
}

/**
 * Extracts the main image for a question from its `image` property.
 * @param question - The question object.
 * @returns A `QuestionImageType` object if an image exists, otherwise null.
 */
export function getQuestionImage(question: Question): QuestionImageType | null {
  if (question.image && question.image.trim() !== '') {
    const altTextMatch = question.question.match(/<image-alt>([\s\S]*?)<\/image-alt>/i);
    const alt = altTextMatch && altTextMatch[1] ? altTextMatch[1] : 'Question image';
    return urlToQuestionImage(question.image, alt);
  }
  return null;
}

/**
 * Checks if a question contains any images, either in the main question body or in the options.
 * @param question - The question object.
 * @returns True if any images are present.
 */
export function questionHasImages(question: Question): boolean {
  if (getQuestionImage(question)) {
    return true;
  }
  if (isEnhancedOptions(question.options)) {
    return question.options.some(option => option.imageURL && option.imageURL.trim() !== '');
  }
  return false;
}

/**
 * Checks specifically if any of the question's options contain images.
 * @param question - The question object.
 * @returns True if at least one option has an image.
 */
export function hasOptionImages(question: Question): boolean {
  if (isEnhancedOptions(question.options)) {
    return question.options.some(option => option.imageURL && option.imageURL.trim() !== '');
  }
  return false;
}

/**
 * Checks if any of the question's options contain text.
 * @param question - The question object.
 * @returns True if at least one option has text.
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
 * Determines the appropriate display mode for the question's options based on their content.
 * @param question - The question object.
 * @returns The display mode: 'text', 'image', 'mixed' (both), or 'input' (for open-ended).
 */
export function getOptionDisplayMode(question: Question): 'text' | 'image' | 'mixed' | 'input' {
  if (question.options === null) {
    return 'input'; // Open-ended question
  }
  if (!isEnhancedOptions(question.options)) {
    return 'text'; // Legacy string array is always text-only
  }
  
  const hasImages = hasOptionImages(question);
  const hasText = hasOptionText(question);
  
  if (hasImages && hasText) return 'mixed';
  if (hasImages) return 'image';
  return 'text';
}

/**
 * Safely retrieves the text for a specific option by its index.
 * @param question - The question object.
 * @param index - The index of the option.
 * @returns The option text, or a default string if not found.
 */
export function getOptionText(question: Question, index: number): string {
  if (isStringOptions(question.options)) {
    return question.options[index] || '';
  }
  if (isEnhancedOptions(question.options)) {
    return question.options[index]?.text || `Option ${String.fromCharCode(65 + index)}`;
  }
  return '';
}

/**
 * Safely retrieves the image URL for a specific option by its index.
 * @param question - The question object.
 * @param index - The index of the option.
 * @returns The image URL string, or null if not found.
 */
export function getOptionImageURL(question: Question, index: number): string | null {
  if (isEnhancedOptions(question.options)) {
    const option = question.options[index];
    return option?.imageURL?.trim() ? option.imageURL : null;
  }
  return null;
}

/**
 * Parses a <graph> tag within the question text to extract a function and its properties.
 * Note: Uses the `Function` constructor, which should be used with caution. Assumes
 * content is from a trusted source.
 * @param question - The question object.
 * @returns An object containing the parsed function and its domain/range, or null if not found.
 */
export function getQuestionGraph(question: Question): { func: (x: number) => number; domain: [number, number]; range: [number, number] } | null {
  const match = question.question.match(/<graph>f\(x\) = (.*?)<\/graph>/);
  if (match && match[1]) {
    try {
      const functionBody = `return ${match[1]}`;
      const func = new Function('x', functionBody) as (x: number) => number;
      
      // Default domain/range, could be extended to be parsed from the tag attributes.
      return {
        func,
        domain: [-10, 10], 
        range: [-10, 10],  
      };
    } catch (error) {
      console.error('Error parsing function from <graph> tag:', error);
      return null;
    }
  }
  return null;
}

/**
 * Converts a URL string into a `QuestionImageType` object.
 * @param url - The URL of the image.
 * @param alt - Optional alternative text for the image.
 * @returns A `QuestionImageType` object.
 */
export function urlToQuestionImage(url: string, alt?: string): QuestionImageType {
  return {
    url,
    alt: alt || 'Question illustration'
  };
}

/**
 * Sanitizes text by removing special syntax markers used for rendering.
 * This is useful for sending clean text to the AI Tutor.
 * @param text The input string to sanitize.
 * @returns The sanitized string.
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/@@/g, '')
    .replace(/\*/g, '')
    .replace(/\$\$/g, '')
    .replace(/^###\s*/gm, '')
    .trim();
}
