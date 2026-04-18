"use client";

import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { PracticeSessionState, PracticeSession, Question, PracticeSessionDuration, PracticeSubject } from '../types/practice';
import { collection, addDoc, getDocs, getFirestore, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { app, auth } from '@/lib/firebaseClient';
import { getDomainForSkill } from '@/lib/adaptive-learning/skill-mapping';
import { FirebaseApp } from 'firebase/app';
import { adaptiveLearningService } from '../adaptive-learning/adaptive-service';

/**
 * @file This file defines the context for managing a user's practice session.
 * It uses a reducer to handle state transitions, providing a centralized place
 * for all session-related logic, including starting sessions, fetching questions,
 * answering questions, and tracking time. It also interacts with Firestore to
 * persist user stats and history.
 */

/**
 * Defines the shape of the actions that can be dispatched to the practice session reducer.
 * Each action corresponds to a specific event within the practice session lifecycle.
 */
type Action =
  | { type: 'START_SESSION'; payload: { duration: PracticeSessionDuration; subject: PracticeSubject; initialQuestion?: Question } }
  | { type: 'UPDATE_TIME'; payload: number }
  | { type: 'LOAD_NEXT_QUESTION'; payload: { question: Question } }
  | { type: 'ANSWER_QUESTION'; payload: { questionId: string; answer: number | string; isCorrect: boolean; timeSpent: number; domain?: string } }
  | { type: 'PAUSE_TIMER' }
  | { type: 'COMPLETE_SESSION' }
  | { type: 'SHOW_RESULTS' }
  | { type: 'FINISH_SESSION' }
  | { type: 'RESET_SESSION' }
  | { type: 'HYDRATE_STATE'; payload: PracticeSessionState }
  | { type: 'RECORD_TAB_SWITCH'; payload: { timestamp: number } };

/**
 * The initial state for a practice session, representing a session that has not yet started.
 */
const initialState: PracticeSessionState = {
  session: null,
  isActive: false,
  isPaused: false,
  timeRemaining: 0,
  showResults: false,
};

// A simple in-memory cache for questions to reduce Firestore reads during a user's session.
let questionCache: Question[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // Cache expires after 5 minutes.

// Removed legacy field-based stats updater. All scoring now handled by AdaptiveLearningService.

// Track processed attempts locally to prevent duplicate side effects in Strict Mode/dev
const processedAttemptIds = new Set<string>();

/**
 * Adds a record of the user's answer to their history array in Firestore.
 * @param session - The current practice session object.
 * @param currentAnswer - The details of the user's most recent answer.
 */
async function updateUserHistory(session: PracticeSession, currentAnswer: { questionId: string; answer: number | string; isCorrect: boolean; timeSpent: number }) {
  if (!app || !auth?.currentUser) return;
  
  const db = getFirestore(app as FirebaseApp);
  const userRef = doc(db, 'users', auth.currentUser.uid);
  
  try {
    // Create a deterministic attempt ID to make this write idempotent in React Strict Mode
    const attemptStart = (session?.questionStartTimes?.[currentAnswer.questionId] as number | undefined) || (session?.startTime as number);
    const attemptId = `${currentAnswer.questionId}-${attemptStart}`;
    const historyEntry = {
      questionId: currentAnswer.questionId,
      selected: currentAnswer.answer,
      correct: currentAnswer.isCorrect,
      timeSpent: currentAnswer.timeSpent,
      answeredAt: new Date().toISOString(),
      answeredAtTs: Date.now()
    };

    // Idempotent write: users/{uid}/history/{questionId-attemptStart}
    await setDoc(doc(collection(db, 'users', auth.currentUser.uid, 'history'), attemptId), historyEntry, { merge: false });
  } catch (error: any) {
    console.error('Error updating user history:', error);
  }
}

// Helper for safe localStorage access (handles SSR and broken environments)
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {}
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {}
  }
};

/**
 * The reducer function that manages state transitions for the practice session.
 * It takes the current state and an action, and returns the new state.
 * @param state - The current `PracticeSessionState`.
 * @param action - The `Action` to be processed.
 * @returns The new `PracticeSessionState`.
 */
