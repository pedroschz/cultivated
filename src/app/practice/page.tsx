"use client";

import { useEffect, useState } from 'react';
import { usePracticeSession, PracticeSessionProvider, fetchQuestions } from '@/lib/context/PracticeSessionContext';
import { Question } from '@/lib/types/practice';
import { useRouter } from 'next/navigation';

function PracticeSession() {
  const { state, dispatch } = usePracticeSession();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadQuestions() {
      try {
        const fetchedQuestions = await fetchQuestions();
        setQuestions(fetchedQuestions);
        console.log('Fetched questions:', fetchedQuestions);
      } catch (error) {
        console.error('Error loading questions:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuestions();
  }, []);

  useEffect(() => {
    console.log('Practice session state:', state);
    // Only redirect if we're not loading and there's definitely no session
    if (!state.session && !isLoading && questions.length > 0) {
      console.log('No active session and questions loaded, redirecting to dashboard');
      router.replace('/dashboard');
    }
  }, [state.session, router, isLoading, questions.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">No questions found</h1>
        <p className="text-gray-600">Please check your Firestore database or try again later.</p>
      </div>
    );
  }

  // Wait for session to be initialized
  if (!state.session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (state.showResults) {
    if (!state.session) return null;
    
    const correctAnswers = Object.values(state.session.userAnswers).filter(
      (answer) => answer.isCorrect
    ).length;
    const totalQuestions = state.session.questions.length;
    const percentage = (correctAnswers / totalQuestions) * 100;

    console.log('Showing results:', {
      correctAnswers,
      totalQuestions,
      percentage,
      userAnswers: state.session.userAnswers
    });

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-3xl font-bold mb-8">Session Results</h1>
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold mb-2">Score</h2>
            <p className="text-4xl font-bold text-blue-500">{percentage.toFixed(1)}%</p>
            <p className="text-gray-600 mt-2">
              {correctAnswers} correct out of {totalQuestions} questions
            </p>
          </div>
          <button
            onClick={() => {
              console.log('Returning to dashboard, current state:', state);
              router.replace('/dashboard');
            }}
            className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = state.session.questions[state.session.currentQuestionIndex];
  const userAnswer = state.session.userAnswers[currentQuestion.id];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Practice Session</h1>
          <div className="text-lg font-semibold">
            Time Remaining: {Math.floor(state.timeRemaining / 60)}:
            {(state.timeRemaining % 60).toString().padStart(2, '0')}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-4">
            <span className="text-sm text-gray-500">
              Question {state.session.currentQuestionIndex + 1} of {state.session.questions.length}
            </span>
          </div>

          <div className="mb-6">
            <p className="text-lg">{currentQuestion.question}</p>
            {currentQuestion.imageURL && (
              <img
                src={currentQuestion.imageURL}
                alt="Question illustration"
                className="mt-4 max-w-full rounded-lg"
              />
            )}
          </div>

          {!userAnswer ? (
            <div className="space-y-3">
              {currentQuestion.options?.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    const isCorrect = index === currentQuestion.answer;
                    const timeSpent = state.session!.duration * 60 - state.timeRemaining;
                    dispatch({
                      type: 'ANSWER_QUESTION',
                      payload: {
                        questionId: String(currentQuestion.id),
                        answer: index,
                        isCorrect,
                        timeSpent,
                        domain: currentQuestion.domain ? String(currentQuestion.domain) : undefined
                      },
                    });
                  }}
                  className="w-full p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {currentQuestion.options?.map((option, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg ${
                    index === currentQuestion.answer
                      ? 'bg-green-100 border-green-500'
                      : index === userAnswer.answer && !userAnswer.isCorrect
                      ? 'bg-red-100 border-red-500'
                      : 'bg-gray-50'
                  }`}
                >
                  {option}
                </div>
              ))}
              <div className="mt-4">
                {userAnswer.isCorrect ? (
                  <p className="text-green-600 font-semibold">Correct!</p>
                ) : (
                  <p className="text-red-600 font-semibold">Incorrect</p>
                )}
              </div>
              {state.session.currentQuestionIndex < state.session.questions.length - 1 ? (
                <button
                  onClick={() => dispatch({ type: 'NEXT_QUESTION' })}
                  className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Next Question
                </button>
              ) : (
                <button
                  onClick={() => {
                    console.log('Finish Session clicked - Current state:', {
                      session: state.session,
                      showResults: state.showResults,
                      isActive: state.isActive,
                      currentQuestionIndex: state.session?.currentQuestionIndex,
                      totalQuestions: state.session?.questions.length
                    });
                    
                    // Ensure we're at the last question
                    if (state.session!.currentQuestionIndex === state.session!.questions.length - 1) {
                      dispatch({ type: 'COMPLETE_SESSION' });
                      console.log('Dispatched COMPLETE_SESSION');
                    } else {
                      console.log('Not at last question, cannot finish session');
                    }
                  }}
                  className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-colors"
                >
                  Finish Session
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PracticePage() {
  return (
    <PracticeSessionProvider>
      <PracticeSession />
    </PracticeSessionProvider>
  );
} 