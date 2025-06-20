"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, app } from '@/lib/firebaseClient';
import { usePracticeSession } from '@/lib/context/PracticeSessionContext';
import { PracticeSessionDuration, Question } from '@/lib/types/practice';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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
  Loading
} from '@/components';
import { 
  Clock,
  Target,
  BookOpen,
  TrendingUp
} from 'lucide-react';
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent, 
  ChartLegend, 
  ChartLegendContent,
  type ChartConfig 
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { DOMAIN_NAMES, SUBDOMAIN_NAMES, PERFORMANCE_CATEGORIES } from '@/lib/constants';
import { toast } from 'sonner';
import { collection, getDocs } from 'firebase/firestore';
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

interface HistoricalData {
  date: string;
  overall: number | null;
  math: number | null;
  readingWriting: number | null;
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
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const router = useRouter();
  const { state, dispatch } = usePracticeSession() as PracticeSessionContextType;

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
        setIsStatsLoading(false);
        return;
      }
      
      setIsStatsLoading(true);
      console.log('Fetching stats for user:', user.uid);
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      
      try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          console.log('User document does not exist');
          setIsStatsLoading(false);
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
        
        // Fetch real historical mastery data from user's practice history
        const generateRealHistoricalData = async (): Promise<HistoricalData[]> => {
          try {
            // Get user's practice history
            const history = userData.history || [];
            if (history.length === 0) {
              // No history yet, return empty array
              return [];
            }

            // Fetch questions data to map question IDs to domains
            const questionsRef = collection(db, 'questions');
            const questionsSnapshot = await getDocs(questionsRef);
            const questionsDomainMap: { [questionId: string]: number } = {};
            
            questionsSnapshot.docs.forEach(doc => {
              const questionData = doc.data();
              questionsDomainMap[doc.id] = questionData.domain;
            });

            // Group history by date (last 7 days)
            const now = new Date();
            const dayGroups: { [dateKey: string]: { 
              overall: { correct: number; total: number };
              math: { correct: number; total: number };
              readingWriting: { correct: number; total: number };
            }} = {};

            // Initialize last 7 days
            for (let i = 6; i >= 0; i--) {
              const date = new Date(now);
              date.setDate(date.getDate() - i);
              const dateKey = date.toDateString();
              dayGroups[dateKey] = {
                overall: { correct: 0, total: 0 },
                math: { correct: 0, total: 0 },
                readingWriting: { correct: 0, total: 0 }
              };
            }

            // Process each history entry
            history.forEach((entry: any) => {
              const answerDate = new Date(entry.answeredAt);
              const dateKey = answerDate.toDateString();
              
              // Only include data from last 7 days
              if (dayGroups[dateKey]) {
                const questionDomain = questionsDomainMap[entry.questionId];
                const isCorrect = entry.correct;
                
                // Update overall stats
                dayGroups[dateKey].overall.total++;
                if (isCorrect) dayGroups[dateKey].overall.correct++;
                
                // Update domain-specific stats
                if (questionDomain !== undefined) {
                  if (questionDomain >= 0 && questionDomain <= 3) {
                    // Math domains (0-3)
                    dayGroups[dateKey].math.total++;
                    if (isCorrect) dayGroups[dateKey].math.correct++;
                  } else if (questionDomain >= 4 && questionDomain <= 7) {
                    // Reading & Writing domains (4-7)
                    dayGroups[dateKey].readingWriting.total++;
                    if (isCorrect) dayGroups[dateKey].readingWriting.correct++;
                  }
                }
              }
            });

                         // Convert to chart data format
             const data: HistoricalData[] = [];
             const todayKey = now.toDateString();
             
             for (let i = 6; i >= 0; i--) {
               const date = new Date(now);
               date.setDate(date.getDate() - i);
               const dateKey = date.toDateString();
               const dayData = dayGroups[dateKey];
               const isToday = dateKey === todayKey;
               
               let overallAccuracy: number | null;
               let mathAccuracy: number | null;
               let rwAccuracy: number | null;
               
               if (isToday) {
                 // For today, use current overall mastery level from calculated stats
                 overallAccuracy = Math.round(calculatedStats.averageAccuracy);
                 
                 // For math and R&W today, use current domain-specific accuracy if available
                 const mathDomainStats = Object.values(stats.math || {}).flatMap(field => Object.values(field));
                 const rwDomainStats = Object.values(stats.readingAndWriting || {}).flatMap(field => Object.values(field));
                 
                 const mathTotalCorrect = mathDomainStats.reduce((sum, domain) => sum + (domain.totalCorrect || 0), 0);
                 const mathTotalAnswered = mathDomainStats.reduce((sum, domain) => sum + (domain.totalAnswered || 0), 0);
                 mathAccuracy = mathTotalAnswered > 0 ? Math.round((mathTotalCorrect / mathTotalAnswered) * 100) : null;
                 
                 const rwTotalCorrect = rwDomainStats.reduce((sum, domain) => sum + (domain.totalCorrect || 0), 0);
                 const rwTotalAnswered = rwDomainStats.reduce((sum, domain) => sum + (domain.totalAnswered || 0), 0);
                 rwAccuracy = rwTotalAnswered > 0 ? Math.round((rwTotalCorrect / rwTotalAnswered) * 100) : null;
               } else {
                 // For past days, use historical daily data
                 overallAccuracy = dayData.overall.total > 0 ? 
                   Math.round((dayData.overall.correct / dayData.overall.total) * 100) : null;
                 mathAccuracy = dayData.math.total > 0 ? 
                   Math.round((dayData.math.correct / dayData.math.total) * 100) : null;
                 rwAccuracy = dayData.readingWriting.total > 0 ? 
                   Math.round((dayData.readingWriting.correct / dayData.readingWriting.total) * 100) : null;
               }
               
               data.push({
                 date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                 overall: overallAccuracy,
                 math: mathAccuracy,
                 readingWriting: rwAccuracy,
               });
             }

            return data;
          } catch (error) {
            console.error('Error generating historical data:', error);
            return [];
          }
        };
        
        const historicalData = await generateRealHistoricalData();
        setHistoricalData(historicalData);
        setIsStatsLoading(false);

      } catch (error) {
        console.error('Error fetching user stats:', error);
        toast.error('Failed to load your statistics');
        setIsStatsLoading(false);
      }
    }

    if (user) {
      fetchUserStats();
    } else {
      // Reset stats when user logs out
      setUserStats(null);
      setIsStatsLoading(false);
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



  const getPerformanceLevel = (accuracy: number) => {
    if (accuracy >= PERFORMANCE_CATEGORIES.EXCELLENT.min) return PERFORMANCE_CATEGORIES.EXCELLENT;
    if (accuracy >= PERFORMANCE_CATEGORIES.GOOD.min) return PERFORMANCE_CATEGORIES.GOOD;
    if (accuracy >= PERFORMANCE_CATEGORIES.FAIR.min) return PERFORMANCE_CATEGORIES.FAIR;
    return PERFORMANCE_CATEGORIES.NEEDS_IMPROVEMENT;
  };

  if (isLoading || (user && isStatsLoading)) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text={isLoading ? "Loading your dashboard..." : "Loading your statistics..."} />
        </div>
      </MainLayout>
    );
  }

  const totalQuestions = userStats ? (userStats.totalQuestionsAnswered.math + userStats.totalQuestionsAnswered.readingAndWriting) : 0;
  const hasStats = userStats && totalQuestions > 0;
  const performanceLevel = hasStats ? getPerformanceLevel(userStats.averageAccuracy) : null;

  // Chart configuration
  const chartConfig: ChartConfig = {
    overall: {
      label: "Overall",
      color: "hsl(220, 15%, 50%)", // Medium gray
    },
    math: {
      label: "Math", 
      color: "hsl(0, 80%, 60%)", // Vibrant red
    },
    readingWriting: {
      label: "Reading & Writing",
      color: "hsl(210, 80%, 55%)", // Vibrant blue
    },
  };

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
                {/* Key Stats - Single Row */}
                  <Card>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border p-6">
                    <div className="pb-6 sm:pb-0 sm:pr-6">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Overall Accuracy</p>
                        <p className="text-2xl font-bold leading-none">{userStats.averageAccuracy.toFixed(1)}%</p>
                      </div>
                    </div>
                  
                    <div className="py-6 sm:py-0 sm:px-6">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Study Time</p>
                        <p className="text-2xl font-bold leading-none">{Math.floor(userStats.totalTimeSpent / 60)}h {userStats.totalTimeSpent % 60}m</p>
                      </div>
                    </div>
                    
                    <div className="py-6 sm:py-0 sm:px-6">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Math</p>
                        <p className="text-2xl font-bold leading-none">{userStats.totalQuestionsAnswered.math} q.</p>
                      </div>
                    </div>
                  
                    <div className="pt-6 sm:pt-0 sm:pl-6">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Reading & Writing</p>
                        <p className="text-2xl font-bold leading-none">{userStats.totalQuestionsAnswered.readingAndWriting} q.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Historical Mastery Chart */}
                {historicalData.length > 0 && historicalData.some(d => d.overall !== null || d.math !== null || d.readingWriting !== null) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Mastery Progress (Last 7 Days)
                      </CardTitle>
                      <CardDescription>
                        Track your accuracy improvement across subjects
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                                          <ChartContainer config={chartConfig} className="h-[400px] w-full">
                        <LineChart data={historicalData} margin={{ top: 30, right: 40, left: 30, bottom: 30 }}>
                          <defs>
                            <linearGradient id="overallGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(220, 15%, 50%)" stopOpacity={0.25}/>
                              <stop offset="50%" stopColor="hsl(220, 15%, 50%)" stopOpacity={0.08}/>
                              <stop offset="100%" stopColor="hsl(220, 15%, 50%)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="mathGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(0, 80%, 60%)" stopOpacity={0.2}/>
                              <stop offset="50%" stopColor="hsl(0, 80%, 60%)" stopOpacity={0.08}/>
                              <stop offset="100%" stopColor="hsl(0, 80%, 60%)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="readingWritingGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(210, 80%, 55%)" stopOpacity={0.2}/>
                              <stop offset="50%" stopColor="hsl(210, 80%, 55%)" stopOpacity={0.08}/>
                              <stop offset="100%" stopColor="hsl(210, 80%, 55%)" stopOpacity={0}/>
                            </linearGradient>
                            
                            {/* Glow effects */}
                            <filter id="glow">
                              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                              <feMerge> 
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                              </feMerge>
                            </filter>
                          </defs>
                          <CartesianGrid 
                            strokeDasharray="2 4" 
                            stroke="hsl(var(--border))" 
                            strokeOpacity={0.3}
                            vertical={false}
                          />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={false}
                            tickLine={false}
                            tickMargin={12}
                            className="text-xs"
                          />
                          <YAxis 
                            domain={[0, 100]}
                            tick={{ fontSize: 14, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={false}
                            tickLine={false}
                            tickMargin={12}
                            width={40}
                            label={{ 
                              value: 'Accuracy (%)', 
                              angle: -90, 
                              position: 'insideLeft',
                              style: { 
                                textAnchor: 'middle', 
                                fontSize: '15px', 
                                fill: 'hsl(var(--muted-foreground))',
                                fontWeight: '500'
                              },
                              dx: -30
                            }}
                          />
                          <ChartTooltip 
                            content={
                              <ChartTooltipContent 
                                labelFormatter={(value) => value}
                                formatter={(value, name) => [
                                  `${value}%`,
                                  chartConfig[name as keyof typeof chartConfig]?.label || name
                                ]}
                                className="rounded-xl border border-border/20 bg-background/80 backdrop-blur-md shadow-2xl ring-1 ring-white/10"
                              />
                            }
                          />
                          <ChartLegend 
                            content={<ChartLegendContent className="justify-center pt-6 gap-6" />} 
                          />
                          
                          {/* Lines */}
                          <Line
                            type="monotone"
                            dataKey="overall"
                            stroke="hsl(220, 15%, 50%)"
                            strokeWidth={4}
                            strokeOpacity={1}
                            dot={false}
                            connectNulls={false}
                            activeDot={false}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <Line
                            type="monotone"
                            dataKey="math"
                            stroke="hsl(0, 80%, 60%)"
                            strokeWidth={4}
                            strokeOpacity={1}
                            dot={false}
                            connectNulls={false}
                            activeDot={false}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <Line
                            type="monotone"
                            dataKey="readingWriting"
                            stroke="hsl(210, 80%, 55%)"
                            strokeWidth={4}
                            strokeOpacity={1}
                            dot={false}
                            connectNulls={false}
                            activeDot={false}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}

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