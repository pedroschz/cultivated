"use client";

import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { auth, app } from '@/lib/firebaseClient';
import { adaptiveLearningService } from '@/lib/adaptive-learning/adaptive-service';
import { AdaptiveLearningData } from '@/lib/types/adaptive-learning';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Brain,
  TrendingUp,
  Target,
  Award,
  BookOpen,
  Calculator,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Star,
  Flame,
  Trophy,
  Clock,
  Zap
} from 'lucide-react';
import { DOMAIN_NAMES, SUBDOMAIN_NAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface SubdomainScore {
  competencyScore: number;
  confidenceLevel: number;
  lastPracticed: number;
  totalAttempts: number;
  correctCount: number;
  recentStreak: number;
  improvementRate: number;
  timeToMastery: number;
}

interface DomainSummary {
  domainId: string;
  domainName: string;
  averageCompetency: number;
  subdomains: Array<{
    subdomainId: string;
    subdomainName: string;
    score: SubdomainScore;
  }>;
  icon: React.ElementType;
  color: string;
  gradient: string;
}

const DOMAIN_CONFIG = {
  'math': {
    '0': { icon: Calculator, color: 'blue', gradient: 'from-blue-500 to-blue-600' },
    '1': { icon: BarChart3, color: 'green', gradient: 'from-green-500 to-green-600' },
    '2': { icon: Brain, color: 'purple', gradient: 'from-purple-500 to-purple-600' },
    '3': { icon: Target, color: 'orange', gradient: 'from-orange-500 to-orange-600' },
  },
  'readingAndWriting': {
    '4': { icon: BookOpen, color: 'pink', gradient: 'from-pink-500 to-pink-600' },
    '5': { icon: Award, color: 'indigo', gradient: 'from-indigo-500 to-indigo-600' },
    '6': { icon: TrendingUp, color: 'teal', gradient: 'from-teal-500 to-teal-600' },
    '7': { icon: Star, color: 'amber', gradient: 'from-amber-500 to-amber-600' },
  }
};

const getMasteryLevel = (score: number) => {
  if (score >= 90) return { label: 'Master', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: Trophy };
  if (score >= 75) return { label: 'Advanced', color: 'text-blue-600', bg: 'bg-blue-100', icon: Star };
  if (score >= 60) return { label: 'Proficient', color: 'text-orange-600', bg: 'bg-orange-100', icon: Target };
  if (score >= 40) return { label: 'Developing', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: TrendingUp };
  return { label: 'Beginner', color: 'text-red-600', bg: 'bg-red-100', icon: BookOpen };
};

const getProgressColor = (score: number) => {
  if (score >= 90) return 'hsl(var(--chart-1))';
  if (score >= 75) return 'hsl(var(--chart-2))';
  if (score >= 60) return 'hsl(var(--chart-3))';
  if (score >= 40) return 'hsl(var(--chart-4))';
  return 'hsl(var(--chart-5))';
};

export function SkillMastery() {
  const [domainData, setDomainData] = useState<DomainSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed'>('overview');

  useEffect(() => {
    async function fetchSkillData() {
      if (!auth?.currentUser || !app) {
        setIsLoading(false);
        return;
      }

      try {
        // Get adaptive learning data from the service
        const adaptiveLearningData = await adaptiveLearningService.getUserAdaptiveLearningData(auth.currentUser.uid);
        
        if (adaptiveLearningData) {
          // Convert real data to the format expected by the UI
          const realData = convertAdaptiveLearningToUI(adaptiveLearningData);
          setDomainData(realData);
        }
      } catch (error) {
        console.error('Error fetching skill data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSkillData();
  }, []);

  const convertAdaptiveLearningToUI = (adaptiveLearningData: AdaptiveLearningData): DomainSummary[] => {
    const domains: DomainSummary[] = [];
    
    // Domain ranges mapping
    const domainRanges: { [key: number]: [number, number] } = {
      0: [0, 7],   // Algebra: 0-7
      1: [8, 17],  // Problem Solving: 8-17
      2: [18, 30], // Advanced Math: 18-30
      3: [31, 36], // Geometry: 31-36
      4: [37, 39], // Information and Ideas: 37-39
      5: [40, 42], // Craft and Structure: 40-42
      6: [43, 44], // Expression of Ideas: 43-44
      7: [45, 46], // Standard English: 45-46
    };

    // Process each domain
    for (let domainId = 0; domainId <= 7; domainId++) {
      const [start, end] = domainRanges[domainId];
      const subdomains: Array<{subdomainId: string; subdomainName: string; score: SubdomainScore}> = [];
      let totalCompetency = 0;
      let subdomainCount = 0;

      // Get subdomains for this domain
      for (let subId = start; subId <= end; subId++) {
        const subdomainId = subId.toString();
        const adaptiveScore = adaptiveLearningData.subdomainScores[subdomainId];
        
        if (adaptiveScore) {
          subdomains.push({
            subdomainId,
            subdomainName: SUBDOMAIN_NAMES[subdomainId] || `Subdomain ${subId}`,
            score: {
              competencyScore: adaptiveScore.competencyScore,
              confidenceLevel: adaptiveScore.confidenceLevel,
              lastPracticed: adaptiveScore.lastPracticed,
              totalAttempts: adaptiveScore.totalAttempts,
              correctCount: adaptiveScore.correctCount,
              recentStreak: adaptiveScore.recentStreak,
              improvementRate: adaptiveScore.improvementRate,
              timeToMastery: adaptiveScore.timeToMastery
            }
          });
          
          totalCompetency += adaptiveScore.competencyScore;
          subdomainCount++;
        }
      }

      // Get domain configuration
      const isMath = domainId <= 3;
      let config: { icon: React.ElementType; color: string; gradient: string };
      
      if (isMath) {
        config = DOMAIN_CONFIG.math[domainId.toString() as keyof typeof DOMAIN_CONFIG.math];
      } else {
        config = DOMAIN_CONFIG.readingAndWriting[domainId.toString() as keyof typeof DOMAIN_CONFIG.readingAndWriting];
      }

      domains.push({
        domainId: domainId.toString(),
        domainName: DOMAIN_NAMES[domainId.toString()] || `Domain ${domainId}`,
        averageCompetency: subdomainCount > 0 ? totalCompetency / subdomainCount : 0,
        subdomains,
        icon: config.icon,
        color: config.color,
        gradient: config.gradient
      });
    }

    return domains;
  };



  const toggleDomain = (domainId: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domainId)) {
      newExpanded.delete(domainId);
    } else {
      newExpanded.add(domainId);
    }
    setExpandedDomains(newExpanded);
  };

  const overallAverage = domainData.length > 0 
    ? domainData.reduce((sum, domain) => sum + domain.averageCompetency, 0) / domainData.length 
    : 0;

  const overallLevel = getMasteryLevel(overallAverage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Brain className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading your skill mastery data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className={`p-3 rounded-full bg-gradient-to-r ${overallLevel.bg.replace('bg-', 'from-').replace('-100', '-200')} to-transparent`}>
            <overallLevel.icon className={`h-8 w-8 ${overallLevel.color}`} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Skill Mastery Dashboard</h1>
            <p className="text-muted-foreground">Track your competency across all SAT domains</p>
          </div>
        </div>
        
        {/* Overall Score Card */}
        <Card className="border-2 border-dashed border-muted-foreground/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="text-lg font-medium">Overall Mastery Level</span>
              </div>
              <div className="flex items-center justify-center gap-4">
                <div className="text-4xl font-bold">{Math.round(overallAverage)}%</div>
                <Badge className={cn("px-3 py-1", overallLevel.bg, overallLevel.color)}>
                  {overallLevel.label}
                </Badge>
              </div>
              <Progress 
                value={overallAverage} 
                className="w-full max-w-md mx-auto h-3"
                style={{
                  '--progress-foreground': getProgressColor(overallAverage),
                } as React.CSSProperties}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as 'overview' | 'detailed')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detailed">Detailed View</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Domain Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {domainData.map((domain) => {
              const Icon = domain.icon;
              const level = getMasteryLevel(domain.averageCompetency);
              
              return (
                <Card key={domain.domainId} className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20" onClick={() => toggleDomain(domain.domainId)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-lg bg-gradient-to-r ${domain.gradient} text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge className={cn("text-xs", level.bg, level.color)}>
                        {level.label}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg leading-tight">{domain.domainName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{Math.round(domain.averageCompetency)}%</span>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <ChevronRight className="h-4 w-4" />
                        <span className="text-sm">{domain.subdomains.length} skills</span>
                      </div>
                    </div>
                    <Progress 
                      value={domain.averageCompetency} 
                      className="h-2"
                      style={{
                        '--progress-foreground': getProgressColor(domain.averageCompetency),
                      } as React.CSSProperties}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-6">
          {domainData.map((domain) => {
            const Icon = domain.icon;
            const isExpanded = expandedDomains.has(domain.domainId);
            
            return (
              <Card key={domain.domainId} className="overflow-hidden">
                <Collapsible 
                  open={isExpanded} 
                  onOpenChange={() => toggleDomain(domain.domainId)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg bg-gradient-to-r ${domain.gradient} text-white`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">{domain.domainName}</CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              <span>{domain.subdomains.length} subdomains</span>
                              <span>•</span>
                              <span>{Math.round(domain.averageCompetency)}% mastery</span>
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={cn("px-3 py-1", getMasteryLevel(domain.averageCompetency).bg, getMasteryLevel(domain.averageCompetency).color)}>
                            {getMasteryLevel(domain.averageCompetency).label}
                          </Badge>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {domain.subdomains.map((subdomain) => {
                          const subLevel = getMasteryLevel(subdomain.score.competencyScore);
                          const daysSinceLastPractice = Math.floor((Date.now() - subdomain.score.lastPracticed) / (1000 * 60 * 60 * 24));
                          
                          return (
                            <div key={subdomain.subdomainId} className="p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-medium">{subdomain.subdomainName}</h4>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                    <span>{subdomain.score.totalAttempts} attempts</span>
                                    <span>•</span>
                                    <span>{Math.round((subdomain.score.correctCount / subdomain.score.totalAttempts) * 100)}% accuracy</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {daysSinceLastPractice}d ago
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <div className="flex items-center gap-1">
                                          {subdomain.score.recentStreak > 0 ? (
                                            <Flame className="h-4 w-4 text-orange-500" />
                                          ) : subdomain.score.recentStreak < -1 ? (
                                            <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
                                          ) : (
                                            <Zap className="h-4 w-4 text-gray-400" />
                                          )}
                                          <span className="text-sm font-medium">
                                            {subdomain.score.recentStreak > 0 ? `+${subdomain.score.recentStreak}` : subdomain.score.recentStreak}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Recent streak: {subdomain.score.recentStreak} questions</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  
                                  <Badge className={cn("text-xs", subLevel.bg, subLevel.color)}>
                                    {Math.round(subdomain.score.competencyScore)}%
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Competency</span>
                                  <span className="font-medium">{Math.round(subdomain.score.competencyScore)}%</span>
                                </div>
                                <Progress 
                                  value={subdomain.score.competencyScore} 
                                  className="h-2"
                                  style={{
                                    '--progress-foreground': getProgressColor(subdomain.score.competencyScore),
                                  } as React.CSSProperties}
                                />
                                
                                <div className="flex justify-between text-sm">
                                  <span>Confidence</span>
                                  <span className="font-medium">{Math.round(subdomain.score.confidenceLevel)}%</span>
                                </div>
                                <Progress 
                                  value={subdomain.score.confidenceLevel} 
                                  className="h-1"
                                  style={{
                                    '--progress-foreground': getProgressColor(subdomain.score.confidenceLevel),
                                  } as React.CSSProperties}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
} 