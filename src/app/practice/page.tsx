/**
 * @file This file contains the main component for the user's practice session experience.
 * It manages the entire lifecycle of a practice session, from fetching questions
 * to submitting answers, tracking progress, and displaying results. It integrates
 * with Firebase for data persistence and includes features like an AI tutor with
 * voice input and various onboarding elements.
 */
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { usePracticeSession, fetchOptimizedQuestion } from '@/lib/context/PracticeSessionContext';
import { useUser } from '@/lib/context/UserContext';
import { useRouter } from 'next/navigation';
import { auth, app } from '@/lib/firebaseClient';
import { getFirestore, doc, updateDoc, arrayUnion, arrayRemove, getDoc, collection, getDocs, query, where, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { 
  MainLayout, 
  PageHeader,
  ScoreCard,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Loading,
  Progress,
  CardFooter
} from '@/components';
import { 
  BookmarkIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ArrowRightIcon,
  HomeIcon,
  FlagIcon,
  BookOpenIcon,
  ImageIcon,
  TargetIcon,
  Trophy,
  XIcon,
  Clock,
  Calculator as CalculatorIcon,
  Loader2,
  Bot,
  Timer,
  TimerOff,
  Strikethrough,
  CircleSlash,
  Check,
  Type,
} from 'lucide-react';
import { ProcedureQR, ProcedureScore } from '@/components';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ReportBugDialog, submitBugReport } from '@/components/ReportBugDialog';
import { QuestionImage, OptionImage } from '@/components/ui/question-image';
import { getQuestionImage, getQuestionGraph, getOptionImageURL, sanitizeText } from '@/lib/utils/questionHelpers';
import Graph from '@/components/ui/graph';
import { checkOpenEndedAnswer } from '@/lib/utils/answer-checking';
  import type { Question } from '@/lib/types/practice';
import { AdaptiveLearningEngine } from '@/lib/adaptive-learning/scoring-engine';
import { adaptiveLearningService } from '@/lib/adaptive-learning/adaptive-service';
import { ScoreUpdate } from '@/lib/types/adaptive-learning';
import confetti from 'canvas-confetti';
import { getSkillMapping, DOMAIN_RANGES, getSubdomainId } from '@/lib/adaptive-learning/skill-mapping';
import { onAuthStateChanged } from 'firebase/auth';
import { LatexRenderer } from '@/components/ui/latex';
import { TextAnnotator } from '@/components/ui/text-annotator';
import { motion } from "framer-motion";
import { TutorSidebar } from '@/components/practice/TutorSidebar';
import { CalculatorSidebar, CalculatorSidebarRef } from '@/components/practice/CalculatorSidebar';
import { SessionSummary } from '@/components/practice/SessionSummary';



/**
 * Updates the user's adaptive learning statistics in Firestore.
 * This includes subdomain scores, domain summaries, and overall competency.
 * @param newScores - The new scores to be saved to the database.
 */
async function updateUserStats(
  newScores: { subdomainScores: any; domainSummaries: any; overallCompetency: number }
) {
  if (!auth || !auth.currentUser) {
    console.error('No authenticated user found for stats update');
    throw new Error('Authentication required');
  }
  
  if (!app) {
    console.error('Firebase app not initialized');
    throw new Error('Firebase not initialized');
  }
  
  try {
    const db = getFirestore(app!);
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      'adaptiveLearning.subdomainScores': newScores.subdomainScores,
      'adaptiveLearning.domainSummaries': newScores.domainSummaries,
      'adaptiveLearning.overallCompetency': newScores.overallCompetency,
      'adaptiveLearning.lastQuestionUpdate': new Date().getTime(),
    });
    console.log('User stats updated successfully in Firestore.');
  } catch (error) {
    console.error("Failed to update user stats in Firestore:", error);
    throw error;
  }
}

/**
 * The main component for handling a practice session.
 * It orchestrates the UI and logic for question display, answer submission,
 * scoring, and session management.
 */