function practiceSessionReducer(state: PracticeSessionState, action: Action): PracticeSessionState {
  switch (action.type) {
    case 'HYDRATE_STATE':
      return { ...action.payload };
    case 'START_SESSION':
      const now = Date.now();
      return {
        ...state,
        session: {
          duration: action.payload.duration,
          subject: action.payload.subject,
          questions: action.payload.initialQuestion ? [action.payload.initialQuestion] : [],
          currentQuestionIndex: action.payload.initialQuestion ? 0 : -1,
          startTime: now,
          endTime: now + action.payload.duration * 60 * 1000,
          isComplete: false,
          userAnswers: {},
          questionStartTimes: action.payload.initialQuestion ? { [action.payload.initialQuestion.id]: now } : {},
        },
        isActive: true,
        timeRemaining: action.payload.duration * 60,
        showResults: false,
      };

    case 'UPDATE_TIME':
      if (action.payload <= 0) {
        return {
          ...state,
          timeRemaining: 0,
          isActive: false,
          showResults: true,
          session: state.session ? { ...state.session, isComplete: true, endTime: Date.now() } : null
        };
      }
      return { ...state, timeRemaining: action.payload };

    case 'LOAD_NEXT_QUESTION':
      if (!state.session) return state;
      
      const isDuplicate = state.session.questions.some(q => q.id === action.payload.question.id);
      if (isDuplicate) return state;
      
      const nextQuestionIndex = state.session.currentQuestionIndex + 1;
      const updatedQuestions = [...state.session.questions, action.payload.question];
      
      return {
        ...state,
        isPaused: false,
        session: {
          ...state.session,
          questions: updatedQuestions,
          currentQuestionIndex: nextQuestionIndex,
          questionStartTimes: {
            ...state.session.questionStartTimes,
            [action.payload.question.id]: Date.now()
          }
        },
      };

    case 'PAUSE_TIMER':
      return { ...state, isPaused: true };

    case 'ANSWER_QUESTION':
      if (!state.session) return state;
      
      const questionStartTime = state.session.questionStartTimes?.[action.payload.questionId] || state.session.startTime;
      const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
      const attemptId = `${action.payload.questionId}-${questionStartTime}`;
      
      const currentQuestion = state.session.questions[state.session.currentQuestionIndex];
      // Legacy stats update removed

      if (auth?.currentUser && !processedAttemptIds.has(attemptId)) {
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
      
      if (!processedAttemptIds.has(attemptId)) {
        processedAttemptIds.add(attemptId);
        updateUserHistory(updatedSession, { ...action.payload, timeSpent }).catch(console.error);
      }

      return { ...state, session: updatedSession };

    case 'COMPLETE_SESSION':
    case 'SHOW_RESULTS':
    case 'FINISH_SESSION':
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, isComplete: true, endTime: Date.now() },
        isActive: false,
        showResults: true,
      };

    case 'RESET_SESSION':
      safeLocalStorage.removeItem('practiceSessionState');
      return { ...initialState };

    case 'RECORD_TAB_SWITCH':
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          tabSwitches: (state.session.tabSwitches || 0) + 1,
          tabSwitchEvents: [
            ...(state.session.tabSwitchEvents || []),
            { timestamp: action.payload.timestamp }
          ]
        }
      };

    default:
      return state;
  }
}

const PracticeSessionContext = createContext<{
  state: PracticeSessionState;
  dispatch: React.Dispatch<Action>;
  hydrationDone: boolean;
} | null>(null);

/**
 * The provider component that makes the practice session state and dispatch function
 * available to all child components through the `usePracticeSession` hook.
 */
