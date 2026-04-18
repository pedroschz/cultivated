"use client";

import React, { useState, useEffect } from 'react';

import { auth, app } from '@/lib/firebaseClient';
import { adaptiveLearningService } from '@/lib/adaptive-learning/adaptive-service';
import { AdaptiveLearningData } from '@/lib/types/adaptive-learning';
import { 
  Card,
  CardContent
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CircularProgress } from '@/components/ui/progress-indicator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { DOMAIN_NAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { 
  getDomainName, 
  getSkillsForDomain,
  ALL_SKILLS 
} from '@/lib/adaptive-learning/skill-mapping';
import { WidgetLayoutCategory } from '@/lib/constants/widgets';

/**
 * @file This component displays a user's skill mastery progress across different
 * educational domains. It fetches adaptive learning data from Firebase and presents
 * it in an interactive UI with progress indicators, mastery levels, and detailed
 * breakdowns for each domain and subdomain. The component provides both overview
 * and detailed views of user progress, with expandable sections for deeper analysis.
 */

/**
 * Represents a simplified version of a subdomain score for UI display purposes.
 */
export interface SubdomainScore {
  competencyScore: number;
  confidenceLevel: number;
  lastPracticed: number;
  totalAttempts: number;
  correctCount: number;
  recentStreak: number;
  improvementRate: number;
  timeToMastery: number;
}

/**
 * Represents a domain summary with its subdomains and average competency.
 */
export interface DomainSummary {
  domainId: string;
  domainName: string;
  averageCompetency: number;
  subdomains: Array<{
    subdomainId: string;
    subdomainName: string;
    score: SubdomainScore;
  }>;
}

/**
 * Determines the mastery level and styling based on a competency score.
 * @param score - The competency score (0-100).
 * @returns An object containing the mastery level label and color classes.
 */
const getMasteryLevel = (score: number) => {
  if (score >= 90) return { label: 'Master', color: 'text-emerald-600', bg: 'bg-emerald-100' };
  if (score >= 75) return { label: 'Advanced', color: 'text-blue-600', bg: 'bg-blue-100' };
  if (score >= 60) return { label: 'Proficient', color: 'text-orange-600', bg: 'bg-orange-100' };
  if (score >= 40) return { label: 'Developing', color: 'text-yellow-600', bg: 'bg-yellow-100' };
  return { label: 'Beginner', color: 'text-red-600', bg: 'bg-red-100' };
};

/**
 * Determines if a domain is Math (0-3) or Reading & Writing (4-7).
 * @param domainId - The domain ID as a string.
 * @returns True if Math, false if Reading & Writing.
 */
const isMathDomain = (domainId: string): boolean => {
  const domainNum = parseInt(domainId, 10);
  return domainNum >= 0 && domainNum <= 3;
};

/**
 * Determines the progress bar color based on domain type and competency score.
 * Math domains use red shades, Reading & Writing domains use blue shades.
 * @param domainId - The domain ID as a string.
 * @param score - The competency score (0-100).
 * @returns A CSS color value for the progress bar.
 */
const getProgressColor = (domainId: string, score: number) => {
  const isMath = isMathDomain(domainId);
  
  if (isMath) {
    // Math domains
    return 'hsl(0, 72%, 50%)';
  } else {
    // Reading & Writing
    return 'hsl(217, 91%, 60%)';
  }
};

/**
 * Determines the progress bar background color based on domain type.
 * @param domainId - The domain ID as a string.
 * @returns A CSS color value for the progress bar background.
 */
const getProgressBackground = (domainId: string) => {
  const isMath = isMathDomain(domainId);
  // Very light background versions
  if (isMath) {
    return 'hsl(0, 72%, 95%)'; // Very light red
  } else {
    return 'hsl(217, 91%, 95%)'; // Very light blue
  }
};

/**
 * Maps long domain names to shorter versions for display in compact widgets.
 * @param domainName - The full domain name.
 * @returns A shortened version of the domain name if it's too long, otherwise the original.
 */
