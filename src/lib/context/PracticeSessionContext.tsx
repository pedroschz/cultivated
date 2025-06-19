"use client";

import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { PracticeSessionState, PracticeSession, Question, PracticeSessionDuration } from '../types/practice';
import { collection, getDocs, getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { app, auth } from '@/lib/firebaseClient';
import { FirebaseApp } from 'firebase/app';
import { adaptiveLearningService } from '../adaptive-learning/adaptive-service';

type Action =
  | { type: 'START_SESSION'; payload: { duration: PracticeSessionDuration } }
  | { type: 'UPDATE_TIME'; payload: number }
  | { type: 'LOAD_NEXT_QUESTION'; payload: { question: Question } }
  | { type: 'ANSWER_QUESTION'; payload: { questionId: string; answer: number | string; isCorrect: boolean; timeSpent: number; domain?: string } }
  | { type: 'COMPLETE_SESSION' }
  | { type: 'SHOW_RESULTS' }
  | { type: 'FINISH_SESSION' }
  | { type: 'RESET_SESSION' };

const initialState: PracticeSessionState = {
  session: null,
  isActive: false,
  timeRemaining: 0,
  showResults: false,
};

// Load initial state from localStorage if available
const loadInitialState = (): PracticeSessionState => {
  if (typeof window === 'undefined') return initialState;
  const savedState = localStorage.getItem('practiceSessionState');
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      // Ensure the session is still valid
      if (parsed.session && parsed.session.endTime > Date.now()) {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing saved session state:', e);
    }
  }
  return initialState;
};