export function PracticeSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(practiceSessionReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydrationDone, setHydrationDone] = useState(false);
  const prevQuestionIndexRef = React.useRef<number | null>(null);
  const debounceTimerRef = React.useRef<number | null>(null);

  // Effect to handle client-side hydration: restore immediately from localStorage snapshot if present
  useEffect(() => {
    if (!isHydrated) {
      try {
        const snap = safeLocalStorage.getItem('practiceSessionSnapshot');
        if (snap) {
          const parsed = JSON.parse(snap);
          const endTime = parsed?.session?.endTime || 0;
          const now = Date.now();
          const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
          const restored: PracticeSessionState = {
            session: parsed.session || null,
            isActive: !!parsed.isActive && timeRemaining > 0,
            isPaused: false,
            timeRemaining,
            showResults: !!parsed.showResults || timeRemaining <= 0,
          } as PracticeSessionState;
          dispatch({ type: 'HYDRATE_STATE', payload: restored });
        }
      } catch {}
      setIsHydrated(true);
    }
  }, [isHydrated]);

  // Track tab switching
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && state.isActive && !state.isPaused && !state.showResults) {
        dispatch({ type: 'RECORD_TAB_SWITCH', payload: { timestamp: Date.now() } });
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state.isActive, state.isPaused, state.showResults]);

  // Main timer effect for the practice session countdown.
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state.isActive && !state.isPaused && state.timeRemaining > 0) {
      timer = setInterval(() => {
        dispatch({ type: 'UPDATE_TIME', payload: state.timeRemaining - 1 });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [state.isActive, state.isPaused, state.timeRemaining]);

  // On mount (client) attempt to restore a previous session snapshot from Firestore
  useEffect(() => {
    (async () => {
      if (!isHydrated) return;
      if (!app || !auth?.currentUser) return;
      try {
        const db = getFirestore(app as FirebaseApp);
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'practice', 'session'));
        if (snap.exists()) {
          const data = snap.data() as any;
          const endTime = data?.session?.endTime || 0;
          const now = Date.now();
          const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
          const restored: PracticeSessionState = {
            session: data.session || null,
            isActive: !!data.isActive && timeRemaining > 0,
            isPaused: false,
            timeRemaining: timeRemaining,
            showResults: !!data.showResults || timeRemaining <= 0,
          } as PracticeSessionState;
          dispatch({ type: 'HYDRATE_STATE', payload: restored });
        }
        setHydrationDone(true);
      } catch (e) {
        console.warn('Failed to hydrate practice session from Firestore:', e);
        setHydrationDone(true);
      }
    })();
  }, [isHydrated]);

  // Safety: if a hydrated session is expired, proactively clear user's active-practice-session flag
  useEffect(() => {
    (async () => {
      try {
        if (!hydrationDone) return;
        if (!app || !auth?.currentUser) return;
        if (typeof state.timeRemaining !== 'number') return;
        if (state.timeRemaining > 0) return;
        const db = getFirestore(app as FirebaseApp);
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, { ['active-practice-session']: false } as any).catch(() => {});
      } catch {}
    })();
  }, [hydrationDone, state.timeRemaining]);

  // Persist snapshot to Firestore (immediate on question index change; debounced for time)
  useEffect(() => {
    if (!app || !auth?.currentUser) return;
    const writeSnapshot = async () => {
      try {
        const db = getFirestore(app as FirebaseApp);
        const ref = doc(db, 'users', auth.currentUser.uid, 'practice', 'session');
        const payload = {
          isActive: state.isActive,
          isPaused: state.isPaused,
          timeRemaining: state.timeRemaining,
          showResults: state.showResults,
          session: state.session,
          updatedAt: Date.now(),
        };
        // Save to localStorage for instant hydration on refresh
        safeLocalStorage.setItem('practiceSessionSnapshot', JSON.stringify(payload));
        await updateDoc(ref, payload as any).catch(async (err) => {
          // If doc missing, create it
          if ((err as any)?.code === 'not-found') {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(ref, payload as any);
          } else {
            throw err;
          }
        });
      } catch (e) {
        console.warn('Failed to persist practice session snapshot:', e);
      }
    };

    const currentIndex = state.session?.currentQuestionIndex ?? null;
    const prevIndex = prevQuestionIndexRef.current;
    const indexChanged = currentIndex !== prevIndex;
    prevQuestionIndexRef.current = currentIndex;

    if (indexChanged) {
      // Immediate write on question change
      writeSnapshot();
      return;
    }

    // Debounce writes for timer/other updates
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      writeSnapshot();
    }, 5000);

    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [state.isActive, state.isPaused, state.timeRemaining, state.showResults, state.session?.currentQuestionIndex]);

  return (
    <PracticeSessionContext.Provider value={{ state, dispatch, hydrationDone }}>
      {children}
    </PracticeSessionContext.Provider>
  );
}

/**
 * A custom hook to easily access the practice session state and dispatch function.
 * @throws If used outside of a `PracticeSessionProvider`.
 * @returns The practice session context, including state and dispatch.
 */
export function usePracticeSession() {
  const context = useContext(PracticeSessionContext);
  if (!context) {
    throw new Error('usePracticeSession must be used within a PracticeSessionProvider');
  }
  return context;
}

/**
 * Fetches all available questions from Firestore, using an in-memory cache to reduce reads.
 * @returns A promise that resolves to an array of all non-reported questions.
 */
export async function fetchQuestions(): Promise<Question[]> {
  if (questionCache.length > 0 && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return questionCache;
  }

  if (!app) throw new Error('Firebase app not initialized');
  const db = getFirestore(app as FirebaseApp);
  const questionsRef = collection(db, 'questions');
  const snapshot = await getDocs(questionsRef);
  
  questionCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)).filter(q => !q.reported);
  cacheTimestamp = Date.now();
  
  return questionCache;
}

