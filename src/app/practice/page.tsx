"use client";

import { useEffect, useState } from 'react';
import { usePracticeSession, fetchOptimizedQuestion } from '@/lib/context/PracticeSessionContext';
import { Question } from '@/lib/types/practice';
import { useRouter } from 'next/navigation';
import { auth, app } from '@/lib/firebaseClient';
import { getFirestore, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
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
  EmptyState,
  Loading,
  Progress
} from '@/components';
import { 
  BookmarkIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ArrowRightIcon,
  HomeIcon,
  FlagIcon,
  BookOpenIcon,
  TargetIcon,
  Trophy,
  XIcon,
  Clock,
  Loader2,
  Mic,
  MessageSquare,
  CheckCircle,
  MicOff
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVoiceRecording } from '@/lib/hooks/useVoiceRecording';
import { AutoVoiceRecorder } from '@/components/voice/AutoVoiceRecorder';
import { CompactVoiceConversation } from '@/components/voice/CompactVoiceConversation';
import { TutorChat } from '@/components/voice/TutorChat';

function PracticeSession() {
  const { state, dispatch } = usePracticeSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [loadingNextQuestion, setLoadingNextQuestion] = useState(false);
  const [hasLoadedFirstQuestion, setHasLoadedFirstQuestion] = useState(false);
  const [showTutorChat, setShowTutorChat] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const router = useRouter();

  // Voice recording hook
  const voiceRecording = useVoiceRecording();

  // Load first question when session starts
  useEffect(() => {
    async function loadFirstQuestion() {
      console.log('Checking if should load first question:', {
        hasSession: !!state.session,
        questionsLength: state.session?.questions.length,
        currentIndex: state.session?.currentQuestionIndex,
        isLoading,
        hasLoadedFirstQuestion
      });

      if (state.session && 
          state.session.questions.length === 0 && 
          state.session.currentQuestionIndex === -1 && 
          !isLoading && 
          !hasLoadedFirstQuestion) {
        console.log('Loading first question...');
        setIsLoading(true);
        setHasLoadedFirstQuestion(true);
        try {
          const question = await fetchOptimizedQuestion();
          console.log('Fetched question:', question);
          if (question) {
            dispatch({ 
              type: 'LOAD_NEXT_QUESTION', 
              payload: { question } 
            });
          } else {
            console.log('No question available');
            toast.error('No questions available');
            router.replace('/dashboard');
          }
        } catch (error) {
          console.error('Error loading first question:', error);
          toast.error('Failed to load questions');
          router.replace('/dashboard');
        } finally {
          setIsLoading(false);
        }
      }
    }

    if (state.session) {
      loadFirstQuestion();
    }
  }, [state.session, hasLoadedFirstQuestion, dispatch, router, isLoading]);

  // Redirect if no active session and reset question loading flag
  useEffect(() => {
    if (!state.session && !isLoading && !state.showResults) {
      console.log('No session found, redirecting to dashboard');
      console.log('Current state:', state);
      setHasLoadedFirstQuestion(false);
      router.replace('/dashboard');
    }
  }, [state.session, router, isLoading, state.showResults]);

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

  const handleExitSession = () => {
    setShowExitConfirm(true);
  };

  const confirmExit = () => {
    dispatch({ type: 'RESET_SESSION' });
    router.replace('/dashboard');
    toast.info('Practice session ended');
  };

  const handleMultipleChoiceAnswer = async (optionIndex: number) => {
    if (!state.session) return;
    
    const currentQuestion = state.session.questions[state.session.currentQuestionIndex];
    const isCorrect = optionIndex === currentQuestion.answer;
    const timeSpent = state.session.duration * 60 - state.timeRemaining;
    
    console.log('Answer submitted:', { optionIndex, correctAnswer: currentQuestion.answer, isCorrect });
    
    // Stop recording and get audio
    let audioBlob = null;
    if (voiceRecording.isRecording) {
      audioBlob = await voiceRecording.stopRecording();
      setRecordedAudio(audioBlob);
      
      if (audioBlob) {
        toast.success('Thinking process recorded!');
      }
    }
    
    dispatch({
      type: 'ANSWER_QUESTION',
      payload: {
        questionId: String(currentQuestion.id),
        answer: optionIndex,
        isCorrect,
        timeSpent,
        domain: currentQuestion.domain ? String(currentQuestion.domain) : undefined
      },
    });

    // If answer is wrong, show voice tutor (with or without recorded audio)
    if (!isCorrect) {
      console.log('Wrong answer - starting voice conversation');
      setRecordedAudio(audioBlob); // Set the audio even if null
      setShowTutorChat(true);
    } else {
      console.log('Correct answer - no tutoring needed');
    }
  };

  const handleTextSubmit = async () => {
    if (textAnswer.trim() === '' || !state.session) return;
    
    const currentQuestion = state.session.questions[state.session.currentQuestionIndex];
    const isCorrect = textAnswer.trim().toLowerCase() === String(currentQuestion.answer).toLowerCase();
    const timeSpent = state.session.duration * 60 - state.timeRemaining;
    
    console.log('Text answer submitted:', { userAnswer: textAnswer.trim(), correctAnswer: currentQuestion.answer, isCorrect });
    
    // Stop recording and get audio
    let audioBlob = null;
    if (voiceRecording.isRecording) {
      audioBlob = await voiceRecording.stopRecording();
      setRecordedAudio(audioBlob);
      
      if (audioBlob) {
        toast.success('Thinking process recorded!');
      }
    }
    
    dispatch({
      type: 'ANSWER_QUESTION',
      payload: {
        questionId: String(currentQuestion.id),
        answer: textAnswer.trim(),
        isCorrect,
        timeSpent,
        domain: currentQuestion.domain ? String(currentQuestion.domain) : undefined
      },
    });
    
    // If answer is wrong, show voice tutor (with or without recorded audio)
    if (!isCorrect) {
      console.log('Wrong answer - starting voice conversation');
      setRecordedAudio(audioBlob); // Set the audio even if null
      setShowTutorChat(true);
    } else {
      console.log('Correct answer - no tutoring needed');
    }
    
    setTextAnswer('');
  };

  const handleNextQuestion = async () => {
    if (!state.session) return;
    
    // Close any active AI tutoring session when moving to next question
    if (showTutorChat) {
      setShowTutorChat(false);
      setRecordedAudio(null);
    }
    
    // Check if time is up
    if (state.timeRemaining <= 0) {
      dispatch({ type: 'COMPLETE_SESSION' });
      return;
    }

    console.log('Loading next question...');
    setLoadingNextQuestion(true);
    
    try {
      // Get IDs of already used questions to avoid duplicates
      const usedQuestionIds = state.session.questions.map(q => q.id);
      console.log('Used question IDs:', usedQuestionIds);
      
      const nextQuestion = await fetchOptimizedQuestion(usedQuestionIds);
      console.log('Next question fetched:', nextQuestion);
      
      if (nextQuestion) {
        // Double check we're not getting a duplicate
        if (usedQuestionIds.includes(nextQuestion.id)) {
          console.warn('Received duplicate question despite filtering:', nextQuestion.id);
          // Try again with stricter exclusion
          const retryQuestion = await fetchOptimizedQuestion(usedQuestionIds);
          if (retryQuestion && !usedQuestionIds.includes(retryQuestion.id)) {
            dispatch({ 
              type: 'LOAD_NEXT_QUESTION', 
              payload: { question: retryQuestion } 
            });
            console.log('Retry question dispatched:', retryQuestion.id);
          } else {
            console.log('Still no unique question after retry, completing session');
            toast.info('No more unique questions available');
            dispatch({ type: 'COMPLETE_SESSION' });
          }
        } else {
          dispatch({ 
            type: 'LOAD_NEXT_QUESTION', 
            payload: { question: nextQuestion } 
          });
          console.log('Next question dispatched:', nextQuestion.id);
        }
      } else {
        console.log('No more questions available, completing session');
        toast.info('No more questions available');
        dispatch({ type: 'COMPLETE_SESSION' });
      }
    } catch (error) {
      console.error('Error loading next question:', error);
      toast.error('Failed to load next question');
      // Continue anyway - complete session
      dispatch({ type: 'COMPLETE_SESSION' });
    } finally {
      setLoadingNextQuestion(false);
    }
  };

  const getOptionVariant = (index: number, userAnswer: { answer: string | number; isCorrect: boolean }, correctAnswer: number) => {
    if (!userAnswer) return 'outline';
    
    if (index === correctAnswer) return 'default';
    if (index === Number(userAnswer.answer) && !userAnswer.isCorrect) return 'destructive';
    return 'outline';
  };

  const getOptionIcon = (index: number, userAnswer: { answer: string | number; isCorrect: boolean }, correctAnswer: number) => {
    if (!userAnswer) return null;
    
    if (index === correctAnswer) return <CheckCircleIcon className="h-4 w-4" />;
    if (index === Number(userAnswer.answer) && !userAnswer.isCorrect) return <XCircleIcon className="h-4 w-4" />;
    return null;
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTimeProgress = () => {
    if (!state.session) return 0;
    const totalTime = state.session.duration * 60;
    const elapsedTime = totalTime - state.timeRemaining;
    return (elapsedTime / totalTime) * 100;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text="Loading practice session..." />
        </div>
      </MainLayout>
    );
  }

  // Wait for session to be initialized
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
          <div className="mt-4 text-sm text-muted-foreground">
            Debug: {state.session ? `Session exists, index: ${state.session.currentQuestionIndex}` : 'No session found'}
          </div>
        </div>
      </MainLayout>
    );
  }

  // Results View
  if (state.showResults) {
    if (!state.session) return null;
    
    const answeredQuestions = Object.values(state.session.userAnswers).length;
    const correctAnswers = Object.values(state.session.userAnswers).filter(
      (answer) => answer.isCorrect
    ).length;
    const percentage = answeredQuestions > 0 ? (correctAnswers / answeredQuestions) * 100 : 0;

    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Session Complete!</h1>
            <p className="text-muted-foreground text-lg">
              Great job! Here&apos;s how you performed.
            </p>
          </div>

          <ScoreCard
            score={percentage}
            total={100}
            label="Overall Score"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Questions Answered</p>
                  <p className="text-2xl font-bold text-primary">{answeredQuestions}</p>
                </div>
                <TargetIcon className="h-8 w-8 text-primary" />
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Correct</p>
                  <p className="text-2xl font-bold text-green-600">{correctAnswers}</p>
                </div>
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Incorrect</p>
                  <p className="text-2xl font-bold text-red-600">{answeredQuestions - correctAnswers}</p>
                </div>
                <XCircleIcon className="h-8 w-8 text-red-600" />
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-4">
            <Button 
              onClick={() => {
                console.log('Return to Dashboard clicked');
                dispatch({ type: 'RESET_SESSION' });
                
                // Small delay to ensure state is reset before navigation
                setTimeout(() => {
                  router.replace('/dashboard');
                  toast.success('Session completed');
                }, 100);
              }} 
              className="flex-1 gap-2"
              size="lg"
            >
              <HomeIcon className="h-4 w-4" />
              Return to Dashboard
            </Button>
            <Button 
              onClick={() => {
                console.log('Practice Again clicked');
                const sessionDuration = state.session!.duration;
                dispatch({ type: 'RESET_SESSION' });
                setHasLoadedFirstQuestion(false);
                
                // Small delay to ensure state is reset properly
                setTimeout(() => {
                  dispatch({
                    type: 'START_SESSION',
                    payload: { duration: sessionDuration }
                  });
                  toast.success('Starting new practice session');
                }, 100);
              }}
              variant="outline" 
              className="flex-1 gap-2"
              size="lg"
            >
              Practice Again
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const currentQuestion = state.session.questions[state.session.currentQuestionIndex];
  const userAnswer = state.session.userAnswers[currentQuestion?.id];

  console.log('Current question state:', {
    currentIndex: state.session.currentQuestionIndex,
    totalQuestions: state.session.questions.length,
    currentQuestionId: currentQuestion?.id,
    hasUserAnswer: !!userAnswer
  });

  // If we don't have a current question but the index suggests we should, show loading
  if (!currentQuestion) {
    console.log('No current question found:', {
      hasSession: !!state.session,
      currentIndex: state.session?.currentQuestionIndex,
      questionsLength: state.session?.questions.length,
      loadingNextQuestion
    });
    
    return (
      <MainLayout 
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Practice Session' }
        ]}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text={loadingNextQuestion ? "Loading next question..." : "Loading question..."} />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Practice Session' }
      ]}
    >
      <div className="space-y-6">
        {/* Session Header */}
        <PageHeader 
          title="Practice Session"
          description={`Question ${state.session.currentQuestionIndex + 1} • ${Object.keys(state.session.userAnswers).length} answered`}
        >
          <div className="flex items-center space-x-4">
            {/* Time Display */}
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Badge 
                variant={state.timeRemaining <= 60 ? "destructive" : state.timeRemaining <= 300 ? "secondary" : "outline"}
                className={cn(
                  "font-mono",
                  state.timeRemaining <= 10 && "animate-pulse"
                )}
              >
                {formatTime(state.timeRemaining)}
              </Badge>
            </div>
            
            <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
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
        </PageHeader>

        {/* Time Progress Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Time Elapsed</span>
                <span>{formatTime((state.session.duration * 60) - state.timeRemaining)} / {formatTime(state.session.duration * 60)}</span>
              </div>
              <Progress 
                value={getTimeProgress()} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Auto Voice Recording - Compact Bottom Right Indicator */}
        {!userAnswer && (
          <AutoVoiceRecorder
            isRecording={voiceRecording.isRecording}
            isPaused={voiceRecording.isPaused}
            duration={voiceRecording.duration}
            volume={voiceRecording.volume}
            hasPermission={voiceRecording.hasPermission}
            isRequestingPermission={voiceRecording.isRequestingPermission}
            error={voiceRecording.error}
            onStartRecording={voiceRecording.startRecording}
            onStopRecording={voiceRecording.stopRecording}
            onPauseRecording={voiceRecording.pauseRecording}
            onResumeRecording={voiceRecording.resumeRecording}
            onRequestPermission={voiceRecording.requestPermission}
            autoStart={true}
            questionId={currentQuestion?.id}
          />
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Question Column */}
          <div className={cn(
            "space-y-6",
            currentQuestion.passage && currentQuestion.passage.trim() !== '' 
              ? "lg:col-span-7" 
              : "lg:col-span-12"
          )}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      Question {state.session.currentQuestionIndex + 1}
                    </Badge>
                    {currentQuestion.domain && (
                      <Badge variant="outline">
                        {currentQuestion.domain}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBookmark}
                    className={cn(
                      "gap-2 transition-colors",
                      isBookmarked ? "text-yellow-600 hover:text-yellow-700" : "text-muted-foreground"
                    )}
                  >
                    <BookmarkIcon 
                      className={cn(
                        "h-4 w-4",
                        isBookmarked && "fill-current"
                      )} 
                    />
                    {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Question Text */}
                <div className="prose prose-lg max-w-none">
                  <p className="text-lg leading-relaxed">{currentQuestion.question}</p>
                </div>

                {/* Question Image */}
                {currentQuestion.imageURL && (
                  <div className="rounded-lg border overflow-hidden">
                    <img
                      src={currentQuestion.imageURL}
                      alt="Question illustration"
                      className="w-full h-auto"
                    />
                  </div>
                )}

                {/* Answer Section */}
                {!userAnswer ? (
                  <div className="space-y-4">
                    {Array.isArray(currentQuestion.options) ? (
                      // Multiple Choice
                      <div className="grid gap-3">
                        {currentQuestion.options.map((option, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            onClick={() => handleMultipleChoiceAnswer(index)}
                            className="w-full justify-start h-auto p-4 text-left whitespace-normal"
                            disabled={!!userAnswer}
                          >
                            <div className="flex items-start gap-3 w-full">
                              <div className="w-6 h-6 rounded-full border-2 border-current flex-shrink-0 flex items-center justify-center text-xs font-medium">
                                {String.fromCharCode(65 + index)}
                              </div>
                              <span className="flex-1">{option}</span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      // Text Input
                      <div className="space-y-4">
                        <Input
                          type="text"
                          value={textAnswer}
                          onChange={(e) => setTextAnswer(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                          placeholder="Type your answer here..."
                          className="text-lg p-4 h-12"
                        />
                        <Button
                          onClick={handleTextSubmit}
                          disabled={textAnswer.trim() === ''}
                          className="w-full"
                          size="lg"
                        >
                          Submit Answer
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  // Answer Results
                  <div className="space-y-6">
                    {Array.isArray(currentQuestion.options) ? (
                      // Multiple Choice Results
                      <div className="grid gap-3">
                        {currentQuestion.options.map((option, index) => (
                          <Button
                            key={index}
                            variant={getOptionVariant(index, userAnswer, Number(currentQuestion.answer))}
                            className="w-full justify-start h-auto p-4 text-left whitespace-normal"
                            disabled
                          >
                            <div className="flex items-start gap-3 w-full">
                              <div className="w-6 h-6 rounded-full border-2 border-current flex-shrink-0 flex items-center justify-center text-xs font-medium">
                                {String.fromCharCode(65 + index)}
                              </div>
                              <span className="flex-1">{option}</span>
                              {getOptionIcon(index, userAnswer, Number(currentQuestion.answer))}
                            </div>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      // Text Input Results
                      <div className="space-y-3">
                        <div className={cn(
                          "p-4 rounded-lg border-2",
                          userAnswer.isCorrect 
                            ? "bg-green-50 border-green-200" 
                            : "bg-red-50 border-red-200"
                        )}>
                          <div className="flex items-center gap-2 mb-2">
                            {userAnswer.isCorrect ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircleIcon className="h-5 w-5 text-red-600" />
                            )}
                            <span className="font-semibold">
                              {userAnswer.isCorrect ? 'Correct!' : 'Incorrect'}
                            </span>
                          </div>
                          <p><strong>Your answer:</strong> {userAnswer.answer}</p>
                          <p><strong>Correct answer:</strong> {currentQuestion.answer}</p>
                        </div>
                      </div>
                    )}

                    {/* Result Feedback */}
                    <div className={cn(
                      "flex items-center gap-2 p-3 rounded-lg",
                      userAnswer.isCorrect 
                        ? "bg-green-50 text-green-700" 
                        : "bg-red-50 text-red-700"
                    )}>
                      {userAnswer.isCorrect ? (
                        <CheckCircleIcon className="h-5 w-5" />
                      ) : (
                        <XCircleIcon className="h-5 w-5" />
                      )}
                      <span className="font-medium">
                        {userAnswer.isCorrect ? 'Well done!' : 'Keep practicing!'}
                      </span>
                    </div>

                    {/* Navigation */}
                    <div className="pt-4 space-y-3">
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
                      
                      {state.timeRemaining > 0 ? (
                        <Button
                          onClick={handleNextQuestion}
                          className="w-full gap-2"
                          size="lg"
                          disabled={loadingNextQuestion}
                        >
                          {loadingNextQuestion ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading Question...
                            </>
                          ) : (
                            <>
                              Next Question
                              <ArrowRightIcon className="h-4 w-4" />
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => dispatch({ type: 'COMPLETE_SESSION' })}
                          className="w-full gap-2"
                          size="lg"
                        >
                          <FlagIcon className="h-4 w-4" />
                          Finish Session
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Passage Column (if exists) */}
          {currentQuestion.passage && currentQuestion.passage.trim() !== '' && (
            <div className="lg:col-span-5">
              <Card className="h-fit sticky top-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    Reading Passage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none max-h-96 overflow-y-auto pr-2">
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {currentQuestion.passage}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* AI Tutor Chat - Compact Voice Conversation */}
      <CompactVoiceConversation
        isOpen={showTutorChat}
        question={{
          question: currentQuestion?.question || '',
          options: currentQuestion?.options || [],
          answer: currentQuestion?.answer || '',
          passage: currentQuestion?.passage
        }}
        userAnswer={userAnswer?.answer || ''}
        thinkingAudio={recordedAudio}
        onClose={() => setShowTutorChat(false)}
      />
    </MainLayout>
  );
}

export default function PracticePage() {
  return <PracticeSession />;
} 