// Cache questions globally to avoid refetching
let questionCache: Question[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function updateUserStats(
  questionId: string,
  isCorrect: boolean,
  timeSpent: number,
  domain?: string
) {
  if (!app || !auth?.currentUser) return;

  const db = getFirestore(app as FirebaseApp);
  const userRef = doc(db, 'users', auth.currentUser.uid);
  
  try {
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('User document not found');
      return;
    }

    const userData = userDoc.data();
    // Initialize with proper structure
    const currentStats = userData.stats || {
      math: {
        field0: {},
        field1: {},
        field2: {},
        field3: {}
      },
      readingAndWriting: {
        field4: {},
        field5: {},
        field6: {},
        field7: {}
      }
    };

    // Ensure the structure exists
    if (!currentStats.math) currentStats.math = { field0: {}, field1: {}, field2: {}, field3: {} };
    if (!currentStats.readingAndWriting) currentStats.readingAndWriting = { field4: {}, field5: {}, field6: {}, field7: {} };
    
    // Ensure each field exists
    ['field0', 'field1', 'field2', 'field3'].forEach(field => {
      if (!currentStats.math[field]) currentStats.math[field] = {};
    });
    ['field4', 'field5', 'field6', 'field7'].forEach(field => {
      if (!currentStats.readingAndWriting[field]) currentStats.readingAndWriting[field] = {};
    });

    // FIXED: Determine which field and category the domain belongs to
    // Domain is 0-7, we need to map it correctly to fields
    const domainNum = parseInt(domain || '0');
    let field: string;
    let category: 'math' | 'readingAndWriting';

    // Math domains: 0-3
    if (domainNum === 0) {
      field = 'field0';
      category = 'math';
    } else if (domainNum === 1) {
      field = 'field1';
      category = 'math';
    } else if (domainNum === 2) {
      field = 'field2';
      category = 'math';
    } else if (domainNum === 3) {
      field = 'field3';
      category = 'math';
    }
    // Reading & Writing domains: 4-7
    else if (domainNum === 4) {
      field = 'field4';
      category = 'readingAndWriting';
    } else if (domainNum === 5) {
      field = 'field5';
      category = 'readingAndWriting';
    } else if (domainNum === 6) {
      field = 'field6';
      category = 'readingAndWriting';
    } else {
      field = 'field7';
      category = 'readingAndWriting';
    }

    // Get current domain stats
    const domainStats = currentStats[category][field][domain || ''] || {
      totalAnswered: 0,
      totalCorrect: 0, // FIXED: Changed from correctAnswers to totalCorrect
      accuracy: 0,
      averageTime: 0,
    };

    // Calculate new stats
    const newTotalAnswered = domainStats.totalAnswered + 1;
    const newTotalCorrect = domainStats.totalCorrect + (isCorrect ? 1 : 0); // FIXED: Changed variable name
    const newAccuracy = (newTotalCorrect / newTotalAnswered) * 100;
    const newAverageTime = ((domainStats.averageTime * domainStats.totalAnswered) + timeSpent) / newTotalAnswered;

    // Update stats for this domain
    const updates = {
      [`stats.${category}.${field}.${domain}`]: {
        totalAnswered: newTotalAnswered,
        totalCorrect: newTotalCorrect, // FIXED: Changed from correctAnswers to totalCorrect
        accuracy: newAccuracy,
        averageTime: newAverageTime,
      },
    };

    await updateDoc(userRef, updates);
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
}

async function updateUserHistory(session: PracticeSession, currentAnswer: { questionId: string; answer: number | string; isCorrect: boolean; timeSpent: number }) {
  if (!app || !auth?.currentUser) return;
  
  const db = getFirestore(app as FirebaseApp);
  const userRef = doc(db, 'users', auth.currentUser.uid);
  
  try {
    // Get current history first
    const userDoc = await getDoc(userRef);
    const currentHistory = userDoc.data()?.history || [];

    // Create single history entry for the current answer
    const historyEntry = {
      questionId: currentAnswer.questionId,
      selected: currentAnswer.answer,
      correct: currentAnswer.isCorrect,
      timeSpent: currentAnswer.timeSpent,
      answeredAt: new Date().toISOString()
    };

    // Add only the new entry to history
    const updatedHistory = [...currentHistory, historyEntry];

    // Update history in user document
    await updateDoc(userRef, {
      history: updatedHistory
    });
  } catch (error: any) {
    console.error('Error updating user history:', error);
    // If the error is due to missing history field, try initializing it first
    if (error.code === 'not-found') {
      const historyEntry = {
        questionId: currentAnswer.questionId,
        selected: currentAnswer.answer,
        correct: currentAnswer.isCorrect,
        timeSpent: currentAnswer.timeSpent,
        answeredAt: new Date().toISOString()
      };

      await updateDoc(userRef, {
        history: [historyEntry]
      });
    } else {
      throw error;
    }
  }
}

function practiceSessionReducer(state: PracticeSessionState, action: Action): PracticeSessionState {
  let newState: PracticeSessionState;

  switch (action.type) {
    case 'START_SESSION':
      const now = Date.now();
      console.log('Starting session with duration:', action.payload.duration);
      newState = {
        ...state,
        session: {
          duration: action.payload.duration,
          questions: [], // Start with empty questions array
          currentQuestionIndex: -1, // Will be 0 when first question loads
          startTime: now,
          endTime: now + action.payload.duration * 60 * 1000,
          isComplete: false,
          userAnswers: {},
          questionStartTimes: {},
        },
        isActive: true,
        timeRemaining: action.payload.duration * 60,
        showResults: false,
      };
      console.log('New session state:', newState);
      break;

    case 'UPDATE_TIME':
      if (action.payload <= 0) {
        // Time's up - complete the session
        newState = {
          ...state,
          timeRemaining: 0,
          isActive: false,
          showResults: true,
          session: state.session ? {
            ...state.session,
            isComplete: true,
            endTime: Date.now()
          } : null
        };
      } else {
        newState = {
          ...state,
          timeRemaining: action.payload,
        };
      }
      break;

    case 'LOAD_NEXT_QUESTION':
      if (!state.session) return state;
      
      // Check if we already have this question
      const isDuplicate = state.session.questions.some(q => q.id === action.payload.question.id);
      if (isDuplicate) {
        console.warn('Attempting to add duplicate question, ignoring:', action.payload.question.id);
        return state;
      }
      
      const currentTime = Date.now();
      const nextQuestionIndex = state.session.currentQuestionIndex + 1;
      const updatedQuestions = [...state.session.questions, action.payload.question];
      
      console.log('Loading next question:', {
        questionId: action.payload.question.id,
        currentIndex: state.session.currentQuestionIndex,
        nextIndex: nextQuestionIndex,
        totalQuestions: updatedQuestions.length,
        previousQuestionIds: state.session.questions.map(q => q.id)
      });
      
      newState = {
        ...state,
        session: {
          ...state.session,
          questions: updatedQuestions,
          currentQuestionIndex: nextQuestionIndex,
          questionStartTimes: {
            ...state.session.questionStartTimes,
            [action.payload.question.id]: currentTime
          }
        },
      };
      
      console.log('Next question loaded successfully:', newState.session?.currentQuestionIndex);
      break;

    case 'ANSWER_QUESTION':
      if (!state.session) return state;
      
      const questionStartTime = state.session.questionStartTimes?.[action.payload.questionId] || state.session.startTime;
      const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
      
      const currentQuestion = state.session.questions[state.session.currentQuestionIndex];
      const domain = currentQuestion.domain?.toString();
      
      // Update legacy stats
      updateUserStats(
        action.payload.questionId,
        action.payload.isCorrect,
        timeSpent,
        domain
      ).catch(console.error);

      // Update adaptive learning system
      if (auth?.currentUser) {
        adaptiveLearningService.updateUserScore(
          auth.currentUser.uid,
          action.payload.questionId,
          currentQuestion,
          action.payload.isCorrect,
          timeSpent
        ).catch(console.error);
      }

      const updatedSession = {
        ...state.session,
        userAnswers: {
          ...state.session.userAnswers,
          [action.payload.questionId]: {
            questionId: action.payload.questionId,
            answer: action.payload.answer,
            isCorrect: action.payload.isCorrect,
            timeSpent: timeSpent,
          },
        },
      };
      
      updateUserHistory(updatedSession, {
        questionId: action.payload.questionId,
        answer: action.payload.answer,
        isCorrect: action.payload.isCorrect,
        timeSpent: timeSpent
      }).catch(console.error);

      newState = {
        ...state,
        session: updatedSession,
      };
      break;

    case 'COMPLETE_SESSION':
      if (!state.session) return state;
      console.log('Completing session:', {
        currentState: state,
        session: state.session
      });
      
      newState = {
        ...state,
        session: {
          ...state.session,
          isComplete: true,
          endTime: Date.now()
        },
        isActive: false,
        showResults: true
      };
      console.log('New state after completing session:', newState);
      break;

    case 'SHOW_RESULTS':
      if (!state.session) return state;
      console.log('Showing results:', {
        currentState: state,
        session: state.session
      });
      newState = {
        ...state,
        showResults: true,
        isActive: false,
        session: {
          ...state.session,
          isComplete: true,
          endTime: Date.now()
        }
      };
      break;

    case 'FINISH_SESSION':
      if (!state.session) return state;
      
      // Calculate final stats
      const answeredQuestions = Object.keys(state.session.userAnswers).length;
      const correctAnswers = Object.values(state.session.userAnswers).filter(
        (answer) => answer.isCorrect
      ).length;
      const accuracy = answeredQuestions > 0 ? (correctAnswers / answeredQuestions) * 100 : 0;
      
      // Calculate total time spent
      const totalTimeSpent = Object.values(state.session.userAnswers).reduce(
        (total, answer) => total + (answer.timeSpent || 0),
        0
      );
      const averageTime = answeredQuestions > 0 ? totalTimeSpent / answeredQuestions : 0;

      newState = {
        ...state,
        session: {
          ...state.session,
          isComplete: true,
        },
        isActive: false,
        showResults: true,
        stats: {
          totalQuestions: answeredQuestions, // Only count answered questions
          answeredQuestions,
          correctAnswers,
          accuracy,
          averageTime,
        },
      };
      break;

    case 'RESET_SESSION':
      // Clear localStorage when resetting session
      if (typeof window !== 'undefined') {
        localStorage.removeItem('practiceSessionState');
      }
      
      newState = {
        ...initialState,
      };
      break;

    default:
      return state;
  }

  // Temporarily disable localStorage saving to prevent hydration issues
  // if (typeof window !== 'undefined') {
  //   localStorage.setItem('practiceSessionState', JSON.stringify(newState));
  // }

  return newState;
}

const PracticeSessionContext = createContext<{
  state: PracticeSessionState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function PracticeSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(practiceSessionReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage after hydration to prevent SSR mismatch
  useEffect(() => {
    if (typeof window !== 'undefined' && !isHydrated) {
      const savedState = localStorage.getItem('practiceSessionState');
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          // Ensure the session is still valid
          if (parsed.session && parsed.session.endTime > Date.now()) {
            // Clear the saved state to prevent conflicts
            localStorage.removeItem('practiceSessionState');
          }
        } catch (e) {
          console.error('Error parsing saved session state:', e);
        }
      }
      setIsHydrated(true);
    }
  }, [isHydrated]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (state.isActive && state.timeRemaining > 0 && state.session) {
      timer = setInterval(() => {
        const newTimeRemaining = Math.max(0, state.timeRemaining - 1);
        dispatch({ type: 'UPDATE_TIME', payload: newTimeRemaining });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [state.isActive, state.timeRemaining, state.session]);

  return (
    <PracticeSessionContext.Provider value={{ state, dispatch }}>
      {children}
    </PracticeSessionContext.Provider>
  );
}

export function usePracticeSession() {
  const context = useContext(PracticeSessionContext);
  if (!context) {
    throw new Error('usePracticeSession must be used within a PracticeSessionProvider');
  }
  return context;
}

export async function fetchQuestions(): Promise<Question[]> {
  // Use cached questions if available and fresh
  if (questionCache.length > 0 && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return questionCache;
  }

  if (!app) throw new Error('Firebase app not initialized');
  const db = getFirestore(app as FirebaseApp);
  const questionsRef = collection(db, 'questions');
  const snapshot = await getDocs(questionsRef);
  
  questionCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
  cacheTimestamp = Date.now();
  
  return questionCache;
}

export async function fetchOptimizedQuestion(excludeQuestionIds: string[] = []): Promise<Question | null> {
  console.log('fetchOptimizedQuestion called, excluding:', excludeQuestionIds);
  try {
    // Get all available questions from cache or fetch them
    const allQuestions = await fetchQuestions();
    console.log('Fetched questions count:', allQuestions.length);
    
    if (allQuestions.length === 0) {
      console.log('No questions available');
      return null;
    }

    // Filter out already used questions
    const availableQuestions = allQuestions.filter(q => !excludeQuestionIds.includes(q.id));
    console.log('Available questions after filtering:', availableQuestions.length);

    if (availableQuestions.length === 0) {
      console.log('No new questions available, reusing from all questions');
      // If no new questions, just use any question (allow repeats)
      const randomQuestion = allQuestions[Math.floor(Math.random() * allQuestions.length)];
      console.log('Selected repeat question:', randomQuestion.id);
      return randomQuestion;
    }

    if (!auth?.currentUser) {
      // Fallback to random question if no user
      console.log('No authenticated user, using random question');
      const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
      console.log('Selected random question:', randomQuestion.id);
      return randomQuestion;
    }

    console.log('Using adaptive learning for user:', auth.currentUser.uid);
    // Use adaptive learning service to get next optimized question
    const optimizedQuestions = await adaptiveLearningService.getOptimizedQuestionSelection(
      auth.currentUser.uid,
      1, // Get just one question
      availableQuestions
    );
    
    const selectedQuestion = optimizedQuestions.length > 0 ? optimizedQuestions[0] : availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    console.log('Selected optimized question:', selectedQuestion.id);
    return selectedQuestion;
  } catch (error) {
    console.error('Error fetching optimized question:', error);
    // Fallback to random question
    try {
      const allQuestions = await fetchQuestions();
      const availableQuestions = allQuestions.filter(q => !excludeQuestionIds.includes(q.id));
      const questionsToUse = availableQuestions.length > 0 ? availableQuestions : allQuestions;
      const fallbackQuestion = questionsToUse.length > 0 ? questionsToUse[Math.floor(Math.random() * questionsToUse.length)] : null;
      console.log('Using fallback question:', fallbackQuestion?.id);
      return fallbackQuestion;
    } catch (fallbackError) {
      console.error('Error in fallback question fetch:', fallbackError);
      return null;
    }
  }
}

// Keep the old function for compatibility but mark as deprecated
export async function fetchOptimizedQuestions(sessionLength: number = 10): Promise<Question[]> {
  console.warn('fetchOptimizedQuestions is deprecated. Use fetchOptimizedQuestion for single questions in time-based sessions.');
  
  if (!auth?.currentUser) {
    // Fallback to regular fetch if no user
    const allQuestions = await fetchQuestions();
    return allQuestions.slice(0, sessionLength);
  }

  try {
    // Get all available questions
    const allQuestions = await fetchQuestions();
    
    // Use adaptive learning service to get optimized selection
    const optimizedQuestions = await adaptiveLearningService.getOptimizedQuestionSelection(
      auth.currentUser.uid,
      sessionLength,
      allQuestions
    );
    
    console.log(`Fetched ${optimizedQuestions.length} optimized questions for user ${auth.currentUser.uid}`);
    return optimizedQuestions;
  } catch (error) {
    console.error('Error fetching optimized questions:', error);
    // Fallback to regular random selection
    const allQuestions = await fetchQuestions();
    return allQuestions.sort(() => 0.5 - Math.random()).slice(0, sessionLength);
  }
} 