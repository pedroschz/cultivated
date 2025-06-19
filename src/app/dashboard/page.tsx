"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, app } from '@/lib/firebaseClient';
import { usePracticeSession } from '@/lib/context/PracticeSessionContext';
import { PracticeSessionDuration, Question } from '@/lib/types/practice';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  MainLayout,
  PageHeader,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Progress,
  EmptyState,
  Loading,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components';
import { 
  Clock,
  Target,
  BookOpen,
  Award,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import { DOMAIN_NAMES, SUBDOMAIN_NAMES, PERFORMANCE_CATEGORIES } from '@/lib/constants';
import { toast } from 'sonner';
import { SkillMastery } from '@/components/SkillMastery';

// Limited practice durations - only 10 and 20 minutes
const PRACTICE_DURATIONS = [10, 20] as const;

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
  const [user, setUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { state, dispatch } = usePracticeSession() as PracticeSessionContextType;


  useEffect(() => {
    // We no longer need to pre-load questions for time-based sessions
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!auth) {
      setUserName("Valued User");
      setUser(null);
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser: User | null) => {
      if (currentUser) {
        setUserName(currentUser.displayName || "Valued User");
        setUser(currentUser);
      } else {
        setUserName("Valued User");
        setUser(null);
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

  // Fetch user stats whenever user changes
  useEffect(() => {
    async function fetchUserStats() {
      if (!user || !app) {
        console.log('No user or app available, skipping stats fetch');
        return;
      }
      
      console.log('Fetching stats for user:', user.uid);
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      
      try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          console.log('User document does not exist');
          return;
        }
        
        const userData = userDoc.data();
        const stats = userData.stats as StatsData || {};
        
        console.log('User stats data:', stats);
        
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

        const calculatedStats = {
          totalTimeSpent: Math.floor(totalTimeSpent / 60),
          totalQuestionsAnswered,
          strengths,
          weaknesses,
          averageAccuracy
        };

        console.log('Calculated stats:', calculatedStats);
        setUserStats(calculatedStats);

      } catch (error) {
        console.error('Error fetching user stats:', error);
        toast.error('Failed to load your statistics');
      }
    }

    async function checkPremiumStatus() {
      if (!user || !app) {
        return;
      }
      
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      
      try {
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsPremium(userData.premium === true);
        }
      } catch (error) {
        console.error('Error checking premium status:', error);
      }
    }

    if (user) {
      fetchUserStats();
      checkPremiumStatus();
    }
  }, [user]);

  const startPracticeSession = (duration: PracticeSessionDuration) => {
    dispatch({
      type: 'START_SESSION',
      payload: {
        duration,
      },
    });
    toast.success(`Starting ${duration}-minute practice session!`);
    // Navigate to practice page
    router.push('/practice');
  };

  const handleResetHistory = async () => {
    if (!user || !app) return;

    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      
      await updateDoc(userRef, {
        stats: {}
      });
      
      setUserStats(null);
      toast.success('Practice history reset successfully');
    } catch (error) {
      console.error('Error resetting history:', error);
      toast.error('Failed to reset practice history');
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
    <MainLayout maxWidth="full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-7xl mx-auto">
        {/* Left Column - Welcome and Practice */}
        <div className="space-y-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>Home</span>
              <span>&gt;</span>
              <span className="text-foreground font-medium">Dashboard</span>
            </div>
          </div>

          {/* Welcome Header */}
          <PageHeader 
            title={`Welcome back, ${userName}!`}
            description="Track your progress, start practice sessions, and achieve your SAT goals."
          />

          {/* Quick Start Section - Limited to 10 and 20 minutes */}
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
              <div className="grid grid-cols-2 gap-4">
                {PRACTICE_DURATIONS.map((duration) => (
                  <Button
                    key={duration}
                    variant="outline"
                    onClick={() => startPracticeSession(duration)}
                    className="h-20 flex flex-col gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Clock className="h-5 w-5" />
                    <span className="font-semibold text-lg">{duration} min</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Overview Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Overview</h2>
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
                  onClick: () => startPracticeSession(10)
                }}
              />
            ) : (
              <div className="space-y-6">
                {/* Key Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="flex items-center justify-between p-6">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Overall Accuracy</p>
                        <p className="text-2xl font-bold">{userStats.averageAccuracy.toFixed(1)}%</p>
                      </div>
                      <Target className="h-8 w-8 text-primary" />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="flex items-center justify-between p-6">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Study Time</p>
                        <p className="text-2xl font-bold">{Math.floor(userStats.totalTimeSpent / 60)}h {userStats.totalTimeSpent % 60}m</p>
                      </div>
                      <Clock className="h-8 w-8 text-primary" />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="flex items-center justify-between p-6">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Math Questions</p>
                        <p className="text-2xl font-bold">{userStats.totalQuestionsAnswered.math}</p>
                        <p className="text-sm text-muted-foreground">{Math.round((userStats.totalQuestionsAnswered.math / totalQuestions) * 100)}% of total</p>
                      </div>
                      <Target className="h-8 w-8 text-primary" />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="flex items-center justify-between p-6">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Reading & Writing</p>
                        <p className="text-2xl font-bold">{userStats.totalQuestionsAnswered.readingAndWriting}</p>
                        <p className="text-sm text-muted-foreground">{Math.round((userStats.totalQuestionsAnswered.readingAndWriting / totalQuestions) * 100)}% of total</p>
                      </div>
                      <BookOpen className="h-8 w-8 text-primary" />
                    </CardContent>
                  </Card>
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
              </div>
            )}
          </div>

          {/* Premium Features */}
          {isPremium && (
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
          )}
        </div>

        {/* Right Column - Skills Only */}
        <div className="space-y-8">
          {/* Skill Mastery Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Skill Mastery</h2>
            <SkillMastery />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}