"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { motion } from "framer-motion";
import {
  MainLayout,
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Loading,
  Progress,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components';
import { cn } from '@/lib/utils';
import { LatexRenderer } from '@/components/ui/latex';
import { TextAnnotator } from '@/components/ui/text-annotator';
import { QuestionImage, OptionImage } from '@/components/ui/question-image';
import { getQuestionImage, getQuestionGraph, getOptionImageURL } from '@/lib/utils/questionHelpers';
import type { Question } from '@/lib/types/practice';
import { CheckCircleIcon, XCircleIcon, ArrowRightIcon, Clock, BookOpenIcon, ImageIcon, Calculator as CalculatorIcon, Bot, XIcon, HomeIcon } from 'lucide-react';
import { fetchQuestions } from '@/lib/context/PracticeSessionContext';
import Graph from '@/components/ui/graph';
import { ClientOnlyCompactVoiceConversation } from '@/components/voice/ClientOnlyVoiceComponents';
import { checkOpenEndedAnswer } from '@/lib/utils/answer-checking';
import confetti from 'canvas-confetti';

function pickRandomIndex(exclude: Set<number>, total: number): number | null {
  const candidates: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!exclude.has(i)) candidates.push(i);
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

export default function HomePage() {
  const router = useRouter();

  // Auth resolution to avoid content flash for authenticated users
  const [isAuthResolved, setIsAuthResolved] = useState<boolean>(false);
  useEffect(() => {
    if (!auth) {
      const t = setTimeout(() => setIsAuthResolved(true), 600);
      return () => clearTimeout(t);
    }
    const unsub = onAuthStateChanged(auth as any, (user) => {
      if (user) {
        router.replace('/dashboard');
      } else {
        setIsAuthResolved(true);
      }
    });
    return () => unsub();
  }, [router]);

  // Questions state (read-only)
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const qs = await fetchQuestions();
        if (!mounted) return;
        setQuestions(qs);
      } catch (e) {
        if (!mounted) return;
        setLoadError('Failed to load questions.');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Local demo state
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [userAnswersMap, setUserAnswersMap] = useState<Record<string, { answer: number | string; isCorrect: boolean }>>({});
  const [showExplanationPanel, setShowExplanationPanel] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingNextQuestion, setLoadingNextQuestion] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Timer (10-minute demo session)
  const DEMO_DURATION_MIN = 10;
  const [timeRemaining, setTimeRemaining] = useState<number>(DEMO_DURATION_MIN * 60);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return;
    const t = setInterval(() => setTimeRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [timerActive, timeRemaining]);

  // AI Tutor state
  const [showTutorChat, setShowTutorChat] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const tutorName = 'AI Tutor';
  const tutorVoice = 'Kore';
  // Reset key to restart Gemini Live session on important events
  const [tutorResetKey, setTutorResetKey] = useState<string>('init');

  // In-text highlighting state for tutor context
  const [questionHighlights, setQuestionHighlights] = useState<string[]>([]);
  const [passageHighlights, setPassageHighlights] = useState<string[]>([]);
  const highlightsCsv = useMemo(() => {
    return [...new Set([...(questionHighlights || []), ...(passageHighlights || [])])]
      .filter(Boolean)
      .join(', ');
  }, [questionHighlights, passageHighlights]);

  // Calculator state/refs
  const [showCalculator, setShowCalculator] = useState(false);
  const desmosContainerRef = useRef<HTMLDivElement | null>(null);
  const desmosInstanceRef = useRef<any>(null);
  const [calculatorWidth, setCalculatorWidth] = useState<number>(350);
  const [calculatorHeight, setCalculatorHeight] = useState<number>(600);
  const resizingTopRef = useRef<boolean>(false);
  const resizingRightRef = useRef<boolean>(false);
  const resizingCornerRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const getMaxWidth = () => (typeof window !== 'undefined' ? Math.max(320, window.innerWidth - 120) : 800);
  const getMaxHeight = () => (typeof window !== 'undefined' ? Math.max(240, window.innerHeight - 160) : 600);
  const ensureDesmosLoaded = async () => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.Desmos) return;
    await new Promise<void>((resolve) => {
      const apiKey = process.env.NEXT_PUBLIC_DESMOS_API_KEY;
      const script = document.createElement('script');
      script.src = `https://www.desmos.com/api/v1.11/calculator.js${apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : ''}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  };
  useEffect(() => {
    let destroyed = false;
    (async () => {
      const d = Number(questions?.[currentIndex ?? -1]?.domain);
      const isMath = !Number.isNaN(d) && d <= 3;
      if (showCalculator && isMath) {
        try {
          await ensureDesmosLoaded();
          if (!desmosContainerRef.current) return;
          const w = window as any;
          if (desmosInstanceRef.current && desmosInstanceRef.current.destroy) {
            desmosInstanceRef.current.destroy();
            desmosInstanceRef.current = null;
          }
          if (w.Desmos) {
            desmosInstanceRef.current = w.Desmos.GraphingCalculator(desmosContainerRef.current, {
              expressions: true,
              keypad: true,
              settingsMenu: true,
              zoomButtons: true,
              border: true,
            });
          }
        } catch {}
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
  }, [showCalculator, currentIndex, questions]);
  useEffect(() => {
    if (desmosInstanceRef.current && showCalculator) {
      try { desmosInstanceRef.current.resize(); } catch {}
    }
  }, [calculatorWidth, calculatorHeight, showCalculator]);
  const onTopResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingTopRef.current = true;
    dragStartYRef.current = e.clientY;
    startHeightRef.current = calculatorHeight;
    const onMove = (ev: MouseEvent) => {
      if (!resizingTopRef.current) return;
      const deltaY = dragStartYRef.current - ev.clientY;
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
      const deltaX = ev.clientX - dragStartXRef.current;
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
      const deltaX = ev.clientX - dragStartXRef.current;
      const deltaY = dragStartYRef.current - ev.clientY;
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

  useEffect(() => {
    if (!questions || questions.length === 0) return;
    if (currentIndex === null) {
      const idx = pickRandomIndex(new Set(), questions.length);
      setCurrentIndex(idx);
      if (idx !== null) setUsedIndices(new Set([idx]));
      setTimerActive(true);
    }
  }, [questions, currentIndex]);

  // Derived question and answer state
  const currentQuestion: Question | null =
    currentIndex !== null && questions ? questions[currentIndex] : null;
  const currentQuestionId = currentQuestion?.id ?? '';
  const userAnswer = currentQuestionId ? userAnswersMap[currentQuestionId] : undefined;
  const isMathQuestion = (() => {
    if (!currentQuestion) return false;
    const domain = Number((currentQuestion as any).domain);
    return !Number.isNaN(domain) && domain <= 3;
  })();

  // Tutor visibility for avoiding overlap with calculator
  const isTutorVisible = showTutorChat;

  // Ensure tutor is always on in the demo when a question is present
  useEffect(() => {
    if (currentQuestionId) {
      setShowTutorChat(true);
    }
  }, [currentQuestionId]);

  // Tips: first tutor tip and wrong answer tip (session-only, no persistence)
  const [showFirstTutorTip, setShowFirstTutorTip] = useState(false);
  const [showWrongAnswerTutorTip, setShowWrongAnswerTutorTip] = useState(false);
  const hasShownFirstTutorTipThisSessionRef = useRef(false);
  const hasShownWrongTipThisSessionRef = useRef(false);

  // Calculator tip (session-only)
  const [showCalculatorTip, setShowCalculatorTip] = useState(false);
  const hasShownCalculatorTipThisSessionRef = useRef(false);
  const lastTipQuestionIndexRef = useRef<number | null>(null);

  // R&W annotator tip (session-only)
  const [showRWAnnotatorTip, setShowRWAnnotatorTip] = useState(false);
  const hasShownRWTipThisSessionRef = useRef(false);
  const lastRWTipQuestionIndexRef = useRef<number | null>(null);

  // First tutor tip on first question of the session
  useEffect(() => {
    const isFirstQuestion = (usedIndices.size <= 1) && currentIndex !== null;
    if (isFirstQuestion && !hasShownFirstTutorTipThisSessionRef.current) {
      setShowFirstTutorTip(true);
      hasShownFirstTutorTipThisSessionRef.current = true;
    }
    if (!isFirstQuestion && hasShownFirstTutorTipThisSessionRef.current) {
      setShowFirstTutorTip(false);
    }
  }, [currentIndex, usedIndices.size]);

  // Wrong answer tip once after first wrong answer
  useEffect(() => {
    if (!userAnswer || userAnswer.isCorrect !== false) return;
    if (hasShownWrongTipThisSessionRef.current) return;
    setShowFirstTutorTip(false);
    setShowWrongAnswerTutorTip(true);
    hasShownWrongTipThisSessionRef.current = true;
  }, [userAnswer]);

  // Calculator tip on first math question encountered
  useEffect(() => {
    if (isMathQuestion && !hasShownCalculatorTipThisSessionRef.current && currentIndex !== null) {
      setShowCalculatorTip(true);
      hasShownCalculatorTipThisSessionRef.current = true;
      lastTipQuestionIndexRef.current = currentIndex;
    }
  }, [isMathQuestion, currentIndex]);
  useEffect(() => {
    if (currentIndex === null) return;
    if (
      hasShownCalculatorTipThisSessionRef.current &&
      lastTipQuestionIndexRef.current !== null &&
      currentIndex !== lastTipQuestionIndexRef.current
    ) {
      setShowCalculatorTip(false);
    }
  }, [currentIndex]);

  // R&W annotator tip on first non-math question encountered
  useEffect(() => {
    const isRW = !isMathQuestion;
    if (isRW && !hasShownRWTipThisSessionRef.current && currentIndex !== null) {
      setShowRWAnnotatorTip(true);
      hasShownRWTipThisSessionRef.current = true;
      lastRWTipQuestionIndexRef.current = currentIndex;
    }
  }, [isMathQuestion, currentIndex]);
  useEffect(() => {
    if (currentIndex === null) return;
    if (
      hasShownRWTipThisSessionRef.current &&
      lastRWTipQuestionIndexRef.current !== null &&
      currentIndex !== lastRWTipQuestionIndexRef.current
    ) {
      setShowRWAnnotatorTip(false);
    }
  }, [currentIndex]);

  const handleSubmit = async () => {
    if (!currentQuestion || timeRemaining <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
    if (Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0) {
      if (selectedOption === null) return;
      const correctIndex = typeof currentQuestion.answer === 'number' ? currentQuestion.answer : -1;
        const isCorrect = selectedOption === correctIndex;
        setUserAnswersMap((prev) => ({ ...prev, [currentQuestion.id]: { answer: selectedOption, isCorrect } }));
        if (isCorrect) {
          try {
            if (typeof window !== 'undefined' && confetti) {
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }
          } catch {}
        }
      setShowExplanationPanel(true);
    } else {
      if (textAnswer.trim() === '') return;
      const isCorrect = checkOpenEndedAnswer(textAnswer.trim(), currentQuestion.answer);
        setUserAnswersMap((prev) => ({ ...prev, [currentQuestion.id]: { answer: textAnswer.trim(), isCorrect } }));
        if (isCorrect) {
          try {
            if (typeof window !== 'undefined' && confetti) {
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }
          } catch {}
        }
      setShowExplanationPanel(true);
        setTextAnswer('');
      }
    } finally {
      setIsSubmitting(false);
    }
    // Reset tutor session after answer submission
    setTutorResetKey(`answered-${currentQuestion.id}-${Date.now()}`);
  };

  const handleNext = () => {
    if (!questions) return;
    const next = pickRandomIndex(usedIndices, questions.length);
    if (next === null) {
      const idx = pickRandomIndex(new Set(), questions.length);
      setUsedIndices(new Set(idx !== null ? [idx] : []));
      setCurrentIndex(idx);
    } else {
      const nextUsed = new Set(usedIndices);
      nextUsed.add(next);
      setUsedIndices(nextUsed);
      setCurrentIndex(next);
    }
    setSelectedOption(null);
    setShowExplanationPanel(false);
    setTextAnswer('');
    // Reset tutor session for the next question
    setTutorResetKey(`next-${Date.now()}`);
  };

  // Preparing overlay for auth resolution
  if (!isAuthResolved) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Preparing your experience…</div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {(() => {
          const answeredCount = Object.keys(userAnswersMap).length;
          return (
        <PageHeader
              title="CultivatED demo"
              description={`We are the fastest way you will reach 1600 points. We got 3000+ official practice questions, your own AI tutor, and it's completely free.`}
            >
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="border border-border">beta</Badge>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Badge
                    variant={timeRemaining <= 60 ? 'destructive' : timeRemaining <= 300 ? 'secondary' : 'outline'}
                    className={cn('font-mono', timeRemaining <= 10 && 'animate-pulse')}
                  >
                    {(() => {
                      const m = Math.floor(timeRemaining / 60);
                      const s = timeRemaining % 60;
                      return `${m}:${String(s).padStart(2, '0')}`;
                    })()}
                  </Badge>
                </div>
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
                        Are you sure you want to exit this session? Your progress is not saved in the demo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Continue Practicing</AlertDialogCancel>
                      <AlertDialogAction onClick={() => { setShowExitConfirm(false); setShowResults(true); }}>Exit Session</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            <Button size="sm" className="gap-2" onClick={() => router.push('/signup')}>
              Join CultivatED
            </Button>
          </div>
        </PageHeader>
          );
        })()}

        {loadError && (
          <div className="text-sm text-red-600">{loadError}</div>
        )}

        {!questions || currentQuestion == null ? (
          <div className="flex items-center justify-center min-h-[300px]"><Loading size="lg" text="Loading question..." /></div>
        ) : showResults ? (
          (() => {
            const answeredQuestions = Object.keys(userAnswersMap).length;
            const correctAnswers = Object.values(userAnswersMap).filter(a => a.isCorrect).length;
            const percentage = answeredQuestions > 0 ? (correctAnswers / answeredQuestions) * 100 : 0;
            return (
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="text-3xl font-bold">Session Complete!</h1>
                  <p className="text-muted-foreground text-lg">Great job! Here&apos;s how you performed.</p>
                </div>
                <div className="flex flex-row flex-nowrap gap-4 overflow-x-auto -mx-2 px-2 pb-1">
                  <Card className="min-w-[180px] flex-1">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Questions Answered</p>
                        <p className="text-xl font-bold text-primary">{answeredQuestions}</p>
                      </div>
                      <ArrowRightIcon className="h-6 w-6 text-primary" />
                    </CardContent>
                  </Card>
                  <Card className="min-w-[180px] flex-1">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Correct</p>
                        <p className="text-xl font-bold text-[#93d333]">{correctAnswers}</p>
                      </div>
                      <CheckCircleIcon className="h-6 w-6 text-[#93d333]" />
                    </CardContent>
                  </Card>
                  <Card className="min-w-[180px] flex-1">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Incorrect</p>
                        <p className="text-xl font-bold text-red-600">{answeredQuestions - correctAnswers}</p>
                      </div>
                      <XCircleIcon className="h-6 w-6 text-red-600" />
                    </CardContent>
                  </Card>
                  <Card className="min-w-[180px] flex-1">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Accuracy</p>
                        <p className="text-xl font-bold">{Math.round(percentage)}%</p>
                      </div>
                      <HomeIcon className="h-6 w-6 text-primary" />
                    </CardContent>
                  </Card>
                </div>
                <div className="flex gap-4">
                  <Button onClick={() => router.replace('/signup')} className="flex-1 gap-2" size="lg">Join CultivatED</Button>
                  <Button onClick={() => {
                    setUserAnswersMap({});
                    setUsedIndices(new Set());
                    setCurrentIndex(null);
                    setSelectedOption(null);
                    setShowExplanationPanel(false);
                    setShowResults(false);
                    setTimeRemaining(DEMO_DURATION_MIN * 60);
                    setTimerActive(true);
                  }} variant="outline" className="flex-1 gap-2" size="lg">Practice Again</Button>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className={cn(
              'space-y-6',
              (() => {
                const hasPassage = currentQuestion.passage && currentQuestion.passage.trim() !== '';
                const hasQuestionImage = getQuestionImage(currentQuestion);
                if (hasPassage && hasQuestionImage) return 'lg:col-span-4';
                if (hasPassage || hasQuestionImage) return 'lg:col-span-7';
                return 'lg:col-span-12';
              })()
            )}>
              <Card className="w-full max-w-4xl mx-auto animate-fade-in">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-baseline gap-3">
                    <CardTitle>Question {Object.keys(userAnswersMap).length + 1}</CardTitle>
                    {currentQuestion.skill && (
                      <span className="text-base text-muted-foreground leading-none">{currentQuestion.skill}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <TextAnnotator
                      key={`${currentQuestion.id}-q`}
                      className="prose prose-lg max-w-none"
                      questionContext={currentQuestion.question}
                      passageContext={currentQuestion.passage || ''}
                      onHighlightsChange={(hs) => setQuestionHighlights(hs)}
                    >
                      <div className="text-lg leading-relaxed select-text">
                        <LatexRenderer>{currentQuestion.question}</LatexRenderer>
                      </div>
                    </TextAnnotator>

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
                                  'grid gap-4',
                                  hasTableInOptions
                                    ? 'grid-cols-2'
                                    : hasImageInOptions
                                      ? 'grid-cols-1 md:grid-cols-2'
                                      : 'grid-cols-1'
                                )}>
                          {currentQuestion.options.map((option, index) => {
                            const optionText = typeof option === 'string' ? option : option.text || `Option ${String.fromCharCode(65 + index)}`;
                            const imageURL = typeof option === 'object' && option.imageURL;
                            const isSelected = selectedOption === index;

                            return (
                              <motion.button
                                key={index}
                                whileHover={!userAnswer ? { scale: 1.01, backgroundColor: "rgba(var(--accent), 0.5)" } : {}}
                                whileTap={!userAnswer ? { scale: 0.99 } : {}}
                                onClick={() => setSelectedOption(index)}
                                disabled={!!userAnswer}
                                className={cn(
                                  "w-full justify-start h-auto p-4 text-left whitespace-normal rounded-xl border-2 transition-all duration-200 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                  isSelected 
                                    ? "border-primary bg-primary/10 shadow-md" 
                                    : "border-border bg-transparent shadow-sm hover:border-primary/50",
                                  !!userAnswer && "cursor-default opacity-80"
                                )}
                              >
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
                                    isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                                  )}>
                                    {optionText && <div><LatexRenderer>{optionText}</LatexRenderer></div>}
                                    {imageURL && <OptionImage image={{ url: imageURL, alt: `Option ${String.fromCharCode(65 + index)} image` }} />}
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                                <div className="mt-6 flex justify-end items-center">
                                  <div className="flex gap-2">
                                    <Button onClick={handleSubmit} disabled={selectedOption === null || !!userAnswer || isSubmitting}>
                                      {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                                    </Button>
                                    <Button variant="outline" onClick={() => setSelectedOption(null)} disabled={selectedOption === null}>
                                      Clear Selection
                            </Button>
                          </div>
                                </div>
                              </>
                            );
                          })()
                    ) : (
                      <div className="space-y-4">
                            <Input
                              type="text"
                              value={textAnswer}
                              onChange={(e) => setTextAnswer(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                              placeholder="Type your answer here..."
                              className="text-lg p-4 h-12"
                            />
                            <Button onClick={handleSubmit} disabled={textAnswer.trim() === '' || isSubmitting} className="w-full" size="lg">
                              {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : userAnswer ? (
                      <div className="space-y-6">
                        {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 ? (
                          <div className="space-y-4">
                            <div className="grid gap-3">
                              {currentQuestion.options.map((option, index) => {
                                const optionText = typeof option === 'string' ? option : option.text || `Option ${String.fromCharCode(65 + index)}`;
                                const correctAnswerIndex = typeof currentQuestion.answer === 'number' ? currentQuestion.answer : -1;
                                const imageURL = typeof option === 'object' && option?.imageURL ? option.imageURL : getOptionImageURL(currentQuestion as any, index);
                                const getOptionVariant = (
                                  idx: number,
                                  ua: { answer: string | number; isCorrect: boolean } | undefined,
                                  correctIdx: number
                                ) => {
                                  if (!ua) return 'outline';
                                  if (idx === correctIdx) return 'default';
                                  if (idx === Number(ua.answer) && !ua?.isCorrect) return 'destructive';
                                  return 'outline';
                                };
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
                                    "w-full justify-start h-auto p-4 text-left whitespace-normal rounded-xl border-2 transition-all relative overflow-hidden",
                                    index === correctAnswerIndex
                                      ? "bg-[#93d333]/10 dark:bg-[#93d333]/20 border-[#93d333] shadow-md"
                                      : index === Number(userAnswer?.answer) && !userAnswer?.isCorrect
                                        ? "bg-destructive/10 border-destructive shadow-sm"
                                        : "bg-transparent border-border opacity-50 shadow-sm"
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
                                            index === correctAnswerIndex ? "text-foreground font-medium" : "text-muted-foreground"
                                          )}>
                                            <LatexRenderer>{optionText}</LatexRenderer>
                                          </div>
                                        )}
                                        {imageURL && (
                                          <OptionImage image={{ url: imageURL, alt: `Option ${String.fromCharCode(65 + index)} image` }} />
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
                          <div className="space-y-3">
                          <div className={cn(
                            'p-4 rounded-lg border-2',
                              userAnswer?.isCorrect 
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
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

                        {/* Navigation */}
                        <div className="space-y-3">
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
                          <div className="flex justify-end items-center">
                            <Button onClick={handleNext}>
                              Next Question <ArrowRightIcon className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            {(() => {
              const questionImage = currentQuestion ? getQuestionImage(currentQuestion) : null;
              const hasPassage = !!(currentQuestion?.passage && currentQuestion.passage.trim() !== '');
              return questionImage ? (
                <div className={cn(hasPassage ? 'lg:col-span-4' : 'lg:col-span-5')}>
                  <Card className="h-fit sticky top-6">
                    <CardHeader>
                      <CardTitle>Question Image</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <QuestionImage image={questionImage} size="xl" priority aspectRatio="auto" className="w-full rounded-none" />
                    </CardContent>
                  </Card>
                </div>
              ) : null;
            })()}

            {(() => {
              const questionGraph = currentQuestion ? getQuestionGraph(currentQuestion) : null;
              const hasPassage = !!(currentQuestion?.passage && currentQuestion.passage.trim() !== '');
              return questionGraph ? (
                <div className={cn(hasPassage ? 'lg:col-span-4' : 'lg:col-span-5')}>
                  <Card className="h-fit sticky top-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Question Graph</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Graph {...questionGraph} />
                    </CardContent>
                  </Card>
                </div>
              ) : null;
            })()}

            {(() => {
              const hasPassage = !!(currentQuestion?.passage && currentQuestion.passage.trim() !== '');
              if (!hasPassage) return null;
              return (
                <div className={cn('lg:col-span-4')}>
                  <Card className="h-fit sticky top-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><BookOpenIcon className="h-5 w-5" /> Reading Passage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none max-h-96 overflow-y-auto pr-2">
                        <TextAnnotator
                          key={`${currentQuestion.id}-p`}
                          className="whitespace-pre-wrap leading-relaxed"
                          questionContext={currentQuestion.question}
                          passageContext={currentQuestion.passage || ''}
                          onHighlightsChange={(hs) => setPassageHighlights(hs)}
                        >
                          <div>
                            <LatexRenderer>{currentQuestion.passage!}</LatexRenderer>
                          </div>
                        </TextAnnotator>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
          </div>
        )}

        {/* Floating Explanation Panel (dynamic sizing to match practice) */}
        {userAnswer && currentQuestion?.explanation && showExplanationPanel && (() => {
          const hasPassage = !!(currentQuestion.passage && currentQuestion.passage.trim() !== '');
          const hasQuestionImage = !!getQuestionImage(currentQuestion);
          const compact = !hasPassage && !hasQuestionImage;
          const widthClass = compact ? 'w-[22.4rem]' : 'w-[32rem]';
          const maxHClass = compact ? 'max-h-[60vh]' : 'max-h-[28vh]';
          return (
            <div className={cn('fixed bottom-4 right-4 z-40 max-w-[96vw]', widthClass)}>
              <div className={cn('p-4 bg-white dark:bg-card border-2 border-border border-b-4 rounded-2xl overflow-y-auto', maxHClass)}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                    Explanation
                </h3>
                <button type="button" aria-label="Close explanation" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowExplanationPanel(false)}>
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

        {/* Floating Calculator Toggle and AI Tutor (bottom-left) with tips */}
        {currentQuestion && (
          <div className={cn('fixed left-6 z-40 flex items-end gap-3', isTutorVisible ? 'bottom-24' : 'bottom-4')}>
            {isMathQuestion && (
                <div
                  className="bg-background border rounded-lg shadow-xl p-2 relative"
                  style={{ display: showCalculator ? 'block' : 'none', width: `${calculatorWidth}px`, height: `${calculatorHeight}px` }}
                >
                  <div onMouseDown={onTopResizeMouseDown} className="absolute top-0 left-0 right-0 h-3 z-20 rounded-t-lg" style={{ cursor: 'ns-resize' }} />
                  <div onMouseDown={onRightResizeMouseDown} className="absolute top-0 right-0 bottom-0 w-3 z-20 rounded-r-lg" style={{ cursor: 'ew-resize' }} />
                  <div onMouseDown={onCornerResizeMouseDown} className="absolute right-0 top-0 w-4 h-4 z-30" style={{ cursor: 'nesw-resize' }} />
                  <div ref={desmosContainerRef} id="desmos-calculator" className="w-full h-full rounded" />
                </div>
              )}
            {isMathQuestion && (
              <div className="relative overflow-visible">
                {showCalculatorTip && (
                  <img src="/calculator-tip.png" alt="Calculator tip" className="absolute bottom-20 left-0 w-[323px] md:w-[363px] max-w-[90vw] h-auto select-none pointer-events-none z-50" />
                )}
                <Button type="button" variant={showCalculator ? 'default' : 'outline'} className="rounded-full h-12 w-12 p-0 shadow-md" onClick={() => setShowCalculator((v) => !v)} aria-label={showCalculator ? 'Hide calculator' : 'Show calculator'}>
                  <CalculatorIcon className="h-6 w-6" />
                </Button>
                {showCalculatorTip && (
                  <img src="/arrow.png" alt="Arrow" className="absolute top-1/2 left-full -translate-y-1/2 -mt-6 ml-16 w-16 md:w-20 max-w-none h-auto select-none pointer-events-none z-50" />
                )}
              </div>
              )}
            <div className="relative">
              {!showTutorChat && (
                <Button type="button" variant="outline" className="rounded-full h-12 w-12 p-0 shadow-md" onClick={() => setShowTutorChat(true)} aria-label={tutorName}>
                  <Bot className="h-6 w-6" />
                </Button>
              )}
              {(showFirstTutorTip || showWrongAnswerTutorTip) && !showTutorChat && (
                <div className="absolute left-full ml-3 bottom-0 max-w-none" style={{ transform: 'translateX(43px)', width: 'calc(37vw - 7rem)' }}>
                  <div className="rounded-2xl border-2 border-border border-b-4 bg-white dark:bg-card text-foreground py-2 pl-3 pr-2 flex items-center gap-2">
                    <Bot className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm leading-tight flex-1 pr-2 truncate">
                      {showWrongAnswerTutorTip
                        ? 'Not sure what went wrong? Ask the Tutor to review your mistake.'
                        : 'Stuck? Try asking the Tutor how to approach this question.'}
                    </div>
                    <button type="button" aria-label="Dismiss" className="ml-auto text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setShowFirstTutorTip(false); setShowWrongAnswerTutorTip(false); }}>
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tutor Chat */}
        {showTutorChat && currentQuestion && (
          <ClientOnlyCompactVoiceConversation
            isOpen={showTutorChat}
            onClose={() => setShowTutorChat(false)}
            tutorName={tutorName}
            tutorVoice={tutorVoice}
            resetKey={tutorResetKey}
            proactiveAudio={false}
            question={{
              question: currentQuestion.question.replace(/@@|\*|\$\$|^###\s*/gm, '').trim(),
              options: (() => {
                const opts = currentQuestion.options;
                if (!opts) return [] as string[];
                if (Array.isArray(opts)) {
                  return opts.map((opt) => (typeof opt === 'string' ? opt : opt.text || ''));
                }
                return [] as string[];
              })(),
              answer: Array.isArray(currentQuestion.answer) ? String(currentQuestion.answer.join(' or ')) : String(currentQuestion.answer ?? ''),
              passage: currentQuestion.passage ? currentQuestion.passage.replace(/@@|\*|\$\$|^###\s*/gm, '').trim() : undefined,
            }}
            userAnswer={String(userAnswer?.answer ?? '')}
            thinkingAudio={recordedAudio}
            hasSubmittedAnswer={!!userAnswer}
            highlightsCsv={highlightsCsv}
          />
        )}

      </div>
    </MainLayout>
  );
}


