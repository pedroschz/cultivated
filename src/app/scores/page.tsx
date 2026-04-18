/**
 * @file This file implements the SAT scores management page where users can log
 * and track their official SAT scores and practice test results. It provides
 * a form for entering new scores with validation, and displays a comprehensive
 * list of all recorded scores with superscore calculations. The page integrates
 * with the ScoresList component for score display and analysis.
 */
"use client";

import { useState, useEffect } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { doc, updateDoc, arrayUnion, serverTimestamp, getDoc } from "firebase/firestore";
import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Award, Loader2 } from "lucide-react";
import { ScoresList } from "@/components/ScoresList";
import { cn } from "@/lib/utils";

export default function ScoresPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string | null>(null);
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mathScore, setMathScore] = useState<number | ''>('');
  const [rwScore, setRwScore] = useState<number | ''>('');
  const [testDate, setTestDate] = useState('');
  const [testType, setTestType] = useState<'official' | 'bluebook' | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setUserName(currentUser?.displayName || null);
      
      // Fetch user data for avatar
      if (currentUser && db) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserUsername(userData.username || null);
            setUserAvatarIcon(userData.avatarIcon || null);
            setUserAvatarColor(userData.avatarColor || null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !db) {
      toast.error("You must be logged in to save a score. Please check your connection.");
      return;
    }

    if (!mathScore || !rwScore || !testDate || !testType) {
      toast.error("Please fill out all required fields, including the test type.");
      return;
    }

    if (mathScore < 200 || mathScore > 800 || rwScore < 200 || rwScore > 800) {
      toast.error("Scores must be between 200 and 800.");
      return;
    }

    setIsSubmitting(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const newScore = {
        math: mathScore,
        readingAndWriting: rwScore,
        testDate,
        testType,
        notes,
        createdAt: new Date(),
      };

      await updateDoc(userRef, {
        scores: arrayUnion(newScore),
      });

      toast.success("Score saved successfully!");
      // Reset form
      setMathScore('');
      setRwScore('');
      setTestDate('');
      setTestType('');
      setNotes('');
    } catch (error) {
      console.error("Error saving score:", error);
      toast.error("Failed to save score. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar
        user={user}
        userName={userName}
        userUsername={userUsername}
        userAvatarIcon={userAvatarIcon}
        userAvatarColor={userAvatarColor}
      />
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "ml-0 md:ml-16" : "ml-0 md:ml-64"
      )}>
        <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
          <PageHeader
            title="📝 Log & View Scores"
            description="Keep track of your SAT practice tests or real scores over time."
          />
          <div className="mt-6 md:mt-8 grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-3">
            {/* Left Column */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Enter Your Score</CardTitle>
                  <CardDescription>
                    Add a new SAT score to your performance history.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="math-score">Math Score (200-800)</Label>
                        <Input
                          id="math-score"
                          type="number"
                          value={mathScore}
                          onChange={(e) => setMathScore(e.target.value === '' ? '' : parseInt(e.target.value))}
                          placeholder="e.g., 650"
                          min="200"
                          max="800"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rw-score">R&W Score (200-800)</Label>
                        <Input
                          id="rw-score"
                          type="number"
                          value={rwScore}
                          onChange={(e) => setRwScore(e.target.value === '' ? '' : parseInt(e.target.value))}
                          placeholder="e.g., 680"
                          min="200"
                          max="800"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Test Type</Label>
                      <RadioGroup
                        value={testType}
                        onValueChange={(value: 'official' | 'bluebook' | '') => setTestType(value)}
                        className="flex gap-4 pt-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="official" id="official" />
                          <Label htmlFor="official">Official SAT</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="bluebook" id="bluebook" />
                          <Label htmlFor="bluebook">Bluebook Practice Test</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="test-date">Test Date</Label>
                      <Input
                        id="test-date"
                        type="date"
                        value={testDate}
                        onChange={(e) => setTestDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="How did you feel about this test? Any specific areas you want to focus on next?"
                        rows={4}
                      />
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Award className="mr-2 h-4 w-4" />
                          Save Score
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-2">
              <ScoresList />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 