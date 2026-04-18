import React, { useState, useEffect } from 'react';
import { 
  PracticeSession 
} from '@/lib/types/practice';
import { Button } from '@/components/ui/button';
import { sanitizeText } from '@/lib/utils/questionHelpers';
import { cn } from '@/lib/utils';
import { 
  Clock, 
  Home,
  RotateCcw, 
  TrendingUp,
} from 'lucide-react';
import { getBatchQuestionStats } from '@/lib/stats/questionStats';

/**
 * A simple SVG Bell Curve (Histogram) component to visualize student performance.
 * It visualizes the user's standardized performance (Z-score) on a normal distribution.
 * 
 * The X-axis represents Standard Deviations from the mean.
 * 0 = Average Pace
 * Positive = Faster than average
 * Negative = Slower than average
 */
function PaceHistogram({ zScore }: { zScore: number }) {
  // Plot range Z: -3 to 3
  const width = 300;
  const height = 100;
  const xMin = -3;
  const xMax = 3;
  const barCount = 40;
  const barWidth = (width / barCount) - 2; // 2px gap
  
  // Standard Normal PDF
  const pdf = (x: number) => Math.exp(-0.5 * x * x);

  // Generate bars
  const bars = [];
  for (let i = 0; i < barCount; i++) {
    // Calculate center X of this bar in Z-space
    const z = xMin + (i / (barCount - 1)) * (xMax - xMin);
    
    // Height based on normal distribution
    // We add slight pseudo-random noise based on index to make it look "organic" 
    // but deterministic so it doesn't flicker
    const noise = (Math.sin(i * 132.1) * 0.05) + (Math.cos(i * 12.7) * 0.05); 
    const yValue = pdf(z) * (1 + noise);
    
    const barHeight = Math.max(2, yValue * height * 0.8); // Min height 2px
    const xPos = (i / barCount) * width;
    
    // Determine if this bar represents the user's bucket
    // User Z-score falls within this bar's range?
    const zStart = xMin + (i / barCount) * (xMax - xMin);
    const zEnd = xMin + ((i + 1) / barCount) * (xMax - xMin);
    const isUserBar = zScore >= zStart && zScore < zEnd;

    bars.push(
      <rect
        key={i}
        x={xPos}
        y={height - barHeight}
        width={barWidth}
        height={barHeight}
        rx={2} // Rounded tops
        className={cn(
          "transition-all duration-500 ease-out",
          isUserBar ? "fill-primary" : "fill-muted/30"
        )}
      />
    );
  }

  // Calculate percentile for text
  const cdf = (z: number) => {
    const t = 1 / (1 + 0.3275911 * Math.abs(z));
    const result = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return Math.sign(z) * result;
  };
  const percentile = Math.round(0.5 * (1 + cdf(zScore)) * 100);

  // Marker position
  const clampedZ = Math.max(xMin, Math.min(zScore, xMax));
  const markerX = ((clampedZ - xMin) / (xMax - xMin)) * width;

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <div className="relative w-full max-w-sm h-[120px] flex items-end justify-between">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {bars}
          
          {/* User Marker Line (Optional if bar is highlighted) */}
          <line 
            x1={markerX} y1={-10} 
            x2={markerX} y2={height} 
            className="stroke-primary stroke-[2px] stroke-dasharray-4 opacity-50" 
          />
        </svg>
        
        {/* Floating Tooltip */}
        <div 
          className="absolute top-0 -translate-y-full -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-10"
          style={{ left: `${(markerX / width) * 100}%` }}
        >
          You (Top {Math.max(1, 100 - percentile)}%)
        </div>
      </div>
      
      {/* Labels below chart */}
      <div className="w-full max-w-sm flex justify-between text-xs text-muted-foreground font-medium uppercase tracking-wider pt-2">
        <span>Slower</span>
        <span>Avg</span>
        <span>Faster</span>
      </div>
      
      <div className="text-center space-y-1 pt-2">
        <p className="text-2xl font-black text-foreground">
          Faster than {percentile}%
        </p>
        <p className="text-sm text-muted-foreground font-medium">
          normalized pace score
        </p>
      </div>
    </div>
  );
}

