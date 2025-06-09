"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, storage, app } from '../../lib/firebaseClient';
import { ref, getDownloadURL } from 'firebase/storage';
import { usePracticeSession, PracticeSessionProvider, fetchQuestions } from '@/lib/context/PracticeSessionContext';
import { Question, PracticeSessionDuration, PracticeSession, PracticeSessionState, UserAnswer } from '@/lib/types/practice';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

type PracticeSessionContextType = {
  state: PracticeSessionState;
  dispatch: React.Dispatch<any>;
};

const DOMAIN_NAMES: { [key: string]: string } = {
  // Math domains
  '0': 'Algebra',
  '1': 'Problem Solving and Data Analysis',
  '2': 'Advanced Math',
  '3': 'Geometry and Trigonometry',
  // Reading & Writing domains
  '4': 'Information and Ideas',
  '5': 'Craft and Structure',
  '6': 'Expression of Ideas',
  '7': 'Standard English Conventions'
};

const SUBDOMAIN_NAMES: { [key: string]: string } = {
  // Algebra
  '0': 'Solving linear equations and inequalities',
  '1': 'Linear equation word problems',
  '2': 'Linear relationship word problems',
  '3': 'Graphs of linear equations and functions',
  '4': 'Solving systems of linear equations',
  '5': 'Systems of linear equations word problems',
  '6': 'Linear inequality word problems',
  '7': 'Graphs of linear systems and inequalities',
  // Problem Solving and Data Analysis
  '8': 'Ratios, rates, and proportions',
  '9': 'Unit conversion',
  '10': 'Percentages',
  '11': 'Center, spread, and shape of distributions',
  '12': 'Data representations',
  '13': 'Scatterplots',
  '14': 'Linear and exponential growth',
  '15': 'Probability and relative frequency',
  '16': 'Data inferences',
  '17': 'Evaluating statistical claims',
  // Advanced Math
  '18': 'Factoring quadratic and polynomial expressions',
  '19': 'Radicals and rational exponents',
  '20': 'Operations with polynomials',
  '21': 'Operations with rational expressions',
  '22': 'Nonlinear functions',
  '23': 'Isolating quantities',
  '24': 'Solving quadratic equations',
  '25': 'Linear and quadratic systems',
  '26': 'Radical, rational, and absolute value equations',
  '27': 'Quadratic and exponential word problems',
  '28': 'Quadratic graphs',
  '29': 'Exponential graphs',
  '30': 'Polynomial and other nonlinear graphs',
  // Geometry and Trigonometry
  '31': 'Area and volume',
  '32': 'Congruence, similarity, and angle relationships',
  '33': 'Right triangle trigonometry',
  '34': 'Circle theorems',
  '35': 'Unit circle trigonometry',
  '36': 'Circle equations',
  // Information and Ideas
  '37': 'Command of Evidence',
  '38': 'Central Ideas and Details',
  '39': 'Inferences',
  // Craft and Structure
  '40': 'Words in Context',
  '41': 'Text Structure and Purpose',
  '42': 'Cross-Text Connections',
  // Expression of Ideas
  '43': 'Transitions: Foundation',
  '44': 'Rhetorical Synthesis: Foundations',
  // Standard English Conventions
  '45': 'Form, Structure, and Sense',
  '46': 'Boundaries'
};

interface UserStats {
  totalTimeSpent: number;
  totalQuestionsAnswered: {
    math: number;
    readingAndWriting: number;
  };
  strengths: {
    domain: string;
    subdomain: string;
    accuracy: number;
  }[];
  weaknesses: {
    domain: string;
    subdomain: string;
    accuracy: number;
  }[];
  averageAccuracy: number;
}