const getShortDomainName = (domainName: string): string => {
  const shortNameMap: Record<string, string> = {
    'Problem-Solving and Data Analysis': 'Data Analysis',
    'Geometry and Trigonometry': 'Geometry & Trig',
    'Information and Ideas': 'Information & Ideas',
    'Craft and Structure': 'Craft & Structure',
    'Expression of Ideas': 'Expression of Ideas',
    'Standard English Conventions': 'Conventions',
  };
  
  return shortNameMap[domainName] || domainName;
};

/**
 * Props for the SkillMastery component.
 */
interface SkillMasteryProps {
  /** Whether to show the overall mastery score card. */
  showOverall?: boolean;
  /** Render without outer card chrome for embedding in custom layouts. */
  embedded?: boolean;
  /** Initial data to display (skips fetching if provided). */
  data?: DomainSummary[];
  /** Overall mastery score (required if data is provided). */
  overallScore?: number;
  /** The layout category (minimal, minimal-vertical, minimal-horizontal, regular). */
  layoutCategory?: WidgetLayoutCategory;
  /** Widget width in grid units. */
  widgetWidth?: number;
  /** Widget height in grid units. */
  widgetHeight?: number;
}

/**
 * Determines if circular progress should be used based on widget size.
 * @param width - Widget width in grid units.
 * @param height - Widget height in grid units.
 * @param layoutCategory - The layout category.
 * @returns True if circular progress should be used.
 */
const shouldUseCircularProgress = (width?: number, height?: number, layoutCategory?: WidgetLayoutCategory): boolean => {
  if (!width || !height) return true; // Default to circular if size unknown
  // In regular layout, if width <= 5, use horizontal bar instead
  if (layoutCategory === 'regular' && width <= 5) return false;
  // Use circular progress when width >= 4 AND height >= 3
  return width >= 4 && height >= 3;
};

/**
 * Gets responsive padding classes based on widget size.
 * @param width - Widget width in grid units.
 * @param height - Widget height in grid units.
 * @returns Padding class string.
 */
const getPaddingScale = (width?: number, height?: number): string => {
  if (!width || !height) return 'p-4'; // Default padding
  // Small sizes: reduced padding but ensure minimum left/right
  if (width < 4 || height < 3) {
    return 'p-2';
  }
  // Medium sizes: moderate padding
  if (width < 6 && height < 5) {
    return 'p-3';
  }
  // Large sizes: full padding
  return 'p-4';
};

/**
 * Gets grid column classes based on aspect ratio and size.
 * @param width - Widget width in grid units.
 * @param height - Widget height in grid units.
 * @param layoutCategory - The layout category.
 * @returns Grid column class string.
 */
const getGridColumns = (width?: number, height?: number, layoutCategory?: WidgetLayoutCategory): string => {
  if (!width || !height) return 'grid-cols-1 md:grid-cols-2'; // Default
  if (layoutCategory === 'minimal-vertical') return 'grid-cols-1';
  if (layoutCategory === 'minimal-horizontal') return 'grid-cols-2';
  
  const aspectRatio = height / width;
  // Tall/narrow: prefer single column
  if (aspectRatio > 1.2) return 'grid-cols-1';
  // Wide/short: prefer two columns if space allows
  if (width >= 4 && height >= 3) return 'grid-cols-1 md:grid-cols-2';
  // Compact: single column
  return 'grid-cols-1';
};

/**
 * Gets the size for circular progress or height for bar progress.
 * @param width - Widget width in grid units.
 * @param height - Widget height in grid units.
 * @returns Size for circular progress or height for bar.
 */
const getProgressSize = (width?: number, height?: number): number => {
  if (!width || !height) return 45; // Default size
  // Scale based on available space - be more aggressive for smaller sizes
  const minDimension = Math.min(width, height);
  if (minDimension < 3) return 32; // Very small
  if (minDimension < 4) return 38; // Small
  if (minDimension < 5) return 42; // Medium-small
  return 45; // Normal
};