interface SessionSummaryProps {
  session: PracticeSession;
  skillDeltas: { [skill: string]: number };
  onPracticeAgain: () => void;
  onReturnToDashboard: () => void;
}

export function SessionSummary({ 
  session, 
  skillDeltas, 
  onPracticeAgain, 
  onReturnToDashboard 
}: SessionSummaryProps) {
  const [averageZScore, setAverageZScore] = useState<number | null>(null);

  // Calculate stats
  const totalQuestions = Object.values(session.userAnswers).length;
  const correctAnswers = Object.values(session.userAnswers).filter(a => a.isCorrect).length;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  
  // Calculate time stats
  const totalTimeSeconds = Object.values(session.userAnswers).reduce((acc, curr) => acc + (curr.timeSpent || 0), 0);
  const averageTimeSeconds = totalQuestions > 0 ? Math.round(totalTimeSeconds / totalQuestions) : 0;
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  // Find top 3 improved skills (positive only)
  const topSkills = Object.entries(skillDeltas)
    .filter(([, delta]) => delta > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  // Fetch aggregated stats on mount
  useEffect(() => {
    async function loadStats() {
      const questionIds = session.questions.map(q => q.id);
      if (questionIds.length === 0) return;

      const statsMap = await getBatchQuestionStats(questionIds);
      
      let sumZScores = 0;
      let count = 0;

      // Debug: Log all question data
      console.log('=== SESSION END DEBUG: Question Time Analysis ===');
      const questionData: Array<{
        questionId: string;
        userTime: number;
        averageTime: number | null;
        stdDev: number | null;
        totalAttempts: number | null;
        zScore: number | null;
        used: boolean;
      }> = [];

      session.questions.forEach(q => {
        const stats = statsMap[q.id];
        const userAnswer = session.userAnswers[q.id];
        
        if (stats && userAnswer && stats.totalAttempts > 5) { // Need minimum sample size
          const userTime = userAnswer.timeSpent;
          const avg = stats.averageTime;
          // Use stored stdDev if available, else estimate (heuristic: coefficient of variation ~ 0.4)
          const stdDev = stats.stdDev || (avg * 0.4) || 1; 
          
          // Calculate Z-score for Time
          // Note: Lower time is BETTER (faster). 
          // Standard Z = (X - Mean) / SD
          // If X < Mean (faster), Z is negative.
          // BUT for "Performance Score", we want Positive = Better.
          // So we invert the Z-score: (Mean - X) / SD
          const z = (avg - userTime) / stdDev;
          
          questionData.push({
            questionId: q.id,
            userTime,
            averageTime: avg,
            stdDev,
            totalAttempts: stats.totalAttempts,
            zScore: z,
            used: true,
          });
          
          sumZScores += z;
          count++;
        } else if (userAnswer) {
           // Fallback for new questions: assume Average (Z=0)
          questionData.push({
            questionId: q.id,
            userTime: userAnswer.timeSpent,
            averageTime: stats?.averageTime || null,
            stdDev: stats?.stdDev || null,
            totalAttempts: stats?.totalAttempts || null,
            zScore: 0,
            used: true,
          });
           sumZScores += 0; 
           count++;
        } else {
          questionData.push({
            questionId: q.id,
            userTime: 0,
            averageTime: stats?.averageTime || null,
            stdDev: stats?.stdDev || null,
            totalAttempts: stats?.totalAttempts || null,
            zScore: null,
            used: false,
          });
        }
      });

      // Log each question's data
      console.log('\n--- Individual Question Data ---');
      questionData.forEach((data, idx) => {
        console.log(`Question ${idx + 1} (ID: ${data.questionId.substring(0, 8)}...):`, {
          userTime: `${data.userTime.toFixed(2)}s`,
          averageTime: data.averageTime !== null ? `${data.averageTime.toFixed(2)}s` : 'N/A',
          stdDev: data.stdDev !== null ? `${data.stdDev.toFixed(2)}s` : 'N/A',
          totalAttempts: data.totalAttempts || 'N/A',
          zScore: data.zScore !== null ? data.zScore.toFixed(3) : 'N/A',
          used: data.used ? '✓' : '✗',
        });
      });

      const averageZScore = count > 0 ? sumZScores / count : null;

      // Log aggregated data
      console.log('\n--- Aggregated Statistics ---');
      console.log({
        totalQuestions: session.questions.length,
        questionsUsed: count,
        sumZScores: sumZScores.toFixed(3),
        averageZScore: averageZScore !== null ? averageZScore.toFixed(3) : 'N/A',
      });

      // Log percentile calculation details
      if (averageZScore !== null) {
        const cdf = (z: number) => {
          const t = 1 / (1 + 0.3275911 * Math.abs(z));
          const result = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
          return Math.sign(z) * result;
        };
        const cdfValue = cdf(averageZScore);
        const percentile = Math.round(0.5 * (1 + cdfValue) * 100);
        
        console.log('\n--- Percentile Calculation ---');
        console.log({
          averageZScore: averageZScore.toFixed(6),
          cdfValue: cdfValue.toFixed(6),
          percentile: `${percentile}%`,
          topPercentile: `${100 - percentile}%`,
        });
      }

      console.log('=== END SESSION DEBUG ===\n');

      if (count > 0) {
        setAverageZScore(averageZScore);
      } else {
        setAverageZScore(null);
      }
    }
    
    loadStats();
  }, [session.questions, session.userAnswers]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-12 animate-in fade-in duration-700">
      
      {/* Hero Section: Typography Driven */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 pb-8 border-b border-border/40">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground">
            Session Complete
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-medium">
            You answered <span className="text-foreground font-bold">{correctAnswers}</span> out of <span className="text-foreground font-bold">{totalQuestions}</span> correctly in <span className="text-foreground font-bold">{formatTime(totalTimeSeconds)}</span>.
          </p>
        </div>
        
        <div className="text-right flex flex-col items-end">
          <div className="text-7xl md:text-9xl font-black text-primary leading-none tracking-tighter">
            {accuracy}%
          </div>
          <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground mt-2">
            Accuracy Score
          </div>
        </div>
      </div>

      {/* Top Skills & Pace Section: Clean Typography */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-border/40 pt-12">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-green-600">
            <TrendingUp className="w-5 h-5" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Top Skill Gains</h2>
          </div>
          
          {topSkills.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
            {topSkills.map(([skill, delta], idx) => (
              <div key={skill} className="flex flex-col space-y-3 p-6 rounded-3xl bg-muted/20 border-2 border-transparent hover:border-green-100 hover:bg-green-50/50 transition-colors">
                <span className="text-4xl font-black tracking-tight text-green-600">
                  +{delta.toFixed(1)}%
                </span>
                <span className="font-bold text-foreground text-lg leading-tight line-clamp-2">
                  {skill}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  Gain
                </span>
              </div>
            ))}
          </div>
          ) : (
            <div className="opacity-50 p-6 rounded-2xl bg-muted/30 border border-border/40">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                No significant change
              </div>
              <p className="text-muted-foreground font-medium mt-1">
                Keep practicing to improve your mastery score.
              </p>
            </div>
          )}
        </div>

        {/* Pace Histogram Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <Clock className="w-5 h-5" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Pace Analysis</h2>
          </div>
          <div className="p-8 rounded-3xl bg-muted/20 border-2 border-transparent h-full flex flex-col justify-center items-center min-h-[300px]">
            {averageZScore !== null ? (
              <PaceHistogram zScore={averageZScore} />
            ) : (
              <div className="text-muted-foreground text-sm">Loading pace data...</div>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row gap-6 pt-8 border-t border-border/40">
        <Button 
          onClick={onReturnToDashboard} 
          variant="outline" 
          size="lg" 
          className="flex-1 h-14 text-base font-bold tracking-wider uppercase"
        >
          <Home className="w-4 h-4 mr-2" />
          Dashboard
        </Button>
        <Button 
          onClick={onPracticeAgain} 
          size="lg" 
          className="flex-1 h-14 text-base font-bold tracking-wider uppercase shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Practice Again
        </Button>
      </div>
    </div>
  );
}