function DashboardContent() {
  const [userName, setUserName] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const router = useRouter();
  const [showPracticeOptions, setShowPracticeOptions] = useState(false);
  const { state, dispatch } = usePracticeSession() as PracticeSessionContextType;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('Component rendered with userStats:', userStats);
  }, [userStats]);

  useEffect(() => {
    async function loadQuestions() {
      try {
        const fetchedQuestions = await fetchQuestions();
        setQuestions(fetchedQuestions);
      } catch (error) {
        console.error('Error loading questions:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuestions();
  }, []);

  useEffect(() => {
    if (!auth) {
      console.log("Firebase auth is not initialized. Displaying default user name.");
      setUserName("Valued User");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setUserName(user.displayName || "Valued User");
      } else {
        console.log("No user signed in. Redirect should be handled by middleware. Displaying default user name.");
        setUserName("Valued User");
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    async function fetchUserStats() {
      if (!auth?.currentUser || !app) {
        console.log('Auth or Firebase app not initialized');
        return;
      }
      
      console.log('Fetching stats for user:', auth.currentUser.uid);
      const db = getFirestore(app);
      const userRef = doc(db, 'users', auth.currentUser.uid);
      
      try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          console.log('User document does not exist');
          return;
        }
        
        const userData = userDoc.data();
        console.log('User data:', userData);
        const stats = userData.stats || {};
        console.log('Stats:', stats);
        
        // Calculate total time spent
        const totalTimeSpent = Object.values(stats.math || {}).reduce((total: number, field: any) => {
          return total + Object.values(field).reduce((fieldTotal: number, domain: any) => {
            return fieldTotal + (domain.averageTime * domain.totalAnswered || 0);
          }, 0);
        }, 0) + Object.values(stats.readingAndWriting || {}).reduce((total: number, field: any) => {
          return total + Object.values(field).reduce((fieldTotal: number, domain: any) => {
            return fieldTotal + (domain.averageTime * domain.totalAnswered || 0);
          }, 0);
        }, 0);

        console.log('Total time spent:', totalTimeSpent);

        // Calculate questions answered by category
        const totalQuestionsAnswered = {
          math: Object.values(stats.math || {}).reduce((total: number, field: any) => {
            return total + Object.values(field).reduce((fieldTotal: number, domain: any) => {
              return fieldTotal + (domain.totalAnswered || 0);
            }, 0);
          }, 0),
          readingAndWriting: Object.values(stats.readingAndWriting || {}).reduce((total: number, field: any) => {
            return total + Object.values(field).reduce((fieldTotal: number, domain: any) => {
              return fieldTotal + (domain.totalAnswered || 0);
            }, 0);
          }, 0)
        };

        console.log('Total questions answered:', totalQuestionsAnswered);

        // Calculate domain accuracies
        const domainAccuracies: { domain: string; subdomain: string; accuracy: number }[] = [];
        
        // Math domains
        Object.entries(stats.math || {}).forEach(([field, domains]: [string, any]) => {
          Object.entries(domains).forEach(([domain, data]: [string, any]) => {
            if (data.totalAnswered > 0) {
              const domainNum = parseInt(domain);
              const mainDomain = Math.floor(domainNum / 8);
              domainAccuracies.push({
                domain: DOMAIN_NAMES[mainDomain.toString()] || `Math - Domain ${mainDomain}`,
                subdomain: SUBDOMAIN_NAMES[domain] || `Subdomain ${domain}`,
                accuracy: data.accuracy || 0
              });
            }
          });
        });

        // Reading & Writing domains
        Object.entries(stats.readingAndWriting || {}).forEach(([field, domains]: [string, any]) => {
          Object.entries(domains).forEach(([domain, data]: [string, any]) => {
            if (data.totalAnswered > 0) {
              const domainNum = parseInt(domain);
              const mainDomain = Math.floor((domainNum - 37) / 3) + 4;
              domainAccuracies.push({
                domain: DOMAIN_NAMES[mainDomain.toString()] || `Reading & Writing - Domain ${mainDomain}`,
                subdomain: SUBDOMAIN_NAMES[domain] || `Subdomain ${domain}`,
                accuracy: data.accuracy || 0
              });
            }
          });
        });

        console.log('Domain accuracies:', domainAccuracies);

        // Sort domains by accuracy
        domainAccuracies.sort((a, b) => b.accuracy - a.accuracy);
        
        // Calculate average accuracy
        const averageAccuracy = domainAccuracies.length > 0
          ? domainAccuracies.reduce((sum, domain) => sum + domain.accuracy, 0) / domainAccuracies.length
          : 0;

        console.log('Average accuracy:', averageAccuracy);

        const newStats = {
          totalTimeSpent,
          totalQuestionsAnswered,
          strengths: domainAccuracies.slice(0, 3),
          weaknesses: domainAccuracies.slice(-3).reverse(),
          averageAccuracy
        };

        console.log('Setting new stats:', newStats);
        setUserStats(newStats);
      } catch (error) {
        console.error('Error fetching user stats:', error);
      }
    }

    fetchUserStats();
  }, []);

  const handleLogout = async () => {
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    if (auth) {
      try {
        await auth.signOut();
        console.log("User signed out from Firebase");
      } catch (error) {
        console.error("Error signing out from Firebase: ", error);
      }
    }
    router.push('/login');
  };

  const startPracticeSession = (duration: PracticeSessionDuration) => {
    if (!questions.length) {
      alert('No questions available. Please check your database.');
      return;
    }
    const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffledQuestions.slice(0, duration === 15 ? 5 : 10);
    
    console.log('Starting session with duration:', duration);
    dispatch({
      type: 'START_SESSION',
      payload: {
        duration,
        questions: selectedQuestions,
      },
    });
    
    // Navigate to practice page
    router.push('/practice');
  };

  // If there's an active session, show the practice interface
  if (state.session) {
    const session = state.session;
    const currentQuestion = session.questions[session.currentQuestionIndex];
    const userAnswer = session.userAnswers[currentQuestion.id];

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
                Question {session.currentQuestionIndex + 1} of {session.questions.length}
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
                      const timeSpent = session.duration * 60 - state.timeRemaining;
                      dispatch({
                        type: 'ANSWER_QUESTION',
                        payload: {
                          questionId: currentQuestion.id,
                          answer: index,
                          isCorrect,
                          timeSpent,
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
                {session.currentQuestionIndex < session.questions.length - 1 ? (
                  <button
                    onClick={() => dispatch({ type: 'NEXT_QUESTION' })}
                    className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    onClick={() => dispatch({ type: 'SHOW_RESULTS' })}
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

  // Show results if session is complete
  if (state.showResults && state.session) {
    const session = state.session as PracticeSession;
    const correctAnswers = (Object.values(session.userAnswers) as UserAnswer[]).filter(
      (answer) => answer.isCorrect
    ).length;
    const totalQuestions = session.questions.length;
    const percentage = (correctAnswers / totalQuestions) * 100;

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
            onClick={() => dispatch({ type: 'COMPLETE_SESSION' })}
            className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show dashboard if no active session
  return (
    <div style={{ position: "relative", minHeight: "100vh", padding: "20px" }}>
      <button 
        onClick={handleLogout}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          padding: "10px 15px",
          backgroundColor: "red",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }}
      >
        Logout
      </button>

      <div style={{ maxWidth: "800px", margin: "50px auto", padding: "20px", textAlign: "left" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "20px" }}>
          {userName ? `Hi, ${userName}!` : 'Loading user...'}
        </h1>
        <p style={{ marginBottom: "30px" }}>This is ✨the dashboard✨. More features coming soon!</p>

        <div style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "20px" }}>Start a Practice Session</h2>
          <div style={{ display: "flex", gap: "20px" }}>
            <button
              onClick={() => startPracticeSession(15)}
              style={{
                padding: "15px 30px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "1.1rem"
              }}
            >
              15 Minutes
            </button>
            <button
              onClick={() => startPracticeSession(30)}
              style={{
                padding: "15px 30px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "1.1rem"
              }}
            >
              30 Minutes
            </button>
          </div>
        </div>

        {userStats && (
          <div style={{ marginBottom: "40px", backgroundColor: "#f8f9fa", padding: "20px", borderRadius: "8px" }}>
            <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>My Stats</h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "30px" }}>
              <div style={{ backgroundColor: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "10px", color: "#666" }}>Total Time Spent</h3>
                <p style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
                  {Math.floor(userStats.totalTimeSpent / 60)} minutes
                </p>
              </div>
              
              <div style={{ backgroundColor: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "10px", color: "#666" }}>Average Accuracy</h3>
                <p style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
                  {userStats.averageAccuracy.toFixed(1)}%
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "30px" }}>
              <div style={{ backgroundColor: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "10px", color: "#666" }}>Questions Answered</h3>
                <p style={{ fontSize: "1.1rem", marginBottom: "5px" }}>
                  Math: {userStats.totalQuestionsAnswered.math}
                </p>
                <p style={{ fontSize: "1.1rem" }}>
                  Reading & Writing: {userStats.totalQuestionsAnswered.readingAndWriting}
                </p>
              </div>
              
              <div style={{ backgroundColor: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "10px", color: "#666" }}>Biggest Strength</h3>
                {userStats.strengths[0] && (
                  <p style={{ fontSize: "1.1rem" }}>
                    {userStats.strengths[0].domain} - {userStats.strengths[0].subdomain} ({userStats.strengths[0].accuracy.toFixed(1)}%)
                  </p>
                )}
              </div>
            </div>

            <div style={{ backgroundColor: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "10px", color: "#666" }}>Areas for Improvement</h3>
              {userStats.weaknesses.map((weakness, index) => (
                <p key={index} style={{ fontSize: "1.1rem", marginBottom: "5px" }}>
                  {weakness.domain} - {weakness.subdomain} ({weakness.accuracy.toFixed(1)}%)
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PracticeSessionProvider>
      <DashboardContent />
    </PracticeSessionProvider>
  );
}