/**
 * A component that displays a user's skill mastery progress across educational domains.
 * It fetches adaptive learning data from Firebase and presents it in an interactive
 * UI with progress indicators and detailed breakdowns.
 * 
 * @param showOverall - Whether to display the overall mastery score card.
 * @returns A React component showing the user's skill mastery data.
 */
export function SkillMastery({ 
  showOverall = true, 
  embedded = false, 
  data, 
  overallScore = 0,
  layoutCategory,
  widgetWidth,
  widgetHeight
}: SkillMasteryProps) {
  // State for domain data, overall mastery, loading state, and dialog visibility
  const [domainData, setDomainData] = useState<DomainSummary[]>(data || []);
  const [overallMastery, setOverallMastery] = useState(overallScore);
  const [isLoading, setIsLoading] = useState(!data);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Fetch skill mastery data on component mount
  useEffect(() => {
    if (data) {
      setDomainData(data);
      setOverallMastery(overallScore);
      setIsLoading(false);
      return;
    }

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
          setOverallMastery(adaptiveLearningData.overallCompetency);
          // No need to initialize dialog states anymore
        } else {
          // Handle case where user doesn't have adaptive learning data yet
          console.log('No adaptive learning data available - user may need to complete onboarding or practice some questions first');
          setDomainData([]); // Show empty state
        }
      } catch (error) {
        console.error('Error fetching skill data:', error);
        setDomainData([]); // Show empty state on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchSkillData();
  }, []);

  /**
   * Opens the skill breakdown for a specific domain.
   * @param domainId - The ID of the domain to show.
   */
  const openDomainBreakdown = (domainId: string) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedDomainId(domainId);
      setIsTransitioning(false);
    }, 150); // Half of animation duration
  };

  /**
   * Closes the skill breakdown and returns to domain list.
   */
  const closeDomainBreakdown = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedDomainId(null);
      setIsTransitioning(false);
    }, 150);
  };

  /**
   * Converts adaptive learning data from the service into the format expected by the UI.
   * This function maps the complex adaptive learning data structure to a simpler
   * format for display purposes.
   * 
   * @param adaptiveLearningData - The raw adaptive learning data from the service.
   * @returns An array of domain summaries with subdomain details.
   */
  const convertAdaptiveLearningToUI = (adaptiveLearningData: AdaptiveLearningData): DomainSummary[] => {
    const domains: DomainSummary[] = [];
    
    // Build per-domain summaries from skills directly (no DOMAIN_RANGES)
    const byDomain = new Map<number, Array<{ subdomainId: string; subdomainName: string; score: SubdomainScore }>>();
    for (const m of ALL_SKILLS) {
      const score = adaptiveLearningData.subdomainScores[m.subdomainId];
      if (!score) continue;
      const list = byDomain.get(m.domain) || [];
      list.push({
        subdomainId: m.subdomainId,
        subdomainName: m.skill,
        score: {
          competencyScore: score.competencyScore,
          confidenceLevel: score.confidenceLevel,
          lastPracticed: score.lastPracticed,
          totalAttempts: score.totalAttempts,
          correctCount: score.correctCount,
          recentStreak: score.recentStreak,
          improvementRate: score.improvementRate,
          timeToMastery: score.timeToMastery,
        },
      });
      byDomain.set(m.domain, list);
    }
    for (const [domainNum, subs] of byDomain.entries()) {
      const avg = subs.length > 0 ? subs.reduce((s, x) => s + x.score.competencyScore, 0) / subs.length : 0;
      domains.push({
        domainId: String(domainNum),
        domainName: getDomainName(domainNum),
        averageCompetency: avg,
        subdomains: subs,
      });
    }

    // Sort domains: Math domains (0-3) first, then Reading & Writing domains (4-7)
    // Within each category, sort by mastery percentage (highest to lowest)
    domains.sort((a, b) => {
      const aNum = parseInt(a.domainId, 10);
      const bNum = parseInt(b.domainId, 10);
      const aIsMath = aNum >= 0 && aNum <= 3;
      const bIsMath = bNum >= 0 && bNum <= 3;
      
      // Math domains come first
      if (aIsMath && !bIsMath) return -1;
      if (!aIsMath && bIsMath) return 1;
      // Within same category, sort by mastery percentage (highest to lowest)
      return b.averageCompetency - a.averageCompetency;
    });

    return domains;
  };

  const overallLevel = getMasteryLevel(overallMastery);
  
  // Calculate responsive values
  const useCircular = shouldUseCircularProgress(widgetWidth, widgetHeight, layoutCategory);
  const paddingClasses = getPaddingScale(widgetWidth, widgetHeight);
  const gridColumns = getGridColumns(widgetWidth, widgetHeight, layoutCategory);
  const progressSize = getProgressSize(widgetWidth, widgetHeight);
  const isCompact = (widgetWidth && widgetWidth < 4) || (widgetHeight && widgetHeight < 3);
  const useHorizontalBarAbove = layoutCategory === 'regular' && widgetWidth && widgetWidth <= 5;

  // Organize domains for display
  // Split domains into Math and Reading & Writing
  const mathDomains = domainData.filter(d => isMathDomain(d.domainId));
  const rwDomains = domainData.filter(d => !isMathDomain(d.domainId));
  
  // Sort within each group by competency (highest first)
  mathDomains.sort((a, b) => b.averageCompetency - a.averageCompetency);
  rwDomains.sort((a, b) => b.averageCompetency - a.averageCompetency);
  
  const displayDomains: DomainSummary[] = [];
  const maxLen = Math.max(mathDomains.length, rwDomains.length);
  
  // Check if we're likely in 2-column mode based on gridColumns string
  // This is a heuristic based on the getGridColumns return values
  const isTwoColumn = gridColumns.includes('grid-cols-2');
    
  if (isTwoColumn) {
    // Interleave for 2-column layout (Math, RW, Math, RW...)
    // This works because the grid fills row by row: Col1(Math), Col2(RW)
    for (let i = 0; i < maxLen; i++) {
      // Column 1: Math
      if (i < mathDomains.length) {
        displayDomains.push(mathDomains[i]);
      } else if (i < rwDomains.length) {
        // If we ran out of Math domains but have RW domains, we need to skip a cell
        // to push RW to the second column. But CSS grid auto-placement doesn't easily allow skipping
        // without empty divs.
        // For simplicity, we just push the RW domain which will land in Col 1 if Math is done.
        // To truly fix this, we'd need to change the grid structure or use explicit grid-column.
        // Given the constraints, we'll just push what we have.
        // Ideally: Col 1 is Math, Col 2 is RW.
      }
      
      // Column 2: RW
      if (i < rwDomains.length) {
        displayDomains.push(rwDomains[i]);
      }
    }
  } else {
    // Single column: Math first, then R&W
    displayDomains.push(...mathDomains, ...rwDomains);
  }

  // Loading state with skeletons
  if (isLoading) {
    return (
      <div className="rounded-2xl border-2 border-border border-b-4 bg-card shadow-none h-[500px] p-6">
        <div className={cn("grid gap-4", gridColumns)}>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  // Empty state when no data is available
  if (domainData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", embedded ? "min-h-[200px]" : "min-h-[400px]")}>
        <Card className={cn("max-w-md shadow-none", embedded ? "border-0 bg-transparent" : "border-2 border-dashed border-border bg-transparent")}>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="h-12 w-12 mx-auto bg-muted rounded-full flex items-center justify-center">
              <span className="text-muted-foreground text-lg">📊</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">No Skill Data Available</h3>
              <p className="text-muted-foreground text-sm">
                Complete some practice questions to see your skill mastery progress here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  console.log('Domain Data:', domainData);

  const chromeClass = embedded ? "border-0 bg-transparent shadow-none" : "rounded-2xl border-2 border-border border-b-4 bg-card shadow-none";

  return (
    <div className={cn(embedded ? "space-y-4" : "space-y-6")}>
      {/* Overall Score Card */}
      {showOverall && (
        <Card className={chromeClass}>
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-medium text-foreground">Overall Mastery Level</span>
              </div>
              <div className="flex items-center justify-center gap-4">
                <div className="text-4xl font-bold text-foreground">{Math.round(overallMastery)}%</div>
                <Badge className={cn("px-3 py-1", overallLevel.bg, overallLevel.color)}>
                  {overallLevel.label}
                </Badge>
              </div>
              <Progress 
                value={overallMastery} 
                className="w-full max-w-md mx-auto h-3"
                style={{
                  '--progress-foreground': overallMastery >= 90 ? 'hsl(217, 91%, 60%)' : 
                                          overallMastery >= 75 ? 'hsl(217, 85%, 65%)' : 
                                          overallMastery >= 60 ? 'hsl(217, 80%, 70%)' : 
                                          overallMastery >= 40 ? 'hsl(217, 75%, 75%)' : 
                                          'hsl(217, 70%, 80%)',
                } as React.CSSProperties}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domain Details - Single Card */}
      <Card className={cn("overflow-hidden", chromeClass, embedded ? "h-full" : "h-[500px]")}>
        <CardContent className={cn("relative", embedded ? "p-0" : paddingClasses, "h-full")}>
          {selectedDomainId ? (
            /* Skill Breakdown View */
            <div className={cn(
              "h-full overflow-y-auto",
              isTransitioning ? "opacity-0 transition-opacity duration-300 ease-out" : "opacity-100 transition-opacity duration-300 ease-in"
            )}>
              {(() => {
                const selectedDomain = domainData.find(d => d.domainId === selectedDomainId);
                if (!selectedDomain) return null;
            
            return (
                  <div className="space-y-4">
                    {/* Back button and header */}
                    <div className="flex items-center gap-3 pb-2 border-b border-border">
                      <button
                        onClick={closeDomainBreakdown}
                        className="p-1 hover:bg-muted/50 rounded-lg transition-colors"
                        aria-label="Back to domains"
                      >
                        <ChevronLeft className="h-5 w-5 text-foreground" />
                      </button>
                      <h3 className="text-lg font-bold text-foreground">{selectedDomain.domainName} Skills</h3>
                    </div>
                    
                    {/* Skills list */}
                    <div className="space-y-2">
                      {selectedDomain.subdomains.map((subdomain) => {
                          const daysSinceLastPractice = Math.floor((Date.now() - subdomain.score.lastPracticed) / (1000 * 60 * 60 * 24));
                          const hasAttempts = (subdomain.score.totalAttempts || 0) > 0;
                          const accuracyPct = hasAttempts
                            ? Math.round((subdomain.score.correctCount / subdomain.score.totalAttempts) * 100)
                            : 0;
                          const lastPracticedLabel = hasAttempts ? `${daysSinceLastPractice}d ago` : 'never';

                          return (
                            <div key={subdomain.subdomainId} className="p-3 rounded-xl border-2 border-border bg-card hover:bg-muted/20 transition-colors text-sm">
                              <h4 className="font-bold mb-1 text-foreground">{subdomain.subdomainName}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                <span>{subdomain.score.totalAttempts} questions</span>
                                <span>•</span>
                                <span>{accuracyPct}% accuracy</span>
                                <span>•</span>
                                <span>{lastPracticedLabel}</span>
                                <Badge className={cn("text-xs ml-auto font-bold", getMasteryLevel(subdomain.score.competencyScore).bg, getMasteryLevel(subdomain.score.competencyScore).color)}>
                                  {Math.round(subdomain.score.competencyScore)}%
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Domain List View */
            <div className={cn(
              "grid", gridColumns, isCompact ? "gap-2" : "gap-x-3 gap-y-4",
              isTransitioning ? "opacity-0 transition-opacity duration-300 ease-out" : "opacity-100 transition-opacity duration-300 ease-in"
            )}>
              {displayDomains.map((domain, index) => {
            const isLastDomain = index === displayDomains.length - 1;
            const domainPadding = isCompact ? "px-2.5 py-2" : "px-3 py-3";
            const domainGap = isCompact ? "gap-2.5" : "gap-3";
            const titleSize = isCompact ? "text-base" : "text-lg";
            const subtitleSize = isCompact ? "text-[10px]" : "text-xs";
            const progressBarHeight = isCompact ? "h-2" : "h-2.5";
            
            return (
              <div key={domain.domainId} className={cn("pb-0")}>
                <div 
                  onClick={() => openDomainBreakdown(domain.domainId)}
                  className={cn(
                    domainPadding,
                    "cursor-pointer hover:bg-muted/50 transition-colors rounded-xl border-2 border-transparent hover:border-border",
                    isCompact && "rounded-lg",
                    useHorizontalBarAbove ? "flex flex-col" : "flex items-center justify-between"
                  )}
                >
                      {useHorizontalBarAbove ? (
                        /* Horizontal bar above title for regular layout with width < 5 */
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={cn("text-xs font-bold text-foreground", isCompact && "text-[10px]")}>
                              {Math.round(domain.averageCompetency)}%
                            </span>
                            <span className={cn(subtitleSize, "text-muted-foreground font-bold uppercase tracking-wide")}>
                              {domain.subdomains.length} skills
                            </span>
                          </div>
                          <Progress 
                            value={domain.averageCompetency} 
                            className={cn("w-full mb-2", progressBarHeight)}
                            style={{
                              '--progress-foreground': getProgressColor(domain.domainId, domain.averageCompetency),
                              backgroundColor: getProgressBackground(domain.domainId),
                            } as React.CSSProperties}
                          />
                          <div className="flex items-center justify-between">
                            <h3 className={cn(titleSize, "font-bold text-foreground truncate flex-1")} title={domain.domainName}>
                              {getShortDomainName(domain.domainName)}
                            </h3>
                            <ChevronRight className={cn(
                              "text-muted-foreground stroke-[3px] shrink-0 ml-2",
                              isCompact ? "h-4 w-4" : "h-5 w-5"
                            )} />
                          </div>
                        </>
                      ) : (
                        /* Original layout with circular or side bar */
                        <>
                          <div className={cn("flex items-center", domainGap, isCompact ? "flex-1 min-w-0" : "")}>
                            {useCircular ? (
                              /* Circular progress for larger sizes */
                              <CircularProgress 
                                value={domain.averageCompetency}
                                size={progressSize}
                                strokeWidth={isCompact ? 3 : 4}
                                className="shrink-0"
                                style={{ color: getProgressColor(domain.domainId, domain.averageCompetency) }}
                              >
                                <span className={cn("font-bold text-foreground", isCompact ? "text-xs" : "text-sm")}>
                                  {Math.round(domain.averageCompetency)}%
                                </span>
                              </CircularProgress>
                            ) : (
                              /* Bar progress for smaller sizes */
                              <div className="flex flex-col items-center shrink-0 min-w-[50px]">
                                <div className={cn("text-xs font-bold text-foreground", isCompact && "text-[10px]")}>
                                  {Math.round(domain.averageCompetency)}%
                                </div>
                                <Progress 
                                  value={domain.averageCompetency} 
                                  className={cn("w-full", progressBarHeight)}
                                  style={{
                                    '--progress-foreground': getProgressColor(domain.domainId, domain.averageCompetency),
                                    backgroundColor: getProgressBackground(domain.domainId),
                                  } as React.CSSProperties}
                                />
                              </div>
                            )}
                            <div className={cn("min-w-0 flex-1", isCompact ? "" : "")}>
                              <h3 className={cn(titleSize, "font-bold text-foreground truncate")} title={domain.domainName}>
                                {getShortDomainName(domain.domainName)}
                              </h3>
                              <p className={cn(subtitleSize, "text-muted-foreground font-bold uppercase tracking-wide truncate")}>
                                {domain.subdomains.length} skills
                              </p>
                            </div>
                          </div>
                          <ChevronRight className={cn(
                            "text-muted-foreground stroke-[3px] shrink-0",
                            isCompact ? "h-4 w-4" : "h-5 w-5"
                          )} />
                        </>
                      )}
                </div>
              </div>
            );
          })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
