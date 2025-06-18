"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, app } from '../../lib/firebaseClient';
import { usePracticeSession, PracticeSessionProvider, fetchQuestions } from '@/lib/context/PracticeSessionContext';
import { Question, PracticeSessionDuration } from '@/lib/types/practice';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  MainLayout, 
  PageHeader,
  StatCard,
  TimeCard,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
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
  EmptyState,
  Loading,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Separator
} from '@/components';
import { 
  BookOpen, 
  TrendingUp, 
  Clock, 
  Target, 
  Trophy, 
  Brain,
  Calculator,
  BookText,
  RotateCcw,
  Play,
  ChevronRight,
  Star,
  Award
} from 'lucide-react';
import { DOMAIN_NAMES, SUBDOMAIN_NAMES, PRACTICE_DURATIONS, PERFORMANCE_CATEGORIES } from '@/lib/constants';
import { toast } from 'sonner';

interface PracticeSessionContextType {
  state: {
    session: Question[] | null;
    timeRemaining: number;
    showResults: boolean;
  };
  dispatch: React.Dispatch<{
    type: string;
    payload?: {
      duration?: PracticeSessionDuration;
      questions?: Question[];
    };
  }>;
}

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

interface DomainData {
  totalCorrect: number;
  totalAnswered: number;
  averageTime: number;
}

interface FieldData {
  [domainKey: string]: DomainData;
}

interface StatsData {
  math?: {
    [fieldKey: string]: FieldData;
  };
  readingAndWriting?: {
    [fieldKey: string]: FieldData;
  };
}

