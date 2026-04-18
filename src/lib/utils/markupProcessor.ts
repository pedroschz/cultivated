/**
 * This module provides functions for processing custom markup within text fields
 * of questions, such as converting LaTeX delimiters into a custom <equation> tag.
 */

/**
 * Processes a string containing custom markup, replacing it with standard HTML or custom elements.
 * @param text The input string to process.
 * @returns A new string with the markup processed.
 */
export function processMarkup(text: string): string {
  if (!text) return text;
  
  return text
    // Replace LaTeX delimiters ($...$) with a custom <equation> tag.
    // This regex is non-greedy and handles edge cases like empty content.
    .replace(/\$([^$]*?)\$/g, (match, content) => {
      if (content === '' || content === '$') {
        return match; // Avoid processing empty or invalid LaTeX.
      }
      return `<equation>${content}</equation>`;
    })
    // Remove the @@ markers, which are used as placeholders in the source content.
    .replace(/@@/g, '')
    // HTML tags like <i>, <b>, <table> are left as-is.
    .trim();
}

/**
 * Applies markup processing to all relevant text fields within a question object.
 * @param question The question object to process.
 * @returns A new question object with all its text fields processed.
 */
export function processQuestionMarkup(question: any): any {
  return {
    ...question,
    question: processMarkup(question.question),
    passage: question.passage ? processMarkup(question.passage) : undefined,
    explanation: processMarkup(question.explanation),
    options: Array.isArray(question.options) 
      ? question.options.map((opt: any) => 
          // Only process options if they are strings.
          typeof opt === 'string' ? processMarkup(opt) : opt
        )
      : question.options
  };
}
