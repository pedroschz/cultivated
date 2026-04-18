import React from 'react';
import { LatexRenderer } from '@/components/ui/latex';

/**
 * @file This component renders a complete question display including the question text,
 * optional reading passage, explanation, image, and metadata. It handles different
 * question formats and provides a consistent layout for question presentation.
 */

/**
 * Props for the QuestionDisplay component.
 */
interface QuestionDisplayProps {
  /** The question object containing all question data. */
  question: {
    question: string;
    passage?: string;
    explanation?: string;
    options?: string[] | any[];
    image?: string;
    image_description?: string;
    domain?: number;
    domainName?: string;
    skill?: string;
    difficulty?: number;
  };
  /** Whether to show the explanation section. */
  showExplanation?: boolean;
  /** Whether to show the reading passage section. */
  showPassage?: boolean;
  /** Optional extra classes to apply to the <img> element to control sizing (used by /history). */
  imageClassName?: string;
}

/**
 * A component that renders a complete question display with all its components.
 * It handles reading passages, question text, images, explanations, and metadata
 * in a consistent and accessible format.
 * 
 * @param question - The question object containing all display data.
 * @param showExplanation - Whether to display the explanation section.
 * @param showPassage - Whether to display the reading passage section.
 * @returns A React component displaying the complete question.
 */
export function QuestionDisplay({ 
  question, 
  showExplanation = false, 
  showPassage = true,
  imageClassName
}: QuestionDisplayProps) {
  return (
    <div className="question-display space-y-4">
      {/* Reading passage section (for reading comprehension questions) */}
      {showPassage && question.passage && (
        <div className="question-passage bg-gray-50 p-4 rounded-lg">
          <div className="prose prose-sm max-w-none">
            <LatexRenderer>{question.passage}</LatexRenderer>
          </div>
        </div>
      )}
      
      {/* Question image with optional description */}
      {question.image && (
        <div className="question-image">
          <img 
            src={question.image} 
            alt={question.image_description || 'Question image'}
            className={`w-full max-w-md mx-auto rounded-lg shadow-md ${imageClassName || ''}`}
          />
          {question.image_description && (
            <p className="text-sm text-gray-600 text-center mt-2">
              {question.image_description}
            </p>
          )}
        </div>
      )}
      
      {/* Main question text with LaTeX rendering support */}
      <div className="question-text">
        <div className="prose prose-lg max-w-none">
          <LatexRenderer>{question.question}</LatexRenderer>
        </div>
      </div>
      
      {/* Explanation section (typically shown after answer submission) */}
      {showExplanation && question.explanation && (
        <div className="question-explanation mt-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
          <h4 className="font-semibold text-blue-900 mb-2">Explanation:</h4>
          <div className="prose prose-sm max-w-none text-blue-800">
            <LatexRenderer>{question.explanation}</LatexRenderer>
          </div>
        </div>
      )}
      
      {/* Question metadata on a single line */}
      <div className="question-metadata text-sm text-gray-500">
        Domain: {question.domainName || `Domain ${question.domain}`} <span className="mx-2">•</span>
        Skill: {question.skill} <span className="mx-2">•</span>
        Difficulty: {question.difficulty !== undefined ? ['Easy', 'Medium', 'Hard'][question.difficulty] : 'Unknown'}
      </div>
    </div>
  );
} 