function PracticeSession() {
  const { state, dispatch, hydrationDone } = usePracticeSession();
  const { userData } = useUser();
  const router = useRouter();
  
  // Prefetch dashboard (common destination after practice session)
  useEffect(() => {
    router.prefetch('/dashboard');
  }, [router]);
  
  // Component state for UI and logic management
  const [isLoading, setIsLoading] = useState(false);
  const [cheerLines, setCheerLines] = useState<string[]>([]); // Store user-specific cheers
  const [currentCheer, setCurrentCheer] = useState<string | null>(null);

  // Text size preference
  const [textSize, setTextSize] = useState<number>(2);
  const [showTextSizeSlider, setShowTextSizeSlider] = useState(false);

  useEffect(() => {
    if (userData?.practiceTextSize) {
      setTextSize(userData.practiceTextSize);
    }
  }, [userData?.practiceTextSize]);

  const handleTextSizeChange = async (newSize: number) => {
    setTextSize(newSize);
    if (auth?.currentUser && app) {
      try {
        const db = getFirestore(app);
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, { practiceTextSize: newSize });
      } catch (e) {
        console.error('Failed to save text size preference:', e);
      }
    }
  };


  // Load cheers
  useEffect(() => {
    if (!auth || !app) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && app) {
        try {
          const db = getFirestore(app);
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (Array.isArray(data.cheerLines) && data.cheerLines.length > 0) {
              setCheerLines(data.cheerLines);
            }
          }
        } catch {}
      }
    });
    return () => unsub();
  }, []);

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [scoreUpdate, setScoreUpdate] = useState<ScoreUpdate | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [loadingNextQuestion, setLoadingNextQuestion] = useState(false);
  const [hasLoadedFirstQuestion, setHasLoadedFirstQuestion] = useState(false);
  const [showTutorChat, setShowTutorChat] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [userCulture, setUserCulture] = useState<string | null>(null);
  const [tutorName, setTutorName] = useState<string>('AI Tutor');
  const [tutorVoice, setTutorVoice] = useState<string>('Kore');
  // AI Tutor is always enabled
  const aiTutorEnabled = true;
  const [hasSeenFirstWrongAnswerTutorial, setHasSeenFirstWrongAnswerTutorial] = useState(false);
  const [hasStartedPractice, setHasStartedPractice] = useState(false);
  const [hasCompletedFirstSession, setHasCompletedFirstSession] = useState(false);
  // Removed isTutorReady flow; open via explicit button
  const [isClient, setIsClient] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExplanationPanel, setShowExplanationPanel] = useState(true);
  const [isTutorOpen, setIsTutorOpen] = useState(true);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(true);
  const [isCanvasMinimized, setIsCanvasMinimized] = useState(false);
  const [prefetchedQuestion, setPrefetchedQuestion] = useState<Question | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<string[]>([]);
  const [procedureScore, setProcedureScore] = useState<number | null>(null);
  // Whether the user has an active /procedure tab open (presence heartbeat)
  const [procedurePresence, setProcedurePresence] = useState<{ connected: boolean; updatedAt: number } | null>(null);
  const [isProcedureOpen, setIsProcedureOpen] = useState<boolean>(false);
  // Track whether the session flag has been claimed (for internal gating)
  const [claimedPractice, setClaimedPractice] = useState<boolean>(false);
  // Signal to restart the Gemini live tutor session on key events
  const [tutorResetKey, setTutorResetKey] = useState<string>('init');
  const [authReady, setAuthReady] = useState(false);
  // First-session, first-question Tutor reminder tip
  const [showFirstTutorTip, setShowFirstTutorTip] = useState(false);
  const hasShownFirstTutorTipThisSessionRef = useRef(false);
  // First wrong answer tip (reuses hasSeenFirstWrongAnswerTutorial flag)
  const [showWrongAnswerTutorTip, setShowWrongAnswerTutorTip] = useState(false);
  const hasShownWrongTipThisSessionRef = useRef(false);
  // One-time calculator tip/arrow visibility
  const [showCalculatorTip, setShowCalculatorTip] = useState(false);
  const [hasSeenCalculatorTip, setHasSeenCalculatorTip] = useState(false);
  const hasShownCalculatorTipThisSessionRef = useRef(false);
  const lastTipQuestionIdRef = useRef<string | null>(null);
  const calculatorSidebarRef = useRef<CalculatorSidebarRef>(null);
  
  const handleGraphEquation = (latex: string) => {
    if (!calculatorSidebarRef.current) return;
    calculatorSidebarRef.current.addExpression(latex);
  };

  // Transient skill delta animation state
  const [skillDelta, setSkillDelta] = useState<{ value: number; color: 'green' | 'red' } | null>(null);
  const [skillDeltaAnim, setSkillDeltaAnim] = useState<'start' | 'end' | null>(null);
  const deltaClearTimeoutRef = useRef<number | null>(null);
  const deltaOutTimeoutRef = useRef<number | null>(null);
  // Aggregate mastery delta per skill for this session (local-only)
  const [sessionSkillDeltas, setSessionSkillDeltas] = useState<Record<string, number>>({});
  // UI toggles
  const [showTimers, setShowTimers] = useState<boolean>(true);
  const [crossOutMode, setCrossOutMode] = useState<boolean>(false);
  const [crossedOutOptions, setCrossedOutOptions] = useState<Set<number>>(new Set());

  const toggleCrossOutForIndex = (index: number) => {
    setCrossedOutOptions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Highlights captured from question and passage annotators
  const [questionHighlights, setQuestionHighlights] = useState<string[]>([]);
  const [passageHighlights, setPassageHighlights] = useState<string[]>([]);
  const highlightsCsv = React.useMemo(() => {
    return [...new Set([...(questionHighlights || []), ...(passageHighlights || [])])]
      .filter(Boolean)
      .join(', ');
  }, [questionHighlights, passageHighlights]);
  // One-time R&W annotator tip visibility
  const [showRWAnnotatorTip, setShowRWAnnotatorTip] = useState(false);
  const [hasSeenRWAnnotatorTip, setHasSeenRWAnnotatorTip] = useState(false);
  const hasShownRWTipThisSessionRef = useRef(false);
  const lastRWTipQuestionIdRef = useRef<string | null>(null);
  // Guard to avoid duplicate claim attempts (e.g., React Strict Mode double effects)

  // Guards to ensure the initial question is only loaded once per session startTime
  const initialLoadInFlightRef = useRef(false);
  const initialLoadSessionStartRef = useRef<number | null>(null);

  // Release active-practice-session reliably on tab close or when page is hidden
  useEffect(() => {
    let isMounted = true;
    const tokenRef: { current: string } = { current: '' };

    async function refreshIdToken() {
      try {
        if (auth?.currentUser) {
          const t = await auth.currentUser.getIdToken(false);
          if (isMounted) tokenRef.current = t;
        }
      } catch {}
    }

    // Prime and refresh token periodically while session is present
    refreshIdToken();
    const tokenInterval = window.setInterval(refreshIdToken, 4 * 60 * 1000);

    async function releaseViaBeacon() {
      try {
        if (!auth?.currentUser) return;
        if (!state.session) return;
        const t = tokenRef.current;
        if (!t) return;
        const url = `/releasePracticeSession?idToken=${encodeURIComponent(t)}`;
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url);
          return;
        }
        try {
          await fetch('/releasePracticeSession', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: t }),
            keepalive: true,
          });
        } catch {}
      } catch {}
    }

    function onPageHide() {
      releaseViaBeacon();
    }

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);

    return () => {
      isMounted = false;
      window.clearInterval(tokenInterval);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
    };
  }, [state.session?.startTime]);

  // Disable cross-out mode for non-multiple choice questions is handled after currentQuestion is defined

  // Desmos Graphing Calculator state/refs
  const [showCalculator, setShowCalculator] = useState(false);
  const desmosContainerRef = useRef<HTMLDivElement | null>(null);
  const desmosInstanceRef = useRef<any>(null);
  const calculatorPanelRef = useRef<HTMLDivElement | null>(null);
  const calculatorToggleWrapperRef = useRef<HTMLDivElement | null>(null);
  const [calculatorWidth, setCalculatorWidth] = useState<number>(350); // 30% less wide than previous default (468 * 0.7)
  const [calculatorHeight, setCalculatorHeight] = useState<number>(600); // 80% taller than previous default (390 * 1.8)
  const resizingTopRef = useRef<boolean>(false);
  const resizingRightRef = useRef<boolean>(false);
  const resizingCornerRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  // Ensure Desmos API is loaded only when needed
  const ensureDesmosLoaded = async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.Desmos) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_DESMOS_API_KEY;
      if (!apiKey) {
        console.error('NEXT_PUBLIC_DESMOS_API_KEY is not set');
        reject(new Error('Missing Desmos API key'));
        return;
      }
      script.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Desmos API'));
      document.head.appendChild(script);
    });
  };

  // Utility to determine if current question is Math
  const isMathQuestion = !!(state.session && state.session.currentQuestionIndex >= 0) && (() => {
    const q = state.session?.questions[state.session.currentQuestionIndex];
    if (!q) return false;
    const domain = Number((q as any).domain);
    return !Number.isNaN(domain) && domain <= 3;
  })();

  // Whether the compact AI tutor is visible (to avoid overlapping with calculator)
  // Moved below where userAnswer is defined

  // Initialize/destroy Desmos calculator when panel toggles or question changes
  useEffect(() => {
    let destroyed = false;
    (async () => {
      if (showCalculator && isMathQuestion) {
        try {
          await ensureDesmosLoaded();
          if (!desmosContainerRef.current) return;
          const w = window as any;
          // Destroy any previous instance tied to another question
          if (desmosInstanceRef.current && desmosInstanceRef.current.destroy) {
            desmosInstanceRef.current.destroy();
            desmosInstanceRef.current = null;
          }
          desmosInstanceRef.current = w.Desmos.GraphingCalculator(desmosContainerRef.current, {
            expressions: true,
            keypad: true,
            settingsMenu: true,
            zoomButtons: true,
            border: true,
          });
        } catch (e) {
          console.error('Failed to initialize Desmos:', e);
        }
      } else {
        if (desmosInstanceRef.current && desmosInstanceRef.current.destroy) {
          desmosInstanceRef.current.destroy();
          desmosInstanceRef.current = null;
        }
      }
    })();
    return () => {
      if (destroyed) return;
      destroyed = true;
      if (desmosInstanceRef.current && desmosInstanceRef.current.destroy) {
        desmosInstanceRef.current.destroy();
        desmosInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCalculator]);

  // Resize Desmos when the container size changes
  useEffect(() => {
    if (desmosInstanceRef.current && showCalculator) {
      try {
        desmosInstanceRef.current.resize();
      } catch (e) {
        // ignore
      }
    }
  }, [calculatorWidth, calculatorHeight, showCalculator]);

  // Mobile-only: close calculator when clicking outside panel and toggle button
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;
    if (!showCalculator) return;

    const handlePointerDown = (ev: MouseEvent | TouchEvent) => {
      const panel = calculatorPanelRef.current;
      const toggleWrap = calculatorToggleWrapperRef.current;
      const target = ev.target as Node | null;
      if (!panel || !toggleWrap || !target) return;
      const clickedInsidePanel = panel.contains(target);
      const clickedToggle = toggleWrap.contains(target);
      if (!clickedInsidePanel && !clickedToggle) {
        setShowCalculator(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('touchstart', handlePointerDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('touchstart', handlePointerDown, true);
    };
  }, [showCalculator]);

  // Listen to /procedure presence and keep a fresh indicator (15s TTL to match heartbeat)
  useEffect(() => {
    if (!app || !auth?.currentUser) return;
    const db = getFirestore(app!);
    const ref = doc(db, 'users', auth.currentUser.uid, 'presence', 'procedure');
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any;
      const connected = !!data?.connected;
      const updatedAt = Number(data?.updatedAt || 0);
      setProcedurePresence({ connected, updatedAt });
      setIsProcedureOpen(connected && Date.now() - updatedAt < 17000);
    }, (e) => {
      console.warn('Failed to read procedure presence', e);
      setProcedurePresence(null);
      setIsProcedureOpen(false);
    });
    return () => unsub();
  }, [app, auth?.currentUser?.uid]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!procedurePresence) {
        setIsProcedureOpen(false);
        return;
      }
      const fresh = Date.now() - (procedurePresence.updatedAt || 0) < 17000;
      setIsProcedureOpen(!!procedurePresence.connected && fresh);
    }, 2000);
    return () => window.clearInterval(id);
  }, [procedurePresence]);

  // Drag handlers for resizing
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const getMaxWidth = () => (typeof window !== 'undefined' ? Math.max(320, window.innerWidth - 120) : 800);
  const getMaxHeight = () => (typeof window !== 'undefined' ? Math.max(240, window.innerHeight - 160) : 600);

  const onTopResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingTopRef.current = true;
    dragStartYRef.current = e.clientY;
    startHeightRef.current = calculatorHeight;
    const onMove = (ev: MouseEvent) => {
      if (!resizingTopRef.current) return;
      const deltaY = dragStartYRef.current - ev.clientY; // dragging up increases height
      const nextH = clamp(startHeightRef.current + deltaY, 250, getMaxHeight());
      setCalculatorHeight(nextH);
    };
    const onUp = () => {
      resizingTopRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onRightResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRightRef.current = true;
    dragStartXRef.current = e.clientX;
    startWidthRef.current = calculatorWidth;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRightRef.current) return;
      const deltaX = ev.clientX - dragStartXRef.current; // dragging right increases width
      const nextW = clamp(startWidthRef.current + deltaX, 240, getMaxWidth());
      setCalculatorWidth(nextW);
    };
    const onUp = () => {
      resizingRightRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onCornerResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingCornerRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    startWidthRef.current = calculatorWidth;
    startHeightRef.current = calculatorHeight;
    const onMove = (ev: MouseEvent) => {
      if (!resizingCornerRef.current) return;
      const deltaX = ev.clientX - dragStartXRef.current; // rightwards increases width
      const deltaY = dragStartYRef.current - ev.clientY; // upwards increases height
      const nextW = clamp(startWidthRef.current + deltaX, 360, getMaxWidth());
      const nextH = clamp(startHeightRef.current + deltaY, 250, getMaxHeight());
      setCalculatorWidth(nextW);
      setCalculatorHeight(nextH);
    };
    const onUp = () => {
      resizingCornerRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Custom hook for managing voice recording functionality.
  // Voice auto-recorder removed; tutoring session manages mic access directly

  const currentQuestion = state.session?.questions[state.session.currentQuestionIndex];
  const userAnswer = currentQuestion ? state.session?.userAnswers[currentQuestion.id] : undefined;
  const isMultipleChoice = Array.isArray(currentQuestion?.options) && (currentQuestion?.options?.length ?? 0) > 0;

  // Reset crossed-out marks whenever a new question is shown; also disable cross-out for non-MC
  React.useEffect(() => {
    setCrossedOutOptions(new Set());
    if (!isMultipleChoice) setCrossOutMode(false);
  }, [state.session?.currentQuestionIndex, isMultipleChoice]);
  // Persist current question context for the procedure canvas OCR to consume
  useEffect(() => {
    (async () => {
      try {
        if (!auth?.currentUser || !app || !currentQuestion) return;
        const db = getFirestore(app!);
        const ref = doc(db, 'users', auth.currentUser.uid, 'procedure', 'context');
        const opts = currentQuestion?.options;
        const normalizedOptions = Array.isArray(opts)
          ? opts.map(opt => (typeof opt === 'string' ? opt : (opt?.text || '')))
          : [];
        const normalizedAnswer = Array.isArray(currentQuestion?.answer)
          ? currentQuestion.answer.join(' or ')
          : String(currentQuestion?.answer || '');
        await setDoc(ref, {
          question: String(currentQuestion?.question || ''),
          options: normalizedOptions,
          answer: normalizedAnswer,
          explanation: String(currentQuestion?.explanation || ''),
          updatedAt: Date.now(),
        }, { merge: true });
      } catch (e) {
        // Non-blocking
      }
    })();
  }, [auth?.currentUser?.uid, app, currentQuestion?.id]);

  // Whether the compact AI tutor is visible (to avoid overlapping with calculator)
  const isTutorVisible = showTutorChat;

  // Re-open the explanation panel when a new answer/explanation becomes available
  useEffect(() => {
    if (userAnswer && currentQuestion?.explanation) {
      setShowExplanationPanel(true);
    } else if (!userAnswer) {
      // Ensure it is closed/reset while answering a new question
      setShowExplanationPanel(false);
    }
  }, [currentQuestion?.id, userAnswer]);

  // Hide explanation panel when tutor is open (chat is shown)
  useEffect(() => {
    if (isTutorOpen) {
      setShowExplanationPanel(false);
    }
  }, [isTutorOpen]);

  // Automatically minimize canvas QR when both calculator and tutor sidebars are open
  // useEffect(() => {
  //   if (isCalculatorOpen && isTutorOpen) {
  //     setIsCanvasMinimized(true);
  //   }
  // }, [isCalculatorOpen, isTutorOpen]);

  // Do not auto-open the AI tutor on the practice page; user must click the Tutor button
  // (Intentionally no effect to open the tutor automatically here)

  // Prefetch helper to load the next question in the background based on prior performance only
  const prefetchNextQuestion = React.useCallback(async (excludeIds: string[]) => {
    if (isPrefetching) return;
    setIsPrefetching(true);
    try {
      const next = await fetchOptimizedQuestion(
        Array.from(new Set([...excludeIds, ...answeredQuestionIds])),
        state.session?.subject
      );
      // Avoid storing duplicates
      if (next && !excludeIds.includes(next.id) && !answeredQuestionIds.includes(next.id)) {
        setPrefetchedQuestion(next);
      }
    } catch (e) {
      console.error('Background prefetch failed:', e);
    } finally {
      setIsPrefetching(false);
    }
  }, [isPrefetching, answeredQuestionIds]);

  // Whenever a new current question is shown, prefetch the following one in the background.
  useEffect(() => {
    if (!state.session || state.session.currentQuestionIndex < 0) return;
    const usedIds = state.session.questions.map(q => q.id);
    // If we don't have a prefetched question, or it's now invalid/used, (re)prefetch.
    if (!prefetchedQuestion || usedIds.includes(prefetchedQuestion.id) || answeredQuestionIds.includes(prefetchedQuestion.id)) {
      const exclude = Array.from(new Set([...usedIds, ...answeredQuestionIds]));
      prefetchNextQuestion(exclude);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.session?.currentQuestionIndex, answeredQuestionIds, prefetchNextQuestion]);

  // This effect runs once on mount to confirm that the component is running on the client.
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Show calculator tip/arrow only once per user: first math question encountered
  useEffect(() => {
    if (!isClient || !authReady || !hydrationDone) return;
    const resumedBeyondFirst = (state.session?.currentQuestionIndex ?? -1) > 0 && hasStartedPractice;
    if (resumedBeyondFirst) {
      setShowCalculatorTip(false);
      return;
    }
    if (isMathQuestion && !hasSeenCalculatorTip && !hasShownCalculatorTipThisSessionRef.current) {
      setShowCalculatorTip(true);
      hasShownCalculatorTipThisSessionRef.current = true;
      lastTipQuestionIdRef.current = currentQuestion?.id ?? null;
      setHasSeenCalculatorTip(true);
      updateUserFlag('hasSeenCalculatorTip', true);
    }
  }, [isClient, authReady, hydrationDone, isMathQuestion, hasSeenCalculatorTip, currentQuestion?.id, state.session?.currentQuestionIndex, hasStartedPractice]);

  // After moving away from the first math question, hide the tip for the rest of the session
  useEffect(() => {
    if (!currentQuestion?.id) return;
    // Hide only after moving away from the question where the tip was shown
    if (
      hasShownCalculatorTipThisSessionRef.current &&
      lastTipQuestionIdRef.current &&
      currentQuestion.id !== lastTipQuestionIdRef.current
    ) {
      setShowCalculatorTip(false);
    }
  }, [currentQuestion?.id]);

  // Show a floating Tutor tip on the first question of the first session, but not on resume beyond Q1
  useEffect(() => {
    if (!isClient || !hydrationDone) return;
    const index = (state.session?.currentQuestionIndex ?? -1);
    const isFirstQuestion = index === 0;
    const resumedBeyondFirst = index > 0 && hasStartedPractice;
    const isFirstSession = !hasCompletedFirstSession;
    if (resumedBeyondFirst) {
      setShowFirstTutorTip(false);
      return;
    }
    if (isFirstSession && isFirstQuestion && !hasShownFirstTutorTipThisSessionRef.current) {
      setShowFirstTutorTip(true);
      hasShownFirstTutorTipThisSessionRef.current = true;
    }
    // Hide when navigating away from the first question
    if (!isFirstQuestion && hasShownFirstTutorTipThisSessionRef.current) {
      setShowFirstTutorTip(false);
    }
  }, [isClient, hydrationDone, state.session?.currentQuestionIndex, hasCompletedFirstSession, hasStartedPractice]);

  // If the first answer was wrong on the first question of the first session, ensure the tip is visible
  useEffect(() => {
    const isFirstQuestion = (state.session?.currentQuestionIndex ?? -1) === 0;
    const isFirstSession = !hasCompletedFirstSession;
    if (isFirstSession && isFirstQuestion && userAnswer && userAnswer.isCorrect === false) {
      setShowFirstTutorTip(true);
    }
  }, [userAnswer, state.session?.currentQuestionIndex, hasCompletedFirstSession]);

  // Show a similar tip after the first ever wrong answer (once per user)
  useEffect(() => {
    if (!userAnswer || userAnswer.isCorrect !== false) return;
    if (hasSeenFirstWrongAnswerTutorial) return;
    if (hasShownWrongTipThisSessionRef.current) return;
    // Prefer wrong-answer tip over first-question tip if both would show
    setShowFirstTutorTip(false);
    setShowWrongAnswerTutorTip(true);
    hasShownWrongTipThisSessionRef.current = true;
    setHasSeenFirstWrongAnswerTutorial(true);
    updateUserFlag('hasSeenFirstWrongAnswerTutorial', true);
  }, [userAnswer, hasSeenFirstWrongAnswerTutorial]);

  // Hide wrong-answer tip when navigating away from the question where it appeared
  useEffect(() => {
    if (!currentQuestion?.id) return;
    if (hasShownWrongTipThisSessionRef.current) {
      setShowWrongAnswerTutorTip(false);
    }
  }, [currentQuestion?.id]);

  // Show R&W annotator tip only once per user: first non-math question encountered
  useEffect(() => {
    if (!isClient || !authReady) return;
    const isRW = !isMathQuestion;
    if (isRW && !hasSeenRWAnnotatorTip && !hasShownRWTipThisSessionRef.current) {
      setShowRWAnnotatorTip(true);
      hasShownRWTipThisSessionRef.current = true;
      lastRWTipQuestionIdRef.current = currentQuestion?.id ?? null;
      setHasSeenRWAnnotatorTip(true);
      updateUserFlag('hasSeenRWAnnotatorTip', true);
    }
  }, [isClient, authReady, isMathQuestion, hasSeenRWAnnotatorTip, currentQuestion?.id]);

  // Hide R&W tip after moving away from the first R&W question shown
  useEffect(() => {
    if (!currentQuestion?.id) return;
    if (
      hasShownRWTipThisSessionRef.current &&
      lastRWTipQuestionIdRef.current &&
      currentQuestion.id !== lastRWTipQuestionIdRef.current
    ) {
      setShowRWAnnotatorTip(false);
    }
  }, [currentQuestion?.id]);

  /**
   * A generic helper function to update a boolean flag in the user's document in Firestore.
   * @param flagName The name of the field to update.
   * @param value The new boolean value.
   */
  const updateUserFlag = async (flagName: string, value: boolean) => {
    if (!auth?.currentUser || !app) {
      // Silently return if auth/app not available (e.g., during unmount)
      return;
    }
    
    try {
      const db = getFirestore(app!);
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        [`flags.${flagName}`]: value
      });
    } catch (error) {
      console.error(`Error updating ${flagName}:`, error);
    }
  };

  // This effect is responsible for loading the very first question of a session.
  // It ensures that a question is fetched only once when the session begins.
  useEffect(() => {
    async function loadFirstQuestion() {
      console.log('Checking if should load first question:', {
        hasSession: !!state.session,
        questionsLength: state.session?.questions.length,
        currentIndex: state.session?.currentQuestionIndex,
        isLoading,
        hasLoadedFirstQuestion,
        isClient
      });

      if (state.session && 
          state.session.questions.length === 0 && 
          state.session.currentQuestionIndex === -1 && 
          !isLoading && 
          !hasLoadedFirstQuestion &&
          isClient) {
        
        const isFirstSession = !hasStartedPractice;
        if (isFirstSession) {
          // Update state and database
          setHasStartedPractice(true);
          await updateUserFlag('hasStartedPractice', true);
        }
        // One-shot guard: only load once per session startTime
        if (initialLoadInFlightRef.current) return;
        if (initialLoadSessionStartRef.current === state.session.startTime) return;
        initialLoadInFlightRef.current = true;
        initialLoadSessionStartRef.current = state.session.startTime;

        console.log('Loading first question...');
        setIsLoading(true);
        setHasLoadedFirstQuestion(true);
        try {
          const exclude = answeredQuestionIds;
          const question = await fetchOptimizedQuestion(exclude, state.session?.subject);
          console.log('Fetched question:', question);
          if (question) {
            dispatch({ 
              type: 'LOAD_NEXT_QUESTION', 
              payload: { question } 
            });
          } else {
            console.log('No question available');
            toast.error('No questions available');
            window.location.href = '/dashboard';
          }
        } catch (error) {
          console.error('Error loading first question:', error);
          toast.error('Failed to load questions');
          window.location.href = '/dashboard';
        } finally {
          setIsLoading(false);
          initialLoadInFlightRef.current = false;
        }
      }
    }

    if (state.session && isClient) {
      loadFirstQuestion();
    }
  }, [state.session, hasLoadedFirstQuestion, dispatch, router, isLoading, aiTutorEnabled, hasStartedPractice, isClient]);

  // This effect handles navigation. If the session is lost or not present,
  // check for active session in Firestore before redirecting to dashboard.
  useEffect(() => {
    if (!state.session && !isLoading && !state.showResults && isClient && hydrationDone) {
      // Check if there's an active session in Firestore before redirecting
      (async () => {
        try {
          if (!auth?.currentUser || !app) {
            // No auth, redirect to dashboard
            const url = new URL(window.location.href);
            const start = url.searchParams.get('start');
            const subject = url.searchParams.get('subject');
            setHasLoadedFirstQuestion(false);
            if (start && subject) {
              window.location.href = `/dashboard?start=${encodeURIComponent(start)}&subject=${encodeURIComponent(subject)}`;
            } else {
              window.location.href = '/dashboard';
            }
            return;
          }

          const db = getFirestore(app);
          const userRef = doc(db, 'users', auth.currentUser.uid);
          const snap = await getDoc(userRef);
          const active = !!(snap.exists() && (snap.data() as any)['active-practice-session']);
          
          if (active) {
            // There's an active session, check if it's in Firestore practice/session
            const sessionRef = doc(db, 'users', auth.currentUser.uid, 'practice', 'session');
            const sessionSnap = await getDoc(sessionRef);
            if (sessionSnap.exists()) {
              const data = sessionSnap.data() as any;
              const endTime = data?.session?.endTime || 0;
              const now = Date.now();
              const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
              
              if (timeRemaining > 0) {
                // Active session exists, stay on practice page (hydration will restore it)
                return;
              }
            }
          }

          // No active session, redirect to dashboard
          const url = new URL(window.location.href);
          const start = url.searchParams.get('start');
          const subject = url.searchParams.get('subject');
          setHasLoadedFirstQuestion(false);
          if (start && subject) {
            window.location.href = `/dashboard?start=${encodeURIComponent(start)}&subject=${encodeURIComponent(subject)}`;
          } else {
            window.location.href = '/dashboard';
          }
        } catch {
          // Error checking, redirect to dashboard
          const url = new URL(window.location.href);
          const start = url.searchParams.get('start');
          const subject = url.searchParams.get('subject');
          setHasLoadedFirstQuestion(false);
          if (start && subject) {
            window.location.href = `/dashboard?start=${encodeURIComponent(start)}&subject=${encodeURIComponent(subject)}`;
          } else {
            window.location.href = '/dashboard';
          }
        }
      })();
    }
  }, [state.session, router, isLoading, state.showResults, isClient, hydrationDone]);

  // When hydrating a session (resume after refresh), suppress helper tips unless it's the user's first-ever session
  useEffect(() => {
    if (!hydrationDone) return;
    // If we resumed with an existing session and it isn't the very first session ever, hide tips
    const resumed = !!state.session && state.session.currentQuestionIndex >= 0 && hasStartedPractice;
    if (resumed) {
      setShowCalculatorTip(false);
      setShowFirstTutorTip(false);
      setShowWrongAnswerTutorTip(false);
    }
  }, [hydrationDone]);

  // Single source of truth: set the flag to true exactly once after arriving on /practice
  useEffect(() => {
    if (!authReady || !auth?.currentUser || !app) return;
    (async () => {
      try {
        const db = getFirestore(app!);
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const snap = await getDoc(userRef);
        const active = !!(snap.exists() && (snap.data() as any)['active-practice-session']);
        if (!active) {
          await updateDoc(userRef, { ['active-practice-session']: true } as any).catch(async () => {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(userRef, { ['active-practice-session']: true } as any, { merge: true } as any);
          });
        }
      } catch (e) {
        // non-blocking
      }
    })();
  }, [authReady, auth?.currentUser?.uid, app]);

  // This effect watches for the session to complete. When it does, it sets a flag
  // in the database that can be used to trigger post-session experiences, like a summary modal.
  useEffect(() => {
    if (state.showResults && !hasCompletedFirstSession) {
      setHasCompletedFirstSession(true);
      updateUserFlag('hasCompletedFirstSession', true);
      // Set a flag that the dashboard will check to show the first session complete modal
      updateUserFlag('showFirstSessionComplete', true);
    }
  }, [state.showResults, hasCompletedFirstSession]);

  // isTutorReady flow removed

  // This effect checks and updates the bookmark status of the current question
  // whenever a new question is displayed.
  useEffect(() => {
    async function checkBookmarkStatus() {
      if (!auth?.currentUser || !state.session || state.session.currentQuestionIndex < 0) return;
      
      try {
        const db = getFirestore(app!);
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const bookmarks = userData.bookmarks || [];
          const currentQuestionId = state.session.questions[state.session.currentQuestionIndex]?.id;
          if (currentQuestionId) {
            setIsBookmarked(bookmarks.includes(currentQuestionId));
          }
        }
      } catch (error) {
        console.error('Error checking bookmark status:', error);
      }
    }

    checkBookmarkStatus();
  }, [state.session?.currentQuestionIndex]);

  // On component mount, subscribe to the user's settings (culture, flags) and keep them in sync live
  useEffect(() => {
    if (!auth) return;
    let unsubscribeUser: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Clean up any prior user subscription when auth user changes
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }
      if (user && app) {
        setAuthReady(true);
        const db = getFirestore(app!);
        const userRef = doc(db, 'users', user.uid);
        // Live subscribe to user doc so flag changes reflect immediately
        unsubscribeUser = onSnapshot(userRef, (userDoc) => {
          if (!userDoc.exists()) return;
          const userData = userDoc.data() as any;
          setUserCulture(userData.culture || userData.country || 'US');
          const flags = userData.flags || {};
          setHasSeenFirstWrongAnswerTutorial(flags.hasSeenFirstWrongAnswerTutorial ?? false);
          setHasStartedPractice(flags.hasStartedPractice ?? false);
          setHasCompletedFirstSession(flags.hasCompletedFirstSession ?? false);
          setHasSeenCalculatorTip(flags.hasSeenCalculatorTip ?? false);
          setHasSeenRWAnnotatorTip(flags.hasSeenRWAnnotatorTip ?? false);
          const tn = userData['tutor-name'] as string | undefined;
          if (tn && tn.trim()) setTutorName(tn.trim());
          const tv = userData['tutor-voice'] as string | undefined;
          if (tv && tv.trim()) setTutorVoice(tv.trim());
        });
        // Also subscribe to live procedure score document
        const procRef = doc(db, 'users', user.uid, 'procedure', 'current');
        const unsubProc = onSnapshot(procRef, (snap) => {
          const data = snap.data() as any;
          const raw = data?.score;
          const n = typeof raw === 'number' ? raw : Number(raw);
          if (!Number.isNaN(n) && n >= 1 && n <= 5) {
            setProcedureScore(Math.round(n));
          }
        });
        // Chain the cleanup on the same variable slot
        const prevUnsub = unsubscribeUser;
        unsubscribeUser = () => { prevUnsub?.(); unsubProc(); };
        // Also fetch user's answered history to avoid repeats across sessions (one-time)
        (async () => {
          try {
            const historyRef = collection(db, 'users', user.uid, 'history');
            const snap = await getDocs(historyRef);
            const answered = snap.docs.map((d) => (d.data() as any)?.questionId).filter(Boolean);
            setAnsweredQuestionIds(answered);
          } catch (e) {
            console.error('Error fetching answered history:', e);
          }
        })();
      } else {
        setAuthReady(false);
      }
    });
    return () => {
      if (unsubscribeUser) unsubscribeUser();
      unsubscribeAuth();
    };
  }, []);

  // Removed auto voice recording on question change

  /**
   * Toggles the bookmark status of the current question.
   * Updates the user's bookmarks array in Firestore.
   */
  const handleBookmark = async () => {
    if (!auth?.currentUser || !state.session || state.session.currentQuestionIndex < 0) return;

    const db = getFirestore(app!);
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const currentQuestionId = state.session.questions[state.session.currentQuestionIndex].id;

    try {
      if (isBookmarked) {
        await updateDoc(userRef, {
          bookmarks: arrayRemove(currentQuestionId)
        });
        toast.success('Bookmark removed');
      } else {
        await updateDoc(userRef, {
          bookmarks: arrayUnion(currentQuestionId)
        });
        toast.success('Question bookmarked');
      }
      setIsBookmarked(!isBookmarked);
    } catch (error) {
      console.error('Error updating bookmark:', error);
      toast.error('Failed to update bookmark');
    }
  };

  /**
   * Confirms the user's intent to exit the session, resets the session state,
   * and navigates back to the dashboard.
   */
  const confirmExit = async () => {
    // Mark first session completion when applicable
    if (!hasCompletedFirstSession) {
      setHasCompletedFirstSession(true);
      await updateUserFlag('hasCompletedFirstSession', true);
      await updateUserFlag('showFirstSessionComplete', true);
    }

    // Show results for the current (truncated) session on this page
    dispatch({ type: 'COMPLETE_SESSION' });
    // Release active flag
    try {
      // Signal the procedure canvas to clear when exiting practice
      try {
        const db = getFirestore(app!);
        const ctrlRef = doc(db, 'users', auth.currentUser!.uid, 'procedure', 'control');
        await setDoc(ctrlRef, { clearRequestedAt: Date.now() }, { merge: true });
      } catch (e) {
        console.warn('Failed to signal canvas clear (exit):', e);
      }
      if (auth?.currentUser && app) {
        const db = getFirestore(app!);
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { ['active-practice-session']: false } as any);
        console.log('[practice] released active-practice-session on exit');
      }
    } catch {}
    toast.info('Session ended. Showing results.');
  };

  /**
   * Handles the user's action to proceed after seeing the microphone permission explanation.
   * It attempts to request microphone access and then loads the first question.
   */
  const handleMicPermissionProceed = async () => {
    // Proceed directly to load the first question (no pre-permission dialog)
    setIsLoading(true);
    setHasLoadedFirstQuestion(true);
    try {
      const exclude = answeredQuestionIds;
      const question = await fetchOptimizedQuestion(exclude, state.session?.subject);
      if (question) {
        dispatch({ 
          type: 'LOAD_NEXT_QUESTION', 
          payload: { question } 
        });
      } else {
        toast.error('No questions available');
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Error loading first question:', error);
      toast.error('Failed to load questions');
      window.location.href = '/dashboard';
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles the user's choice to skip the microphone permission step.
   * It proceeds to load the first question without enabling the AI tutor's voice features.
   */
  const handleMicPermissionSkip = () => {};

  /**
   * Handles the continuation from the "first wrong answer" tutorial.
   * It simply closes the tutorial and flags that the user has seen it.
   */
  const handleFirstWrongTutorialContinue = async () => {};

  /**
   * Handles the user's choice to open the AI tutor from the "first wrong answer" tutorial.
   */
  const handleFirstWrongTutorialOpenTutor = async () => {};

  /**
   * The core logic for processing a user's answer submission.
   * This function stops the voice recorder, calculates scores, updates the user's stats in Firestore,
   * and triggers follow-up actions like showing confetti or the AI tutor.
   * @param isCorrect Whether the submitted answer was correct.
   * @param answer The user's submitted answer (either an option index or text).
   */
  const handleAnswerSubmission = async (isCorrect: boolean, answer: string | number) => {
    // Comprehensive validation with user feedback
    if (isSubmitting) {
      console.log('Answer submission already in progress');
      return;
    }

    if (!isClient) {
      console.error('Client not ready for answer submission');
      toast.error('Please wait for the page to fully load');
      return;
    }

  // Do not block submissions on hydration; allow answering while background restore continues

  if (!state.session) {
      console.error('No active session for answer submission');
      toast.error('No active session found. Please start a new practice session.');
      return;
    }

    if (!auth?.currentUser) {
      console.error('No authenticated user for answer submission');
      toast.error('Please log in to submit your answer');
      return;
    }

    if (!app) {
      console.error('Firebase not initialized for answer submission');
      toast.error('Connection error. Please refresh the page.');
      return;
    }

    if (isAnswered) {
      console.log('Question already answered');
      return;
    }

    if (!currentQuestion) {
      console.error('No current question for answer submission');
      toast.error('No question loaded. Please try again.');
      return;
    }

    console.log('Starting answer submission process:', {
      questionId: currentQuestion.id,
      answer,
      isCorrect,
      userAuthenticated: !!auth.currentUser,
      firebaseInitialized: !!app
    });

    setIsSubmitting(true);

    try {
      // Close the live tutor if it's open when an answer is submitted
      if (showTutorChat) setShowTutorChat(false);
      // Don't reset the tutor session when answer is submitted - preserve chat history
      // The explanation will be added to the existing chat conversation

      dispatch({ type: 'PAUSE_TIMER' });
      setIsAnswered(true); // Set answered state immediately for UI feedback

      const timeSinceQuestionStart = state.session.questionStartTimes[currentQuestion.id]
        ? (Date.now() - state.session.questionStartTimes[currentQuestion.id]) / 1000
        : 30; // Default to 30s if not found

      // Compute and display local mastery delta for the current skill
      try {
        if (auth?.currentUser && currentQuestion?.skill) {
          const al = await adaptiveLearningService.getUserAdaptiveLearningData(auth.currentUser.uid);
          const subId = getSubdomainId(currentQuestion.skill) || String(currentQuestion.domain);
          const engine = new AdaptiveLearningEngine();
          const currentScore = (al?.subdomainScores && (al.subdomainScores as any)[subId])
            ? (al!.subdomainScores as any)[subId]
            : engine.initializeSubdomainScore();
          const update: ScoreUpdate = {
            subdomainId: String(subId),
            questionId: currentQuestion.id,
            isCorrect,
            timeSpent: Math.floor(timeSinceQuestionStart),
            difficulty: Number((currentQuestion as any).difficulty) || 0,
            timestamp: Date.now(),
          };
          const newScore = engine.updateSubdomainScore(currentScore, update);
          const delta = Math.round((newScore.competencyScore - currentScore.competencyScore) * 10) / 10;
          console.log('Skill delta', { skill: currentQuestion.skill, subId, delta });
          if (!Number.isNaN(delta)) {
            // Accumulate per-skill delta for the results page
            setSessionSkillDeltas((prev) => {
              const next = { ...prev };
              const key = currentQuestion.skill;
              next[key] = (next[key] || 0) + delta;
              // Round to one decimal to avoid floating drift
              next[key] = Math.round(next[key] * 10) / 10;
              return next;
            });
            setSkillDelta({ value: delta, color: delta > 0 ? 'green' : 'red' });
            // reset any in-flight timers and animation state
            if (deltaClearTimeoutRef.current) window.clearTimeout(deltaClearTimeoutRef.current);
            if (deltaOutTimeoutRef.current) window.clearTimeout(deltaOutTimeoutRef.current);
            setSkillDeltaAnim('start');
            // give React a tick to apply 'start', then trigger 'end' for fade-out
            deltaOutTimeoutRef.current = window.setTimeout(() => {
              setSkillDeltaAnim('end');
            }, 1200);
            // remove after ~2.3s
            if (deltaClearTimeoutRef.current) window.clearTimeout(deltaClearTimeoutRef.current);
            deltaClearTimeoutRef.current = window.setTimeout(() => {
              setSkillDelta(null);
              setSkillDeltaAnim(null);
              deltaClearTimeoutRef.current = null;
            }, 2300);
          }
        }
      } catch (e) {
        console.error('Failed to compute local skill delta:', e);
      }

      // Dispatch answer to context and await adaptive update completion
      dispatch({
        type: 'ANSWER_QUESTION',
        payload: {
          questionId: currentQuestion.id,
          answer,
          isCorrect,
          timeSpent: timeSinceQuestionStart,
          domain: String(currentQuestion.domain)
        },
      });

      // Record locally to prevent repeats across session boundaries without reload
      setAnsweredQuestionIds(prev => prev.includes(currentQuestion.id) ? prev : [...prev, currentQuestion.id]);

      // Adaptive update is handled inside the reducer's ANSWER_QUESTION branch

      // No auto-open of tutor after wrong answer; user opens via button

      // Show confetti for correct answers
      if (isCorrect) {
          console.log('Triggering confetti for correct answer');
          
          // Trigger random cheer if available
          if (cheerLines.length > 0) {
            const randomCheer = cheerLines[Math.floor(Math.random() * cheerLines.length)];
            setCurrentCheer(randomCheer);
          }

          try {
            // Ensure confetti is available and we're on the client
            if (typeof window !== 'undefined' && confetti) {
              confetti({
                  particleCount: 100,
                  spread: 70,
                  origin: { y: 0.6 },
              });
              console.log('Confetti triggered successfully');
            } else {
              console.warn('Confetti not available - likely SSR or missing library');
            }
          } catch (confettiError) {
            console.error('Error triggering confetti:', confettiError);
          }
      }

      console.log('Answer submission completed successfully');

      // Trigger prefetch if not already ready, to ensure next question is available asap
      if (!prefetchedQuestion) {
         const usedIds = state.session.questions.map(q => q.id);
         const exclude = Array.from(new Set([...usedIds, ...answeredQuestionIds]));
         prefetchNextQuestion(exclude);
      }
    } catch (error) {
      console.error('Error in answer submission:', error);
      toast.error('An error occurred while submitting your answer. Please try again.');
      setIsAnswered(false); // Reset state on error
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles the selection of a multiple-choice option.
   * It updates the local state to reflect the user's choice but does not submit the answer yet.
   * @param optionIndex The index of the selected option.
   */
  const handleMultipleChoiceAnswer = async (optionIndex: number) => {
    if (isAnswered || !state.session) return;
    
    // Toggle selection: if already selected, deselect it; otherwise select it
    setSelectedOption(selectedOption === optionIndex ? null : optionIndex);
  };

  /**
   * Handles the submission of a text-based (open-ended) answer.
   */
  const handleTextSubmit = async () => {
    if (textAnswer.trim() === '' || !state.session || isAnswered || !currentQuestion || isSubmitting || !isClient) return;
    
    console.log('Handling text submit:', { textAnswer: textAnswer.trim(), questionId: currentQuestion.id });
    
    const isCorrect = checkOpenEndedAnswer(textAnswer.trim(), currentQuestion.answer);
    
    await handleAnswerSubmission(isCorrect, textAnswer.trim());
    
    setTextAnswer('');
  };

  /**
   * Handles loading the next question in the session.
   * It closes the AI tutor if open, fetches a new optimized question, and updates the session state.
   */
  const handleNextQuestion = async () => {
    if (!state.session) return;
    
    // Reset the live tutor session when moving to next question
    if (showTutorChat) setShowTutorChat(false);
    setTutorResetKey(`next-${Date.now()}`);
    
    // Close calculator by default when moving to next question
    setIsCalculatorOpen(false);
    
    setIsAnswered(false);
    setSelectedOption(null);
    setCurrentCheer(null);

    // Check if time is up
    if (state.timeRemaining <= 0) {
      // Auto-complete session when time runs out and update active flag in Firestore
      try {
        const db = getFirestore(app!);
        const userRef = doc(db, 'users', auth.currentUser!.uid);
        await updateDoc(userRef, { ['active-practice-session']: false });
        // Also snapshot that session is completed so refresh shows results
        const sessionRef = doc(db, 'users', auth.currentUser!.uid, 'practice', 'session');
        await updateDoc(sessionRef, { isActive: false, showResults: true }).catch(async (err) => {
          if ((err as any)?.code === 'not-found') {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(sessionRef, { isActive: false, showResults: true });
          }
        });
      } catch (e) {
        console.warn('Failed to update active-practice-session on timeout:', e);
      }
      dispatch({ type: 'COMPLETE_SESSION' });
      return;
    }

    console.log('Loading next question...');
    setLoadingNextQuestion(true);
    
    try {
      // Signal the procedure canvas to clear before loading a new question
      try {
        const db = getFirestore(app!);
        const ctrlRef = doc(db, 'users', auth.currentUser!.uid, 'procedure', 'control');
        await setDoc(ctrlRef, { clearRequestedAt: Date.now() }, { merge: true });
      } catch (e) {
        console.warn('Failed to signal canvas clear (next question):', e);
      }
      // Get IDs of already used questions to avoid duplicates
      const usedQuestionIds = state.session.questions.map(q => q.id);
      console.log('Used question IDs:', usedQuestionIds);

      // Prefer using a background-prefetched question if valid
      const alreadyExcluded = new Set([...usedQuestionIds, ...answeredQuestionIds]);
      const candidate = prefetchedQuestion && !alreadyExcluded.has(prefetchedQuestion.id)
        ? prefetchedQuestion
        : null;

      if (candidate) {
        dispatch({ type: 'LOAD_NEXT_QUESTION', payload: { question: candidate } });
        console.log('Prefetched question dispatched:', candidate.id);
        // Clear the consumed prefetch and immediately prefetch the following one
        setPrefetchedQuestion(null);
        const nextExclude = Array.from(new Set([...usedQuestionIds, ...answeredQuestionIds, candidate.id]));
        prefetchNextQuestion(nextExclude);
        return;
      }

      // Fallback: fetch on-demand as before
      const nextQuestion = await fetchOptimizedQuestion(
        Array.from(new Set([...usedQuestionIds, ...answeredQuestionIds])),
        state.session?.subject
      );
      console.log('Next question fetched:', nextQuestion);

      if (nextQuestion) {
        // Double check we're not getting a duplicate
        if (alreadyExcluded.has(nextQuestion.id)) {
          console.warn('Received duplicate question despite filtering:', nextQuestion.id);
          // Try again with stricter exclusion
          const retryQuestion = await fetchOptimizedQuestion(
            Array.from(new Set([...usedQuestionIds, ...answeredQuestionIds])),
            state.session?.subject
          );
          if (retryQuestion && !alreadyExcluded.has(retryQuestion.id)) {
            dispatch({ type: 'LOAD_NEXT_QUESTION', payload: { question: retryQuestion } });
            console.log('Retry question dispatched:', retryQuestion.id);
            // Prefetch the subsequent one
            prefetchNextQuestion(Array.from(new Set([...usedQuestionIds, ...answeredQuestionIds, retryQuestion.id])));
          } else {
            console.log('Still no unique question after retry, completing session');
            toast.info('No more unique questions available');
            dispatch({ type: 'COMPLETE_SESSION' });
          }
        } else {
          dispatch({ type: 'LOAD_NEXT_QUESTION', payload: { question: nextQuestion } });
          console.log('Next question dispatched:', nextQuestion.id);
          // Prefetch the subsequent one
          prefetchNextQuestion(Array.from(new Set([...usedQuestionIds, ...answeredQuestionIds, nextQuestion.id])));
        }
      } else {
        console.log('No more questions available, completing session');
        toast.info('No more questions available');
        try {
          const db = getFirestore(app!);
          const userRef = doc(db, 'users', auth.currentUser!.uid);
          await updateDoc(userRef, { ['active-practice-session']: false });
        } catch (e) {
          console.warn('Failed to update active-practice-session (no more questions):', e);
        }
        dispatch({ type: 'COMPLETE_SESSION' });
      }
    } catch (error) {
      console.error('Error loading next question:', error);
      toast.error('Failed to load next question');
      // Continue anyway - complete session and mark inactive
      try {
        const db = getFirestore(app!);
        const userRef = doc(db, 'users', auth.currentUser!.uid);
        await updateDoc(userRef, { ['active-practice-session']: false });
      } catch (e2) {
        console.warn('Failed to update active-practice-session (error path):', e2);
      }
      dispatch({ type: 'COMPLETE_SESSION' });
    } finally {
      setLoadingNextQuestion(false);
    }
  };

  /**
   * Determines the visual variant for a multiple-choice option button based on the answer state.
   * @param index The index of the option.
   * @param userAnswer The user's answer object.
   * @param correctAnswer The correct answer index.
   * @returns A string representing the button variant ('outline', 'default', 'destructive').
   */
  const getOptionVariant = (index: number, userAnswer: { answer: string | number; isCorrect: boolean } | undefined, correctAnswer: number) => {
    if (!userAnswer) return 'outline';
    
    if (index === correctAnswer) return 'default';
    if (index === Number(userAnswer.answer) && !userAnswer?.isCorrect) return 'destructive';
    return 'outline';
  };

  /**
   * Determines the icon to display next to a multiple-choice option after it has been answered.
   * @param index The index of the option.
   * @param userAnswer The user's answer object.
   * @param correctAnswer The correct answer index.
   * @returns A check or X icon component, or null.
   */
  const getOptionIcon = (index: number, userAnswer: { answer: string | number; isCorrect: boolean } | undefined, correctAnswer: number) => {
    if (!userAnswer) return null;
    
    if (index === correctAnswer) return <CheckCircleIcon className="h-4 w-4" />;
    if (index === Number(userAnswer.answer) && !userAnswer?.isCorrect) return <XCircleIcon className="h-4 w-4" />;
    return null;
  };

  /**
   * Formats a time in seconds into a 'minutes:seconds' string.
   * @param seconds The total number of seconds.
   * @returns The formatted time string.
   */
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  /**
   * Calculates the percentage of time that has elapsed in the session.
   * @returns The progress percentage (0-100).
   */
  const getTimeProgress = () => {
    if (!state.session) return 0;
    const totalTime = state.session.duration * 60;
    const elapsedTime = totalTime - state.timeRemaining;
    return (elapsedTime / totalTime) * 100;
  };

  // Don't render anything until client-side hydration is complete to avoid mismatches.
  if (!isClient) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <Loading size="lg" text="Loading practice session..." />
        </div>
      </MainLayout>
    );
  }

  // Show a loading indicator while fetching questions.
  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <Loading size="lg" text="Loading question..." />
        </div>
      </MainLayout>
    );
  }

  // Wait for the session to be fully initialized before rendering the main UI.
  if (!state.session || state.session.currentQuestionIndex < 0) {
    console.log('Session not ready:', { 
      hasSession: !!state.session, 
      currentIndex: state.session?.currentQuestionIndex,
      fullState: state 
    });
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text="Preparing your session..." />
        </div>
      </MainLayout>
    );
  }

  // Render the results view when the session is complete.
  if (state.showResults) {
    if (!state.session) return null;

    return (
      <MainLayout>
        <SessionSummary 
          session={state.session}
          skillDeltas={sessionSkillDeltas}
          onReturnToDashboard={() => {
            console.log('Return to Dashboard clicked');
            dispatch({ type: 'RESET_SESSION' });
            
            // Full page reload to ensure fresh data on dashboard
            setTimeout(() => {
              window.location.href = '/dashboard';
              toast.success('Session completed');
            }, 100);
          }}
          onPracticeAgain={async () => {
            try {
              console.log('Practice Again clicked');
              const sessionDuration = state.session!.duration;
              const subject = state.session!.subject;
              if (!auth?.currentUser || !app) throw new Error('AUTH_REQUIRED');
              const db = getFirestore(app!);
              
              // Check for active session before starting transaction
              const userRef = doc(db, 'users', auth.currentUser.uid);
              const userSnap = await getDoc(userRef);
              const active = !!(userSnap.exists() && (userSnap.data() as any)['active-practice-session']);
              
              if (active) {
                // Check if the active session is still valid
                const sessionRef = doc(db, 'users', auth.currentUser.uid, 'practice', 'session');
                const sessionSnap = await getDoc(sessionRef);
                if (sessionSnap.exists()) {
                  const data = sessionSnap.data() as any;
                  const endTime = data?.session?.endTime || 0;
                  const now = Date.now();
                  const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
                  if (timeRemaining > 0) {
                    // Active session exists, redirect to practice page
                    window.location.href = '/practice';
                    return;
                  }
                }
              }
              
              // No active session or session expired, start new one
              await runTransaction(db, async (tx) => {
                const snap = await tx.get(userRef);
                const stillActive = !!(snap.exists() && (snap.data() as any)['active-practice-session']);
                if (stillActive) {
                  // Double-check: another process might have started a session
                  const sessionRef = doc(db, 'users', auth.currentUser.uid, 'practice', 'session');
                  const sessionSnap = await tx.get(sessionRef);
                  if (sessionSnap.exists()) {
                    const data = sessionSnap.data() as any;
                    const endTime = data?.session?.endTime || 0;
                    const now = Date.now();
                    const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
                    if (timeRemaining > 0) {
                      throw new Error('ACTIVE_IN_USE');
                    }
                  }
                  // Session expired, clear the flag
                  tx.update(userRef, { ['active-practice-session']: false } as any);
                }
                tx.set(userRef, { ['active-practice-session']: true }, { merge: true } as any);
              });
              
              dispatch({ type: 'RESET_SESSION' });
              setHasLoadedFirstQuestion(false);
              setTimeout(() => {
                dispatch({
                  type: 'START_SESSION',
                  payload: { duration: sessionDuration, subject }
                });
                toast.success('Starting new practice session');
              }, 50);
            } catch (e: any) {
              if (e?.message === 'ACTIVE_IN_USE') {
                // Active session exists, redirect to practice page
                window.location.href = '/practice';
              } else {
                toast.error('Failed to start practice session. Please try again.');
              }
            }
          }}
        />
      </MainLayout>
    );
  }

  // Handle the edge case where a question is expected but not available.
  if (!currentQuestion) {
    console.log('No current question found:', {
      hasSession: !!state.session,
      currentIndex: state.session?.currentQuestionIndex,
      questionsLength: state.session?.questions.length,
      loadingNextQuestion
    });
    
    return (
      <MainLayout 
        hideBreadcrumbOnMobile
        breadcrumbs={[]}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text={loadingNextQuestion ? "Loading next question..." : "Loading question..."} />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout hideBreadcrumbOnMobile breadcrumbs={[]} maxWidth="full" className="p-0"> 
      <div className="flex h-screen overflow-hidden bg-background">
        <TutorSidebar
          question={{
            question: sanitizeText(currentQuestion?.question || ''),
            options: (() => {
              const opts = currentQuestion?.options;
              if (!opts) return [];
              if (Array.isArray(opts)) {
                return opts.map(opt => sanitizeText(typeof opt === 'string' ? opt : opt.text || ''));
              }
              return [];
            })(),
            answer: Array.isArray(currentQuestion?.answer) ? sanitizeText(currentQuestion.answer.join(' or ')) : sanitizeText(String(currentQuestion?.answer || '')),
            passage: currentQuestion?.passage ? sanitizeText(currentQuestion.passage) : undefined,
            explanation: currentQuestion?.explanation
          }}
          userAnswer={userAnswer?.answer || ''}
          hasSubmittedAnswer={!!userAnswer}
          highlightsCsv={highlightsCsv}
          tutorName={tutorName}
          tutorVoice={tutorVoice}
          resetKey={tutorResetKey}
          textSize={textSize}
          className="hidden md:flex shrink-0 h-full"
          onOpenChange={setIsTutorOpen}
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 container mx-auto max-w-7xl relative">
        {/* Mobile compact header */}
        <div className="md:hidden flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showTimers && (
              <Badge 
                variant={state.timeRemaining <= 60 ? "destructive" : state.timeRemaining <= 300 ? "secondary" : "outline"}
                className={cn("font-mono", state.timeRemaining <= 10 && "animate-pulse")}
              >
                {formatTime(state.timeRemaining)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!showTimers && (
              <Button
                variant="ghost"
                size="icon"
                className="p-2"
                onClick={() => setShowTimers(v => !v)}
                aria-label="Show timers"
                title="Show timers"
              >
                <TimerOff className="h-5 w-5" />
              </Button>
            )}
            <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowExitConfirm(true)}>
                  <XIcon className="h-3 w-3" />
                  Exit
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Exit Practice Session</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to exit this session? Your progress will be saved, but you&apos;ll need to start a new session to continue practicing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continue Practicing</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmExit}>
                    Exit Session
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Desktop time progress bar */}
        <div className="hidden md:block">
          <div className="flex items-center gap-2">
            {/* Exit button - always visible */}
            <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="p-2 mr-2 text-muted-foreground hover:text-foreground" onClick={() => setShowExitConfirm(true)}>
                  <XIcon className="h-5 w-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Exit Practice Session</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to exit this session? Your progress will be saved, but you&apos;ll need to start a new session to continue practicing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continue Practicing</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmExit}>Exit Session</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Time component - conditionally shown */}
            {showTimers ? (
              <>
                <Progress value={getTimeProgress()} className="h-2 flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-2"
                  onClick={() => setShowTimers(false)}
                  aria-label="Hide timers"
                  title="Hide timers"
                >
                  <TimerOff className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="p-2"
                onClick={() => setShowTimers(true)}
                aria-label="Show timers"
                title="Show timers"
              >
                <Timer className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Auto Voice Recording removed */}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative min-h-[calc(100vh-300px)]">
          {/* Question Column */}
          <div className={cn(
            "flex flex-col min-h-[calc(100vh-300px)]",
            // Adjust column span based on what's shown on the right
            (() => {
              const hasPassage = currentQuestion.passage && currentQuestion.passage.trim() !== '';
              
              if (hasPassage) {
                return "lg:col-span-7"; // Passage on the right - question takes medium space
              } else {
                return "lg:col-span-12"; // No passage - question takes full width
              }
            })()
          )}>
            <div className="w-full max-w-4xl mx-auto animate-fade-in flex flex-col min-h-full">
              {/* Header Section - Top */}
              <div className="pt-6 pb-4 px-6">
                <div className="flex w-full flex-col gap-0 md:gap-2">
                  <div className="flex w-full items-center justify-between md:py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <div className="text-3xl font-bold leading-none">Question {state.session.currentQuestionIndex + 1}</div>
                        {currentQuestion?.skill && (
                          <span className="text-base text-muted-foreground">{currentQuestion.skill}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {skillDelta && (
                          <span
                            aria-live="polite"
                            className={cn(
                              'text-base md:text-lg font-semibold transition-all duration-1000',
                              skillDelta.color === 'green' ? 'text-green-600' : 'text-red-600',
                              skillDeltaAnim === 'start' ? 'opacity-100 translate-y-0' : '',
                              skillDeltaAnim === 'end' ? 'opacity-0 -translate-y-3' : ''
                            )}
                          >
                            {skillDelta.value > 0 ? `+${skillDelta.value}%` : `${skillDelta.value}%`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {auth?.currentUser?.displayName === (process.env.NEXT_PUBLIC_UNLIMITED_REFERRER_USERNAME || '') && (
                        <span className="hidden md:inline text-xs text-muted-foreground select-all">
                          {currentQuestion?.id ? `Question ID: ${currentQuestion.id}` : ''}
                        </span>
                      )}
                      {/* Cross-out mode toggle (MC only) */}
                      {isMultipleChoice && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("text-gray-500 dark:text-gray-400 p-0 h-14 w-14", crossOutMode && "text-primary")}
                          onClick={() => setCrossOutMode(v => !v)}
                          aria-label={crossOutMode ? 'Disable cross-out mode' : 'Enable cross-out mode'}
                          title={crossOutMode ? 'Disable cross-out mode' : 'Enable cross-out mode'}
                        >
                          <Strikethrough className="h-7 w-7 stroke-[2.6] text-gray-500 dark:text-gray-400" />
                        </Button>
                      )}
                      
                      {/* Text Size Control */}
                      <div className="relative inline-block">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("text-gray-500 dark:text-gray-400 p-0 h-14 w-14", showTextSizeSlider && "text-primary")}
                          onClick={() => setShowTextSizeSlider(v => !v)}
                          aria-label="Adjust text size"
                          title="Adjust text size"
                        >
                          <Type className="h-7 w-7 stroke-[2.6] text-gray-500 dark:text-gray-400" />
                        </Button>
                        {showTextSizeSlider && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-card text-popover-foreground border border-border shadow-lg rounded-lg p-4 z-50 w-48 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                             <span className="text-xs font-medium text-muted-foreground">A</span>
                             <input
                               type="range"
                               min="1"
                               max="5"
                               step="1"
                               value={textSize}
                               onChange={(e) => handleTextSizeChange(Number(e.target.value))}
                               className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                             />
                             <span className="text-base font-bold text-foreground">A</span>
                          </div>
                        )}
                      </div>

                      <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 p-0 h-14 w-14" onClick={handleBookmark}>
                        <BookmarkIcon className={cn("h-7 w-7 stroke-[2.6]", isBookmarked ? "text-yellow-400 fill-current" : "text-gray-500 dark:text-gray-400")} />
                      </Button>
                      {currentQuestion && <ReportBugDialog
                        questionId={currentQuestion.id}
                        onReport={!isAnswered ? async () => {
                          try {
                            if (auth?.currentUser && currentQuestion?.skill) {
                              await adaptiveLearningService.markSkillAssessed(auth.currentUser.uid, currentQuestion.skill);
                            }
                          } catch {}
                          await handleNextQuestion();
                        } : undefined}
                        trigger={
                          <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 p-0 h-14 w-14">
                            <FlagIcon className="h-7 w-7 stroke-[2.6] text-gray-500 dark:text-gray-400" />
                          </Button>
                        }
                      />}
                    </div>
                  </div>
                  {currentQuestion?.skill && (
                    <span className="inline-flex md:hidden mt-0 text-base text-muted-foreground">
                      {currentQuestion.skill}
                    </span>
                  )}
                </div>
              </div>

              {/* Question Image - Centered above question */}
              {(() => {
                const questionImage = getQuestionImage(currentQuestion);
                return questionImage ? (
                  <div className="flex flex-col items-center px-6 mb-6">
                    <div className="w-full max-w-xs">
                      <QuestionImage 
                        image={questionImage} 
                        size="sm" 
                        priority={true}
                        aspectRatio="auto"
                        removeBlack={true}
                        className="w-full rounded-none"
                      />
                    </div>
                    {currentQuestion && (
                      <div className="mt-2 text-right w-full max-w-md">
                        <button
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={async () => {
                            try {
                              await submitBugReport({ description: 'Image is cropped', questionId: currentQuestion.id });
                              if (!isAnswered) {
                                try {
                                  if (auth?.currentUser && currentQuestion?.skill) {
                                    await adaptiveLearningService.markSkillAssessed(auth.currentUser.uid, currentQuestion.skill);
                                  }
                                } catch {}
                                await handleNextQuestion();
                              }
                            } catch (e) {
                              // ignore; submitBugReport already surfaces errors via toasts
                            }
                          }}
                        >
                          Report cropped image
                        </button>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Question Description - Centered */}
              {(() => {
                const hasOptions = Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0;
                return (
                  <div className={cn(
                    "flex items-center justify-center px-6",
                    hasOptions ? "flex-1 mb-8" : "flex-[0.6] -mb-2"
                  )}>
                    <TextAnnotator
                      key={`${currentQuestion.id}-q`}
                      className={cn(
                        "prose max-w-none w-full transition-all duration-200",
                        {
                          1: 'prose-base',
                          2: 'prose-lg',
                          3: 'prose-xl',
                          4: 'prose-2xl',
                          5: 'prose-2xl', // 2xl is largest standard prose, we can add custom class
                        }[textSize] || 'prose-lg'
                      )}
                      questionContext={currentQuestion.question}
                      passageContext={currentQuestion.passage || ''}
                      onHighlightsChange={(hs) => setQuestionHighlights(hs)}
                      disabled={isMathQuestion}
                    >
                      <div className={cn(
                        "leading-relaxed select-text [&_.text-center]:mb-10 transition-all duration-200",
                        {
                          1: 'text-base',
                          2: 'text-lg',
                          3: 'text-xl',
                          4: 'text-2xl',
                          5: 'text-3xl',
                        }[textSize] || 'text-lg'
                      )}>
                        <LatexRenderer onEquationClick={isMathQuestion ? handleGraphEquation : undefined}>{currentQuestion.question}</LatexRenderer>
                      </div>
                    </TextAnnotator>
                  </div>
                );
              })()}

              {/* Answer Section - Bottom */}
              <div className="px-6 pb-32">
                <div>
                  {/* Answer Section */}
                  {!userAnswer ? (
                    <div className="space-y-4">
                      {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 ? (
                        (() => {
                          const hasImageInOptions = currentQuestion.options.some(option => typeof option === 'object' && option.imageURL);
                          const hasTableInOptions = currentQuestion.options.some(option => {
                            const text = typeof option === 'string' ? option : (option?.text ?? '');
                            return typeof text === 'string' && text.toLowerCase().includes('<table');
                          });
                          return (
                            <>
                              <div className={cn(
                                "grid gap-4",
                                hasTableInOptions
                                  ? "grid-cols-2"
                                  : hasImageInOptions
                                    ? "grid-cols-1 md:grid-cols-2"
                                    : "grid-cols-1"
                              )}>
                                {currentQuestion.options.map((option, index) => {
                                  const optionText = typeof option === 'string' ? option : option.text || `Option ${String.fromCharCode(65 + index)}`;
                                  const imageURL = typeof option === 'object' && option.imageURL;
                                  const isSelected = selectedOption === index;

                                  return (
                                    <div key={index} className="flex items-stretch gap-2">
                                      {isMultipleChoice && crossOutMode && (
                                        <button
                                          type="button"
                                          className="inline-flex items-center justify-center h-full w-10 rounded-md border border-border text-gray-400 hover:bg-muted/50 flex-shrink-0"
                                          onClick={() => toggleCrossOutForIndex(index)}
                                          aria-label={crossedOutOptions.has(index) ? 'Uncross option' : 'Cross out option'}
                                          title={crossedOutOptions.has(index) ? 'Uncross option' : 'Cross out option'}
                                        >
                                          {crossedOutOptions.has(index) ? (
                                            <CircleSlash className="h-5 w-5 text-destructive" />
                                          ) : (
                                            <CircleSlash className="h-5 w-5" />
                                          )}
                                        </button>
                                      )}
                                      <motion.button
                                        whileHover={!isAnswered ? { scale: 1.01, backgroundColor: "rgba(var(--accent), 0.5)" } : {}}
                                        whileTap={!isAnswered ? { scale: 0.99 } : {}}
                                        onClick={() => handleMultipleChoiceAnswer(index)}
                                        disabled={isAnswered}
                                        className={cn(
                                          "w-full justify-start h-auto p-4 text-left whitespace-normal rounded-xl border-[2.5px] border-b-[5px] transition-all duration-200 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex-1",
                                          {
                                            1: 'text-sm',
                                            2: 'text-base',
                                            3: 'text-lg',
                                            4: 'text-xl',
                                            5: 'text-2xl',
                                          }[textSize] || 'text-base',
                                          isSelected 
                                            ? "border-primary bg-primary/10" 
                                            : "border-border bg-transparent hover:border-primary/50",
                                          (isAnswered || crossedOutOptions.has(index)) && "cursor-default opacity-80",
                                          crossedOutOptions.has(index) && "opacity-50 grayscale"
                                        )}
                                      >
                                        {/* Cross-out overlay line */}
                                        <div
                                          className={cn(
                                            "absolute left-3 right-3 top-1/2 h-[2px] bg-muted-foreground/60 pointer-events-none z-10",
                                            crossedOutOptions.has(index) ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex items-start space-x-3">
                                          <div className={cn(
                                            "flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-colors duration-200",
                                            isSelected 
                                              ? "border-primary bg-primary text-primary-foreground" 
                                              : "border-muted-foreground text-muted-foreground"
                                          )}>
                                            {String.fromCharCode(65 + index)}
                                          </div>
                                          <div className={cn(
                                            "flex-1 space-y-2 transition-colors duration-200",
                                            isSelected ? "text-foreground font-medium" : "text-foreground"
                                          )}>
                                            {optionText && <div><LatexRenderer onEquationClick={isMathQuestion ? handleGraphEquation : undefined}>{optionText}</LatexRenderer></div>}
                                            {imageURL && <OptionImage removeBlack={true} image={{ url: imageURL, alt: `Option ${String.fromCharCode(65 + index)} image` }} />}
                                          </div>
                                        </div>
                                      </motion.button>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()
                      ) : (
                        <div className="space-y-4 pt-4">
                          <Input
                            type="text"
                            value={textAnswer}
                            onChange={(e) => setTextAnswer(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                            placeholder="Type your answer here..."
                            className="text-lg p-4 h-12"
                          />
                        </div>
                      )}
                    </div>
                  ) : userAnswer ? (
                    // Answer Results - only render when userAnswer exists
                    <div className="space-y-6">
                      {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 ? (
                        // Multiple Choice Results (show only options with indicators/images)
                        <div className="space-y-4">
                          <div className="grid gap-3">
                            {currentQuestion.options.map((option, index) => {
                              const optionText = typeof option === 'string' ? option : option.text || `Option ${String.fromCharCode(65 + index)}`;
                              const correctAnswerIndex = typeof currentQuestion.answer === 'number' ? currentQuestion.answer : -1;
                              const imageURL = typeof option === 'object' && option?.imageURL ? option.imageURL : getOptionImageURL(currentQuestion as any, index);
                              
                              const getOptionIcon = (
                                idx: number,
                                ua: { answer: string | number; isCorrect: boolean } | undefined,
                                correctIdx: number
                              ) => {
                                if (!ua) return null as any;
                                if (idx === correctIdx) return <CheckCircleIcon className="h-4 w-4" />;
                                if (idx === Number(ua.answer) && !ua?.isCorrect) return <XCircleIcon className="h-4 w-4" />;
                                return null as any;
                              };

                              return (
                                <motion.div
                                  key={index}
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  className={cn(
                                    "w-full justify-start h-auto p-4 text-left whitespace-normal rounded-xl border-[2.5px] border-b-[5px] transition-all relative overflow-hidden",
                                    index === correctAnswerIndex
                                      ? "bg-[#93d333]/10 dark:bg-[#93d333]/20 border-[#93d333]"
                                      : index === Number(userAnswer?.answer) && !userAnswer?.isCorrect
                                        ? "bg-destructive/10 border-destructive"
                                        : "bg-transparent border-border opacity-50"
                                  )}
                                >
                                  <div className="flex items-start gap-3 w-full">
                                    <div className={cn(
                                      "w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold",
                                      index === correctAnswerIndex
                                        ? "border-[#93d333] bg-[#93d333]/10 dark:bg-[#93d333]/20 text-[#93d333] dark:text-[#93d333]"
                                        : index === Number(userAnswer?.answer) && !userAnswer?.isCorrect
                                          ? "border-destructive bg-destructive/10 text-destructive"
                                          : "border-muted-foreground text-muted-foreground"
                                    )}>
                                      {String.fromCharCode(65 + index)}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                      {optionText && (
                                        <div className={cn(
                                          "block",
                                          index === correctAnswerIndex ? "text-foreground font-medium" : "text-foreground"
                                        )}>
                                          <LatexRenderer>{optionText}</LatexRenderer>
                                        </div>
                                      )}
                                      {imageURL && (
                                        <OptionImage removeBlack={true} image={{ url: imageURL, alt: `Option ${String.fromCharCode(65 + index)} image` }} />
                                      )}
                                    </div>
                                    {getOptionIcon(index, userAnswer, correctAnswerIndex)}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        // Text Input Results
                        <div className="space-y-3 pt-4">
                          <div className={cn(
                            "p-4 rounded-lg border-2",
                            userAnswer?.isCorrect 
                              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
                              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                          )}>
                            <div className="flex items-center gap-2 mb-2">
                              {userAnswer?.isCorrect ? (
                                <CheckCircleIcon className="h-5 w-5 text-[#93d333] dark:text-[#93d333]" />
                              ) : (
                                <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                              <span className="font-semibold">
                                {userAnswer?.isCorrect ? 'Correct!' : 'Incorrect'}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <p><strong>Your answer:</strong> <LatexRenderer>{String(userAnswer?.answer)}</LatexRenderer></p>
                              <p><strong>Correct answer:</strong> <LatexRenderer>{Array.isArray(currentQuestion.answer) ? currentQuestion.answer.join(' or ') : String(currentQuestion.answer)}</LatexRenderer></p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Explanation moved to fixed bottom-right panel */}

                      {/* Navigation */}
                      <div className="space-y-3">
                        {/* Loading Progress Bar */}
                        {loadingNextQuestion && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>Loading next question...</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '100%' }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : isAnswered ? (
                    // Loading state while waiting for answer to be processed
                    <div className="space-y-6">
                      <div className="flex items-center justify-center p-8">
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span>Processing your answer...</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Question Graph Column (if exists) */}
          {(() => {
            const questionGraph = getQuestionGraph(currentQuestion);
            const hasPassage = currentQuestion.passage && currentQuestion.passage.trim() !== '';
            
            if (questionGraph) {
              return (
                <div className={cn(
                  hasPassage ? "lg:col-span-4" : "lg:col-span-5"
                )}>
                  <Card className="h-fit sticky top-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        Question Graph
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Graph {...questionGraph} />
                    </CardContent>
                  </Card>
                </div>
              );
            }

            return null;
          })()}

          {/* Passage & Context Column */}
          {(() => {
            const hasPassage = currentQuestion.passage && currentQuestion.passage.trim() !== '';
                              // Note: contextNotes are no longer used in the new question format
                  const relevantNote = null;

            if (!hasPassage && !relevantNote) {
              return null;
            }

            return (
              <div className={cn(
                // On mobile show passage first (full width); on desktop keep side column
                "order-first md:order-none",
                "lg:col-span-5"
              )}>
                <Card className="h-fit sticky top-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpenIcon className="h-5 w-5" />
                      {hasPassage ? 'Reading Passage' : 'Context'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {showRWAnnotatorTip && !isMathQuestion && (
                      <div className="mb-3 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm">
                        Tip: Select phrases in the passage or question to get context or write notes.
                      </div>
                    )}
                    <div className={cn(
                      "prose max-w-none max-h-96 overflow-y-auto pr-2 transition-all duration-200",
                      {
                        1: 'prose-base text-base',
                        2: 'prose-lg text-lg',
                        3: 'prose-xl text-xl',
                        4: 'prose-2xl text-2xl',
                        5: 'prose-2xl text-3xl',
                      }[textSize] || 'prose-lg text-lg'
                    )}>
                      {hasPassage && (
                        <TextAnnotator
                          key={`${currentQuestion.id}-p`}
                          className="whitespace-pre-wrap leading-relaxed"
                          questionContext={currentQuestion.question}
                          passageContext={currentQuestion.passage || ''}
                          onHighlightsChange={(hs) => setPassageHighlights(hs)}
                          disabled={isMathQuestion}
                        >
                          <div>
                            <LatexRenderer>{currentQuestion.passage!}</LatexRenderer>
                          </div>
                        </TextAnnotator>
                      )}
                      
                      {/* Context notes are no longer used in the new question format */}
                    </div>
                    {hasPassage && currentQuestion && (
                      <div className="mt-2 text-right">
                        <button
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={async () => {
                            try {
                              await submitBugReport({ description: 'Passage has an issue', questionId: currentQuestion.id });
                              if (!isAnswered) {
                                try {
                                  if (auth?.currentUser && currentQuestion?.skill) {
                                    await adaptiveLearningService.markSkillAssessed(auth.currentUser.uid, currentQuestion.skill);
                                  }
                                } catch {}
                                await handleNextQuestion();
                              }
                            } catch (e) {
                              // ignore; submitBugReport already surfaces errors via toasts
                            }
                          }}
                        >
                          Report passage issue
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </div>
      </div>

      {/* (Removed) Global floating Tutor reminder; now anchored near Tutor buttons */}


      {/* Floating Procedure Score pill (bottom-right) - only when /procedure tab is open */}
      {isProcedureOpen && (
        <div className="fixed bottom-4 right-4 z-40 max-w-[60vw]">
          <div className="px-3 py-2 rounded-full shadow-lg border border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Procedure</span>
              <div className="w-[220px] sm:w-[260px]">
                <ProcedureScore score={procedureScore} compact />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{typeof procedureScore==='number' ? `${procedureScore}/5` : '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Components - Render only on the client */}
      {/* Onboarding modals removed for tutor */}

      {/* Floating Explanation Panel (left, above tutor button) - Hide if Tutor Sidebar is open */}
      {userAnswer && currentQuestion.explanation && showExplanationPanel && !isTutorOpen && (() => {
        const hasPassage = !!(currentQuestion.passage && currentQuestion.passage.trim() !== '');
        const compact = !hasPassage; // When no passage (question image is now in question column)
        const widthClass = compact ? 'w-[22.4rem]' : 'w-[32rem]'; // 30% thinner when compact
        const maxHClass = compact ? 'max-h-[60vh]' : 'max-h-[28vh]'; // taller when compact per request
        return (
          <div className={cn('fixed left-4 bottom-[180px] md:bottom-[200px] z-40 max-w-[96vw]', widthClass)}>
            <div className={cn('p-4 bg-white dark:bg-card border-2 border-border border-b-4 rounded-2xl overflow-y-auto', maxHClass)}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <BookOpenIcon className="h-4 w-4" />
                  Explanation
                </h3>
                <button
                  type="button"
                  aria-label="Close explanation"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowExplanationPanel(false)}
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="text-foreground prose prose-sm max-w-none">
                <LatexRenderer>{currentQuestion.explanation}</LatexRenderer>
              </div>
            </div>
          </div>
        );
      })()}


      {/* Procedure QR Code - always visible at bottom right */}
      {!isProcedureOpen && state.session?.subject !== 'Reading & Writing' && <ProcedureQR isCalculatorOpen={isCalculatorOpen} isMinimized={isCanvasMinimized} onMinimizedChange={setIsCanvasMinimized} />}

      {/* Fixed bottom submit section */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border z-0">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            {/* Left: Empty now */}
            <div></div>

            {/* Center: Session progress dots */}
            {state.session && (
              <div className="flex items-center justify-center gap-3">
                {state.session.questions.map((q, idx) => {
                  const ua = state.session!.userAnswers[q.id];
                  const isCorrect = !!ua?.isCorrect;
                  const isCurrent = idx === state.session!.currentQuestionIndex;
                  return (
                    <span key={q.id} className={cn("inline-flex items-center justify-center", !isCurrent && "opacity-80") }>
                      {ua ? (
                        isCorrect ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className="block h-3 w-3 rounded-full bg-gray-400" />
                        )
                      ) : (
                        <span className="block h-3 w-3 rounded-full bg-gray-300" />
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Right: Submit button or Next Question button */}
            {!userAnswer && currentQuestion && (
              <div>
                {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 ? (
                  <Button 
                    onClick={() => {
                      if (selectedOption === null || !currentQuestion || isSubmitting) return;
                      const isCorrect = selectedOption === currentQuestion.answer;
                      handleAnswerSubmission(isCorrect, selectedOption);
                    }} 
                    disabled={selectedOption === null || isAnswered || isSubmitting || !isClient}
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit'
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleTextSubmit}
                    disabled={textAnswer.trim() === '' || isSubmitting || !isClient}
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit'
                    )}
                  </Button>
                )}
              </div>
            )}
            {userAnswer && currentQuestion && (
              <div>
                {loadingNextQuestion ? (
                  <Button disabled size="lg">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading next question...
                  </Button>
                ) : (
                  <Button onClick={handleNextQuestion} size="lg">
                    Next Question <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
        {isMathQuestion && (
          <CalculatorSidebar 
            ref={calculatorSidebarRef}
            className="hidden md:flex shrink-0 h-full" 
            onOpenChange={setIsCalculatorOpen}
            isCanvasMinimized={isCanvasMinimized}
          />
        )}
      </div>
    </MainLayout>
  );
}

/**
 * A simple wrapper component to ensure PracticeSession is rendered on the client side.
 * This is the default export for the practice page route.
 */
export default function PracticePage() {
  return <PracticeSession />;
}
