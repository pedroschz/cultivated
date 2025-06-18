"use client";

import { useEffect, useState } from 'react';
import { usePracticeSession, PracticeSessionProvider, fetchQuestions } from '@/lib/context/PracticeSessionContext';
import { Question } from '@/lib/types/practice';
import { useRouter } from 'next/navigation';
import { auth, app } from '@/lib/firebaseClient';
import { getFirestore, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { 
  MainLayout, 
  PageHeader,
  ScoreCard,
  Timer,
  ProgressIndicator,
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
  Loading
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
  XIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function PracticeSession() {
  const { state, dispatch } = usePracticeSession();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function loadQuestions() {
      try {
        const fetchedQuestions = await fetchQuestions();
        setQuestions(fetchedQuestions);
      } catch (error) {
        console.error('Error loading questions:', error);
        toast.error('Failed to load questions');
      } finally {
        setIsLoading(false);
      }
    }
    loadQuestions();
  }, []);

  useEffect(() => {
    // Only redirect if we're not loading and there's definitely no session
    if (!state.session && !isLoading && questions.length > 0) {
      router.replace('/dashboard');
    }
  }, [state.session, router, isLoading, questions.length]);

  useEffect(() => {
    async function checkBookmarkStatus() {
      if (!auth?.currentUser || !state.session) return;
      
      try {
        const db = getFirestore(app!);
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const bookmarks = userData.bookmarks || [];
          const currentQuestionId = state.session.questions[state.session.currentQuestionIndex].id;
          setIsBookmarked(bookmarks.includes(currentQuestionId));
        }
      } catch (error) {
        console.error('Error checking bookmark status:', error);
      }
    }

    checkBookmarkStatus();
  }, [state.session?.currentQuestionIndex]);

  const handleBookmark = async () => {
    if (!auth?.currentUser || !state.session) return;

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

  const handleMultipleChoiceAnswer = (optionIndex: number) => {
    if (!state.session) return;
    
    const currentQuestion = state.session.questions[state.session.currentQuestionIndex];
    const isCorrect = optionIndex === currentQuestion.answer;
    const timeSpent = state.session.duration * 60 - state.timeRemaining;
    
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
  };

  const handleTextSubmit = () => {
    if (textAnswer.trim() === '' || !state.session) return;
    
    const currentQuestion = state.session.questions[state.session.currentQuestionIndex];
    const isCorrect = textAnswer.trim().toLowerCase() === String(currentQuestion.answer).toLowerCase();
    const timeSpent = state.session.duration * 60 - state.timeRemaining;
    
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
    
    setTextAnswer('');
  };

  const handleNextQuestion = () => {
    dispatch({ type: 'NEXT_QUESTION' });
  };

  const handleFinishSession = () => {
    if (state.session!.currentQuestionIndex === state.session!.questions.length - 1) {
      dispatch({ type: 'COMPLETE_SESSION' });
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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text="Loading practice session..." />
        </div>
      </MainLayout>
    );
  }

  if (!questions.length) {
    return (
      <MainLayout>
        <EmptyState
          icon={BookOpenIcon}
          title="No questions available"
          description="There are no practice questions available at the moment. Please check back later or contact support."
          action={{
            label: "Return to Dashboard",
            onClick: () => router.replace('/dashboard')
          }}
        />
      </MainLayout>
    );
  }

  // Wait for session to be initialized
  if (!state.session) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text="Initializing practice session..." />
        </div>
      </MainLayout>
    );
  }

  // Results View
  if (state.showResults) {
    if (!state.session) return null;
    
    const correctAnswers = Object.values(state.session.userAnswers).filter(
      (answer) => answer.isCorrect
    ).length;
    const totalQuestions = state.session.questions.length;
    const percentage = (correctAnswers / totalQuestions) * 100;

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
                  <p className="text-2xl font-bold text-red-600">{totalQuestions - correctAnswers}</p>
                </div>
                <XCircleIcon className="h-8 w-8 text-red-600" />
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{totalQuestions}</p>
                </div>
                <TargetIcon className="h-8 w-8 text-blue-600" />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button 
              onClick={() => router.replace('/dashboard')}
              size="lg"
              className="gap-2"
            >
              <HomeIcon className="h-4 w-4" />
              Return to Dashboard
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const currentQuestion = state.session.questions[state.session.currentQuestionIndex];
  const userAnswer = state.session.userAnswers[currentQuestion.id];

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
          description={`Question ${state.session.currentQuestionIndex + 1} of ${state.session.questions.length}`}
        >
          <div className="flex items-center space-x-4">
            <Timer 
              initialTime={state.session.duration * 60}
              variant="compact"
            />
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

        {/* Progress Bar */}
        <ProgressIndicator 
          current={state.session.currentQuestionIndex + 1}
          total={state.session.questions.length}
          showPercentage={true}
        />

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
                    <div className="pt-4">
                      {state.session.currentQuestionIndex < state.session.questions.length - 1 ? (
                        <Button
                          onClick={handleNextQuestion}
                          className="w-full gap-2"
                          size="lg"
                        >
                          Next Question
                          <ArrowRightIcon className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={handleFinishSession}
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
    </MainLayout>
  );
}

export default function PracticePage() {
  return (
    <PracticeSessionProvider>
      <PracticeSession />
    </PracticeSessionProvider>
  );
} 