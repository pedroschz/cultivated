/**
 * This module provides functions for checking the correctness of user-submitted answers,
 * with special handling for open-ended numerical questions that may involve fractions
 * or require specific rounding.
 */

/**
 * Parses a string that could represent a number, fraction, or decimal.
 * @param value The string or number to parse.
 * @returns The numeric value of the input, or null if it cannot be parsed.
 */
function parseAnswer(value: string | number): number | null {
  if (typeof value === 'number') {
    return value;
  }

  const trimmedValue = value.toString().trim();

  // Handle fractions (e.g., "3/4")
  if (trimmedValue.includes('/')) {
    const parts = trimmedValue.split('/');
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }
    return null; // Invalid fraction format
  }

  // Handle decimals and whole numbers
  const num = parseFloat(trimmedValue);
  return isNaN(num) ? null : num;
}

/**
 * Generates all valid numeric representations of an answer based on specific rounding rules.
 * This is to account for minor precision differences in user input.
 * @param answer A single correct answer (string or number).
 * @returns A Set of numbers representing all valid rounded forms of the answer.
 */
function generateNumericRepresentations(answer: string | number): Set<number> {
  const representations = new Set<number>();
  const num = parseAnswer(answer);

  if (num === null) {
    return representations;
  }

  // Add the original, unrounded number
  representations.add(num);

  const numAsString = String(num);
  // Special rounding case for numbers with exactly 5 decimal places ending in 5 (e.g., 0.12345)
  if (numAsString.match(/\.\d{4}5$/)) {
    // Both rounding up and down are considered correct in this edge case.
    const roundedDown = Math.floor(num * 10000) / 10000;
    const roundedUp = Math.ceil(num * 10000) / 10000;
    representations.add(parseFloat(roundedDown.toFixed(4)));
    representations.add(parseFloat(roundedUp.toFixed(4)));
  } else {
    // Standard rounding to 4 decimal places for all other numbers.
    const rounded = Math.round(num * 10000) / 10000;
    representations.add(parseFloat(rounded.toFixed(4)));
  }

  return representations;
}

/**
 * Checks if a user's answer for an open-ended question is correct.
 * It handles various numeric formats (fractions, decimals) and non-numeric strings,
 * applying specific rounding rules for numeric comparisons.
 * @param userAnswer The answer submitted by the user.
 * @param correctAnswer The correct answer or an array of possible correct answers.
 * @returns True if the user's answer is considered correct, false otherwise.
 */
export function checkOpenEndedAnswer(
  userAnswer: string | number,
  correctAnswer: number | string | (number | string)[]
): boolean {
  const userNum = parseAnswer(userAnswer);
  // Normalize correct answers: support comma-separated or "or"-separated strings
  const correctAnswers: (number | string)[] = (() => {
    const raw = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    const expanded: (number | string)[] = [];
    for (const ans of raw) {
      if (typeof ans === 'string') {
        // Split on commas or the word "or" (case-insensitive), but keep fractions like 44/3 intact
        const parts = ans
          .split(/\s*,\s*|\s+or\s+/i)
          .map(p => p.trim())
          .filter(Boolean);
        if (parts.length > 1) {
          expanded.push(...parts);
        } else {
          expanded.push(ans);
        }
      } else {
        expanded.push(ans);
      }
    }
    return expanded;
  })();
    
  // If the user's answer can't be parsed as a number, perform a direct string comparison.
  if (userNum === null) {
    const userAnswerString = String(userAnswer).trim().toLowerCase();
    return correctAnswers.some(
      (ans) => String(ans).trim().toLowerCase() === userAnswerString
    );
  }

  // Generate all valid numeric forms for the official correct answers.
  const allCorrectNumericForms = new Set<number>();
  for (const ans of correctAnswers) {
    const reps = generateNumericRepresentations(ans);
    reps.forEach(form => allCorrectNumericForms.add(form));
  }
  
  // Generate all valid numeric forms for the user's answer.
  const userNumericForms = generateNumericRepresentations(userNum);

  // Check if any of the user's numeric forms match any of the correct forms.
  for (const userForm of userNumericForms) {
    if (allCorrectNumericForms.has(userForm)) {
      return true;
    }
  }

  return false;
}