function DashboardContent() {
  const [userName, setUserName] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { state, dispatch } = usePracticeSession() as PracticeSessionContextType;
  const [questions, setQuestions] = useState<Question[]>([]);

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
    if (!auth) {
      setUserName("Valued User");
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setUserName(user.displayName || "Valued User");
      } else {
        setUserName("Valued User");
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Handle active practice session redirect
  useEffect(() => {
    if (state.session) {
      router.push('/practice');
    }
  }, [state.session, router]);

  useEffect(() => {
    async function fetchUserStats() {
      if (!auth?.currentUser || !app) {
        return;
      }
      
      const db = getFirestore(app);
      const userRef = doc(db, 'users', auth.currentUser.uid);
      
      try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          return;
        }
        
        const userData = userDoc.data();
        const stats = userData.stats as StatsData || {};
        
        // Calculate total time spent
        const totalTimeSpent = Object.values(stats.math || {}).reduce((total: number, field: FieldData) => {
          return total + Object.values(field).reduce((fieldTotal: number, domain: DomainData) => {
            return fieldTotal + (domain.averageTime * domain.totalAnswered || 0);
          }, 0);
        }, 0) + Object.values(stats.readingAndWriting || {}).reduce((total: number, field: FieldData) => {
          return total + Object.values(field).reduce((fieldTotal: number, domain: DomainData) => {
            return fieldTotal + (domain.averageTime * domain.totalAnswered || 0);
          }, 0);
        }, 0);

        // Calculate questions answered by category
        const totalQuestionsAnswered = {
          math: Object.values(stats.math || {}).reduce((total: number, field: FieldData) => {
            return total + Object.values(field).reduce((fieldTotal: number, domain: DomainData) => {
              return fieldTotal + (domain.totalAnswered || 0);
            }, 0);
          }, 0),
          readingAndWriting: Object.values(stats.readingAndWriting || {}).reduce((total: number, field: FieldData) => {
            return total + Object.values(field).reduce((fieldTotal: number, domain: DomainData) => {
              return fieldTotal + (domain.totalAnswered || 0);
            }, 0);
          }, 0)
        };

        // Calculate domain accuracies
        const domainAccuracies: { [key: string]: { correct: number; total: number } } = {};
        
        ['math', 'readingAndWriting'].forEach(subject => {
          Object.entries(stats[subject as keyof StatsData] || {}).forEach(([, field]: [string, FieldData]) => {
            Object.entries(field).forEach(([domainKey, domain]: [string, DomainData]) => {
              if (!domainAccuracies[domainKey]) {
                domainAccuracies[domainKey] = { correct: 0, total: 0 };
              }
              domainAccuracies[domainKey].correct += domain.totalCorrect || 0;
              domainAccuracies[domainKey].total += domain.totalAnswered || 0;
            });
          });
        });

        // Calculate strengths and weaknesses
        const domainResults = Object.entries(domainAccuracies)
          .filter(([, data]) => data.total > 0)
          .map(([domainKey, data]) => ({
            domain: DOMAIN_NAMES[domainKey] || 'Unknown',
            subdomain: SUBDOMAIN_NAMES[domainKey] || 'Unknown',
            accuracy: (data.correct / data.total) * 100
          }))
          .sort((a, b) => b.accuracy - a.accuracy);

        const strengths = domainResults.slice(0, 3);
        const weaknesses = domainResults.slice(-3).reverse();

        // Calculate average accuracy
        const totalCorrect = Object.values(domainAccuracies).reduce((sum, data) => sum + data.correct, 0);
        const totalAnswered = Object.values(domainAccuracies).reduce((sum, data) => sum + data.total, 0);
        const averageAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;

        setUserStats({
          totalTimeSpent: Math.floor(totalTimeSpent / 60),
          totalQuestionsAnswered,
          strengths,
          weaknesses,
          averageAccuracy
        });

      } catch (error) {
        console.error('Error fetching user stats:', error);
        toast.error('Failed to load your statistics');
      }
    }

    fetchUserStats();
  }, []);

  useEffect(() => {
    async function checkPremiumStatus() {
      if (!auth?.currentUser || !app) return;
      
      const db = getFirestore(app);
      const userRef = doc(db, 'users', auth.currentUser.uid);
      
      try {
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setIsPremium(userDoc.data().isPremium || false);
        }
      } catch (error) {
        console.error('Error checking premium status:', error);
      }
    }

    checkPremiumStatus();
  }, []);

  const startPracticeSession = (duration: PracticeSessionDuration) => {
    if (questions.length === 0) {
      toast.error('No questions available. Please try again later.');
      return;
    }

    dispatch({
      type: 'START_SESSION',
      payload: {
        duration,
        questions: questions.slice(0, Math.min(20, questions.length))
      }
    });

    router.push('/practice');
  };

  const handleResetHistory = async () => {
    if (!auth?.currentUser || !app) return;

    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', auth.currentUser.uid);
      
      await updateDoc(userRef, {
        stats: {}
      });
      
      setUserStats(null);
      toast.success('Practice history reset successfully');
    } catch (error) {
      console.error('Error resetting history:', error);
      toast.error('Failed to reset history');
    }
  };

  const getPerformanceLevel = (accuracy: number) => {
    if (accuracy >= PERFORMANCE_CATEGORIES.EXCELLENT.min) return PERFORMANCE_CATEGORIES.EXCELLENT;
    if (accuracy >= PERFORMANCE_CATEGORIES.GOOD.min) return PERFORMANCE_CATEGORIES.GOOD;
    if (accuracy >= PERFORMANCE_CATEGORIES.FAIR.min) return PERFORMANCE_CATEGORIES.FAIR;
    return PERFORMANCE_CATEGORIES.NEEDS_IMPROVEMENT;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text="Loading your dashboard..." />
        </div>
      </MainLayout>
    );
  }

  const totalQuestions = userStats ? (userStats.totalQuestionsAnswered.math + userStats.totalQuestionsAnswered.readingAndWriting) : 0;
  const hasStats = userStats && totalQuestions > 0;
  const performanceLevel = hasStats ? getPerformanceLevel(userStats.averageAccuracy) : null;

  return (
    <MainLayout breadcrumbs={[{ label: 'Dashboard' }]}>
      <div className="space-y-8">
        {/* Welcome Header */}
        <PageHeader 
          title={`Welcome back, ${userName}!`}
          description="Track your progress, start practice sessions, and achieve your SAT goals."
        >
          <div className="flex items-center space-x-2">
            {isPremium && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                <Star className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            )}
            <Button onClick={() => startPracticeSession(15)} className="gap-2">
              <Play className="h-4 w-4" />
              Quick Practice
            </Button>
          </div>
        </PageHeader>

        {/* Quick Start Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Start Practice Session
            </CardTitle>
            <CardDescription>
              Choose your practice duration and begin improving your SAT scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {PRACTICE_DURATIONS.map((duration) => (
                <Button
                  key={duration}
                  variant="outline"
                  onClick={() => startPracticeSession(duration)}
                  className="h-16 flex flex-col gap-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Clock className="h-4 w-4" />
                  <span className="font-semibold">{duration} min</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Progress</h2>
            {hasStats && (
              <Badge variant={performanceLevel?.label === 'Excellent' ? 'default' : 'secondary'}>
                {performanceLevel?.label}
              </Badge>
            )}
          </div>

          {!hasStats ? (
            <EmptyState
              icon={BookOpen}
              title="Start your SAT journey!"
              description="Complete your first practice session to see detailed statistics and track your progress over time."
              action={{
                label: "Start Practice Session",
                onClick: () => startPracticeSession(15)
              }}
            />
          ) : (
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="strengths">Strengths</TabsTrigger>
                <TabsTrigger value="improvements">Areas to Improve</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Key Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard
                    title="Overall Accuracy"
                    value={`${userStats.averageAccuracy.toFixed(1)}%`}
                    icon={Target}
                    trend={{
                      value: userStats.averageAccuracy >= 75 ? 5 : -2,
                      label: "vs target"
                    }}
                    badge={{
                      text: performanceLevel?.label || "Getting Started",
                      variant: performanceLevel?.label === 'Excellent' ? 'default' : 'secondary'
                    }}
                  />
                  
                  <TimeCard 
                    minutes={userStats.totalTimeSpent}
                    label="Study Time"
                    showHours={true}
                  />
                  
                  <StatCard
                    title="Math Questions"
                    value={userStats.totalQuestionsAnswered.math}
                    description={`${Math.round((userStats.totalQuestionsAnswered.math / totalQuestions) * 100)}% of total`}
                    icon={Calculator}
                  />
                  
                  <StatCard
                    title="Reading & Writing"
                    value={userStats.totalQuestionsAnswered.readingAndWriting}
                    description={`${Math.round((userStats.totalQuestionsAnswered.readingAndWriting / totalQuestions) * 100)}% of total`}
                    icon={BookText}
                  />
                </div>

                {/* Progress Visualization */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Subject Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Math ({userStats.totalQuestionsAnswered.math} questions)</span>
                        <span>{Math.round((userStats.totalQuestionsAnswered.math / totalQuestions) * 100)}%</span>
                      </div>
                      <Progress value={(userStats.totalQuestionsAnswered.math / totalQuestions) * 100} />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Reading & Writing ({userStats.totalQuestionsAnswered.readingAndWriting} questions)</span>
                        <span>{Math.round((userStats.totalQuestionsAnswered.readingAndWriting / totalQuestions) * 100)}%</span>
                      </div>
                      <Progress value={(userStats.totalQuestionsAnswered.readingAndWriting / totalQuestions) * 100} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="strengths" className="space-y-6">
                <div className="grid gap-4">
                  {userStats.strengths.length > 0 ? (
                    userStats.strengths.map((strength, index) => (
                      <Card key={index}>
                        <CardContent className="flex items-center justify-between p-6">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-green-100 p-2">
                              <Trophy className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{strength.domain}</h3>
                              <p className="text-sm text-muted-foreground">{strength.subdomain}</p>
                            </div>
                          </div>
                          <Badge className="bg-green-100 text-green-800">
                            {strength.accuracy.toFixed(1)}%
                          </Badge>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <EmptyState
                      icon={Trophy}
                      title="Build your strengths"
                      description="Complete more practice sessions to identify your strongest subjects."
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="improvements" className="space-y-6">
                <div className="grid gap-4">
                  {userStats.weaknesses.length > 0 ? (
                    userStats.weaknesses.map((weakness, index) => (
                      <Card key={index}>
                        <CardContent className="flex items-center justify-between p-6">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-orange-100 p-2">
                              <Brain className="h-4 w-4 text-orange-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{weakness.domain}</h3>
                              <p className="text-sm text-muted-foreground">{weakness.subdomain}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {weakness.accuracy.toFixed(1)}%
                            </Badge>
                            <Button size="sm" variant="outline">
                              Practice
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <EmptyState
                      icon={Target}
                      title="Keep practicing!"
                      description="Complete more sessions to see which areas need the most attention."
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Premium Features */}
        {isPremium && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-600" />
                  Premium Features
                </CardTitle>
                <CardDescription>
                  Advanced tools to accelerate your SAT preparation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Reset History
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Practice History</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all your practice statistics and progress. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetHistory}>
                        Reset History
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}

export default function DashboardPage() {
  return (
    <PracticeSessionProvider>
      <DashboardContent />
    </PracticeSessionProvider>
  );
}