/**
 * Fetches the next question for a practice session, optimized for the current user's learning profile.
 * It uses the adaptive learning service to select the most appropriate question.
 * IMPORTANT: When there are no available unique questions after exclusions, this returns null.
 * @param excludeQuestionIds - An array of question IDs to exclude from the selection to avoid repetition.
 * @returns A promise that resolves to the next question, or null if none are available.
 */
export async function fetchOptimizedQuestion(
  excludeQuestionIds: string[] = [],
  subject?: PracticeSubject
): Promise<Question | null> {
  try {
    const allQuestions = await fetchQuestions();
    if (allQuestions.length === 0) return null;

    let availableQuestions = allQuestions.filter(q => !excludeQuestionIds.includes(q.id) && !q.reported);
    if (subject) {
      availableQuestions = availableQuestions.filter((q) => {
        const d = Number(q.domain);
        if (Number.isNaN(d)) return false;
        return subject === 'Math' ? d <= 3 : d >= 4;
      });
    }
    
    if (availableQuestions.length === 0) {
      // No unique questions remain after applying exclusions
      return null;
    }

    if (!auth?.currentUser) {
      // Fallback to a random question if the user is not authenticated.
      return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    }

    const optimizedQuestions = await adaptiveLearningService.getOptimizedQuestionSelection(
      auth.currentUser.uid,
      1, // We only need one question
      availableQuestions
    );
    
    // If the service returns a question, use it; otherwise, fall back to a random selection.
    const selectedQuestion = optimizedQuestions.length > 0 ? optimizedQuestions[0] : availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    
    // Validation: Ensure selected question matches subject filter
    if (selectedQuestion && subject) {
      const questionDomain = Number(selectedQuestion.domain);
      const isMathQuestion = !Number.isNaN(questionDomain) && questionDomain <= 3;
      const isReadingWritingQuestion = !Number.isNaN(questionDomain) && questionDomain >= 4;
      
      if (subject === 'Math' && !isMathQuestion) {
        console.error(`[BUG] Math session selected non-Math question!`, {
          questionId: selectedQuestion.id,
          questionSkill: selectedQuestion.skill,
          questionDomain: selectedQuestion.domain,
          subject,
        });
      } else if (subject === 'Reading & Writing' && !isReadingWritingQuestion) {
        console.error(`[BUG] Reading & Writing session selected non-RW question!`, {
          questionId: selectedQuestion.id,
          questionSkill: selectedQuestion.skill,
          questionDomain: selectedQuestion.domain,
          subject,
        });
      }
    }
    
    return selectedQuestion;
  } catch (error) {
    console.error('Error fetching optimized question:', error);
    // Fallback to a truly random question in case of any error during the optimization process.
    // IMPORTANT: Still apply subject filter even in fallback!
    try {
      const allQuestions = await fetchQuestions();
      let available = allQuestions.filter(q => !excludeQuestionIds.includes(q.id) && !q.reported);
      
      // Apply subject filter in fallback too
      if (subject) {
        available = available.filter((q) => {
          const d = Number(q.domain);
          if (Number.isNaN(d)) return false;
          return subject === 'Math' ? d <= 3 : d >= 4;
        });
      }
      
      const questionsToUse = available.length > 0 ? available : allQuestions;
      const fallbackQuestion = questionsToUse.length > 0 ? questionsToUse[Math.floor(Math.random() * questionsToUse.length)] : null;
      
      // Validation: Ensure fallback question matches subject filter
      if (fallbackQuestion && subject) {
        const questionDomain = Number(fallbackQuestion.domain);
        const isMathQuestion = !Number.isNaN(questionDomain) && questionDomain <= 3;
        const isReadingWritingQuestion = !Number.isNaN(questionDomain) && questionDomain >= 4;
        
        if (subject === 'Math' && !isMathQuestion) {
          console.error(`[BUG] Math session fallback selected non-Math question!`, {
            questionId: fallbackQuestion.id,
            questionSkill: fallbackQuestion.skill,
            questionDomain: fallbackQuestion.domain,
            subject,
          });
        } else if (subject === 'Reading & Writing' && !isReadingWritingQuestion) {
          console.error(`[BUG] Reading & Writing session fallback selected non-RW question!`, {
            questionId: fallbackQuestion.id,
            questionSkill: fallbackQuestion.skill,
            questionDomain: fallbackQuestion.domain,
            subject,
          });
        }
      }
      
      return fallbackQuestion;
    } catch (fallbackError) {
      console.error('Error in fallback question fetch:', fallbackError);
      return null;
    }
  }
}
