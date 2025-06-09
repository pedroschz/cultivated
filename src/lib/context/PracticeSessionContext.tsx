import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { PracticeSessionState, PracticeSession, Question, PracticeSessionDuration } from '../types/practice';
import { collection, getDocs, getFirestore, doc, updateDoc, arrayUnion, increment, getDoc, serverTimestamp } from 'firebase/firestore';
import { app, auth } from '../firebaseClient';
import { FirebaseApp } from 'firebase/app';

type Action =
  | { type: 'START_SESSION'; payload: { duration: PracticeSessionDuration; questions: Question[] } }
  | { type: 'UPDATE_TIME'; payload: number }
  | { type: 'ANSWER_QUESTION'; payload: { questionId: string; answer: number; isCorrect: boolean; timeSpent: number; domain?: string } }
  | { type: 'NEXT_QUESTION' }
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

    // Determine which field and category the domain belongs to
    const domainNum = parseInt(domain || '0');
    let field: string;
    let category: 'math' | 'readingAndWriting';

    if (domainNum <= 7) {
      field = 'field0';
      category = 'math';
    } else if (domainNum <= 17) {
      field = 'field1';
      category = 'math';
    } else if (domainNum <= 30) {
      field = 'field2';
      category = 'math';
    } else if (domainNum <= 36) {
      field = 'field3';
      category = 'math';
    } else if (domainNum <= 39) {
      field = 'field4';
      category = 'readingAndWriting';
    } else if (domainNum <= 42) {
      field = 'field5';
      category = 'readingAndWriting';
    } else if (domainNum <= 44) {
      field = 'field6';
      category = 'readingAndWriting';
    } else {
      field = 'field7';
      category = 'readingAndWriting';
    }

    // Get current domain stats
    const domainStats = currentStats[category][field][domain || ''] || {
      totalAnswered: 0,
      correctAnswers: 0,
      accuracy: 0,
      averageTime: 0,
    };

    // Calculate new stats
    const newTotalAnswered = domainStats.totalAnswered + 1;
    const newCorrectAnswers = domainStats.correctAnswers + (isCorrect ? 1 : 0);
    const newAccuracy = (newCorrectAnswers / newTotalAnswered) * 100;
    const newAverageTime = ((domainStats.averageTime * domainStats.totalAnswered) + timeSpent) / newTotalAnswered;

    // Update stats for this domain
    const updates = {
      [`stats.${category}.${field}.${domain}`]: {
        totalAnswered: newTotalAnswered,
        correctAnswers: newCorrectAnswers,
        accuracy: newAccuracy,
        averageTime: newAverageTime,
      },
    };

    await updateDoc(userRef, updates);
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
}

async function updateUserHistory(session: PracticeSession, currentAnswer: { questionId: string; answer: number; isCorrect: boolean; timeSpent: number }) {
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
      const firstQuestionId = action.payload.questions[0]?.id;
      newState = {
        ...state,
        session: {
          duration: action.payload.duration,
          questions: action.payload.questions,
          currentQuestionIndex: 0,
          startTime: now,
          endTime: now + action.payload.duration * 60 * 1000,
          isComplete: false,
          userAnswers: {},
          questionStartTimes: firstQuestionId ? { [firstQuestionId]: now } : {},
        },
        isActive: true,
        timeRemaining: action.payload.duration * 60,
        showResults: false,
      };
      break;

    case 'UPDATE_TIME':
      newState = {
        ...state,
        timeRemaining: action.payload,
      };
      break;

    case 'ANSWER_QUESTION':
      if (!state.session) return state;
      
      const questionStartTime = state.session.questionStartTimes?.[action.payload.questionId] || state.session.startTime;
      const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
      
      const currentQuestion = state.session.questions[state.session.currentQuestionIndex];
      const domain = currentQuestion.domain?.toString();
      
      updateUserStats(
        action.payload.questionId,
        action.payload.isCorrect,
        timeSpent,
        domain
      ).catch(console.error);

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

    case 'NEXT_QUESTION':
      if (!state.session) return state;
      const currentTime = Date.now();
      const nextQuestionIndex = state.session.currentQuestionIndex + 1;
      const nextQuestion = state.session.questions[nextQuestionIndex];
      
      if (nextQuestion) {
        newState = {
          ...state,
          session: {
            ...state.session,
            currentQuestionIndex: nextQuestionIndex,
            questionStartTimes: {
              ...(state.session.questionStartTimes || {}),
              [nextQuestion.id]: currentTime
            }
          },
        };
      } else {
        newState = {
          ...state,
          session: {
            ...state.session,
            currentQuestionIndex: nextQuestionIndex
          },
        };
      }
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
      const totalQuestions = state.session.questions.length;
      const answeredQuestions = Object.keys(state.session.userAnswers).length;
      const correctAnswers = Object.values(state.session.userAnswers).filter(
        (answer) => answer.isCorrect
      ).length;
      const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
      
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
          totalQuestions,
          answeredQuestions,
          correctAnswers,
          accuracy,
          averageTime,
        },
      };
      break;

    case 'RESET_SESSION':
      newState = {
        ...initialState,
      };
      break;

    default:
      return state;
  }

  // Save state to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('practiceSessionState', JSON.stringify(newState));
  }

  return newState;
}

const PracticeSessionContext = createContext<{
  state: PracticeSessionState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function PracticeSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(practiceSessionReducer, loadInitialState());

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (state.isActive && state.timeRemaining > 0) {
      timer = setInterval(() => {
        const newTimeRemaining = Math.max(0, state.timeRemaining - 1);
        dispatch({ type: 'UPDATE_TIME', payload: newTimeRemaining });

        if (newTimeRemaining === 0) {
          dispatch({ type: 'COMPLETE_SESSION' });
        }
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [state.isActive, state.timeRemaining]);

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
  if (!app) throw new Error('Firebase app not initialized');
  const db = getFirestore(app as FirebaseApp);
  const questionsRef = collection(db, 'questions');
  const snapshot = await getDocs(questionsRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
} 