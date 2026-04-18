"use client";

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebaseClient';
import { doc, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Star } from 'lucide-react';

/**
 * @file This component displays a user's score history and calculates their superscore.
 * It shows both official and practice test scores, tracks improvement over time,
 * and provides a real-time view of the user's performance data from Firebase.
 */

/**
 * Represents a single test score with math and reading/writing components.
 */
interface Score {
  math: number;
  readingAndWriting: number;
  testDate: string;
  testType: 'official' | 'bluebook';
  notes?: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

/**
 * A component that calculates and displays the user's superscore.
 * The superscore is the sum of the best math and best reading/writing scores.
 * 
 * @param scores - Array of all user scores to calculate the superscore from.
 * @returns A React component showing the superscore calculation.
 */
const Superscore = ({ scores }: { scores: Score[] }) => {
  if (!scores || scores.length === 0) {
    return (
      <div className="text-center">
        <p className="text-4xl font-bold">-</p>
        <p className="text-sm text-muted-foreground">No scores yet</p>
      </div>
    );
  }

  // Calculate the best scores from each section
  const bestMath = Math.max(...scores.map(s => s.math));
  const bestRW = Math.max(...scores.map(s => s.readingAndWriting));
  const superScore = bestMath + bestRW;

  return (
    <div className="text-center p-6 bg-primary/5 rounded-lg">
      <div className="flex items-center justify-center gap-2">
        <Star className="h-6 w-6 text-yellow-500" />
        <CardTitle>Your Superscore</CardTitle>
      </div>
      <p className="text-6xl font-bold tracking-tight text-primary mt-2">{superScore}</p>
      <div className="flex justify-center gap-6 mt-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Best Math: </span>
          <span className="font-semibold">{bestMath}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Best R&W: </span>
          <span className="font-semibold">{bestRW}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * A component that displays a single score entry with its details.
 * Shows the total score, test type, date, and individual section scores.
 * 
 * @param score - The score object to display.
 * @returns A React component showing a single score entry.
 */
const ScoreItem = ({ score }: { score: Score }) => {
  const total = score.math + score.readingAndWriting;
  const date = new Date(score.testDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <li className="space-y-3 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-2xl font-bold">{total}</p>
          <Badge variant={score.testType === 'official' ? 'default' : 'secondary'}>
            {score.testType === 'official' ? 'Official' : 'Practice'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{date}</p>
      </div>
      <div className="flex gap-4 text-sm">
        <span>Math: <span className="font-medium">{score.math}</span></span>
        <span>R&W: <span className="font-medium">{score.readingAndWriting}</span></span>
      </div>
      {score.notes && (
        <p className="text-sm text-muted-foreground pt-1 border-t border-dashed mt-2">
          {score.notes}
        </p>
      )}
    </li>
  );
};

/**
 * A component that displays a user's complete score history and superscore.
 * It fetches real-time data from Firebase and provides an interactive view
 * of the user's test performance over time.
 * 
 * @returns A React component showing the user's score history and superscore.
 */
export function ScoresList() {
  // State for user authentication, scores data, and loading status
  const [user, setUser] = useState<User | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Listen for authentication state changes
  useEffect(() => {
    if (!auth) return;
    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => authUnsubscribe();
  }, []);

  // Fetch and listen for real-time score updates when user is authenticated
  useEffect(() => {
    if (user && db) {
      setIsLoading(true);
      const userRef = doc(db, 'users', user.uid);
      
      // Set up real-time listener for score changes
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          const userScores = (userData.scores || []) as Score[];
          // Sort scores chronologically, newest first
          userScores.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());
          setScores(userScores);
        }
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching scores:", error);
        setIsLoading(false);
      });

      return () => unsubscribe();
    } else {
      setScores([]); // Clear scores if no user
      setIsLoading(false);
    }
  }, [user]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Score History</CardTitle>
        <CardDescription>Review your past performance and track your improvement.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Superscore calculation and display */}
        <Superscore scores={scores} />
        <Separator />
        
        {/* Score history list with loading and empty states */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : scores.length > 0 ? (
          <ul className="divide-y">
            {scores.map((score, index) => (
              <ScoreItem key={index} score={score} />
            ))}
          </ul>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            You haven&apos;t logged any scores yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
} 