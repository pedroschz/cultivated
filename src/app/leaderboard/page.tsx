/**
 * @file This file implements the global leaderboard page that displays user rankings
 * based on their overall competency scores. It fetches user data from Firestore,
 * calculates rankings, and displays a comprehensive leaderboard with user avatars,
 * mastery levels, and performance metrics. The page includes real-time updates
 * and filtering capabilities.
 */
"use client";

import { useState, useEffect } from "react";
import { getAllowedSchools } from "@/lib/config";
import { useRouter } from "next/navigation";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { getInitials } from "@/lib/constants/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Trophy, 
  Award, 
  Users, 
  TrendingUp, 
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  username?: string;
  overallCompetency: number;
  totalQuestionsAnswered: number;
  totalTimeSpent: number;
  masteryLevel: 'beginner' | 'developing' | 'proficient' | 'advanced' | 'master';
  lastActive: number;
  rank: number;
  countryCode?: string;
  avatarIcon?: string;
  avatarColor?: string;
  school?: string;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  totalUsers: number;
  topPerformerScore: number;
}

function getMasteryLevel(competencyScore: number): 'beginner' | 'developing' | 'proficient' | 'advanced' | 'master' {
  if (competencyScore >= 90) return 'master';
  if (competencyScore >= 75) return 'advanced';
  if (competencyScore >= 60) return 'proficient';
  if (competencyScore >= 40) return 'developing';
  return 'beginner';
}

const getMasteryColor = (level: string) => {
  switch (level) {
    case 'master': return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white';
    case 'advanced': return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white';
    case 'proficient': return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white';
    case 'developing': return 'bg-gradient-to-r from-green-500 to-green-600 text-white';
    case 'beginner': return 'bg-gradient-to-r from-gray-400 to-gray-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Award className="h-5 w-5 text-gray-500" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return <span className="font-bold text-lg text-muted-foreground">#{rank}</span>;
};

const formatTimeSpent = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Normalize various timestamp shapes (number ms/sec, Date, Firestore Timestamp, ISO string) to millis
const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'number') {
    // Heuristic: if it's less than ~2001-09-09 in ms, it's likely seconds
    return value < 1e12 ? value * 1000 : value;
  }
  if (value instanceof Date) return value.getTime();
  // Firestore Timestamp has toMillis()
  if (typeof (value as any)?.toMillis === 'function') {
    try { return (value as any).toMillis(); } catch { /* noop */ }
  }
  // Firestore Timestamp shape { seconds, nanoseconds }
  if (typeof value === 'object' && value !== null && typeof (value as any).seconds === 'number') {
    return (value as any).seconds * 1000;
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
};

const formatLastActive = (timestampLike: unknown) => {
  const timestamp = toMillis(timestampLike);
  if (!timestamp) return 'Recently';
  const now = Date.now();
  const diff = now - timestamp;
  if (!Number.isFinite(diff) || diff < 0) return 'Recently';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'Recently';
};

const getCountryFlag = (countryCode?: string) => {
  if (!countryCode || countryCode.trim() === '') {
    return '🌍'; // Default world emoji if no country
  }
  
  try {
    // Use the same implementation as onboarding page
    const code = countryCode.toUpperCase().trim();
    
    if (code.length !== 2) {
      return '🌍';
    }
    
    // Same implementation as onboarding page
    const codePoints = code
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
      
    const flagEmoji = String.fromCodePoint(...codePoints);
    return flagEmoji;
  } catch (error) {
    console.error('Error in flag conversion:', error);
    return '🌍'; // Fallback to world emoji on error
  }
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string | null>(null);
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null);
  const [userSchool, setUserSchool] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [leaderboardScope, setLeaderboardScope] = useState<'global' | 'my-school' | 'friends'>('global');
  const [allEntries, setAllEntries] = useState<LeaderboardEntry[]>([]);
  const [hasSetDefaultScope, setHasSetDefaultScope] = useState(false);
  const [userSchoolFetched, setUserSchoolFetched] = useState(false);
  const [userFriends, setUserFriends] = useState<string[]>([]);

  const allowedSchools = new Set(getAllowedSchools());

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setUserName(currentUser?.displayName || null);
      setUserSchoolFetched(false);
      
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
            setUserSchool(userData.school || null);
            setUserFriends(Array.isArray(userData.friends) ? userData.friends : []);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        } finally {
          setUserSchoolFetched(true);
        }
      } else {
        setUserSchool(null);
        setUserFriends([]);
        setUserSchoolFetched(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Updated fetchLeaderboard to use Firebase client SDK directly
  // This fixes static export issues by bypassing API routes
  const fetchLeaderboard = async () => {
    try {
      if (!db) {
        throw new Error('Firebase not initialized');
      }

      // Read from the public mirror — the private `users` collection is
      // owner-only after the strict rules went in.
      const usersCollection = collection(db, 'users_public');
      const usersSnapshot = await getDocs(usersCollection);
      const leaderboardEntries: LeaderboardEntry[] = [];

      usersSnapshot.forEach((docSnap) => {
        try {
          const userData = docSnap.data();
          const competency = userData.publicCompetency;
          const totalQ = userData.publicQuestionsAnswered ?? 0;

          if (typeof competency === 'number'
              && totalQ >= 5
              && (userData.displayName || userData.firstName || userData.username)) {
            const competencyScore = competency || 0;
            const displayName = userData.displayName || userData.firstName || userData.username;

            if (displayName && displayName !== 'Anonymous User' && String(displayName).trim() !== '') {
              const countryData = userData.country || userData.countryCode;

              leaderboardEntries.push({
                userId: docSnap.id,
                displayName: displayName,
                username: userData.username,
                overallCompetency: Math.round(competencyScore * 100) / 100,
                totalQuestionsAnswered: totalQ,
                totalTimeSpent: 0, // not exposed in public mirror
                masteryLevel: getMasteryLevel(competencyScore),
                lastActive: toMillis(userData.lastActive || userData.lastLogin || Date.now()),
                rank: 0,
                countryCode: countryData,
                avatarIcon: userData.avatarIcon,
                avatarColor: userData.avatarColor,
                school: userData.school
              });
            }
          }
        } catch (docError) {
          console.error(`Error processing user ${docSnap.id}:`, docError);
        }
      });

      // Save all entries and let scope-aware effect compute the view data
      setAllEntries(leaderboardEntries);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      toast.error('Failed to load leaderboard data');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchLeaderboard();
      setIsLoading(false);
    };
    
    loadData();
  }, [user]);

  // Decide default scope once we know the user's school
  useEffect(() => {
    if (!hasSetDefaultScope && userSchoolFetched) {
      if (userSchool && allowedSchools.has(userSchool)) {
        setLeaderboardScope('my-school');
      } else {
        setLeaderboardScope('global');
      }
      setHasSetDefaultScope(true);
      return;
    }

    // If currently on my-school but user's school is not eligible, force global
    if (leaderboardScope === 'my-school' && userSchoolFetched && (!userSchool || !allowedSchools.has(userSchool))) {
      setLeaderboardScope('global');
    }
  }, [userSchool, userSchoolFetched, hasSetDefaultScope, leaderboardScope]);

  // Reset default scope decision when the authenticated user changes
  useEffect(() => {
    setHasSetDefaultScope(false);
  }, [user?.uid]);

  // Recompute leaderboard data when scope, entries, or user's school changes
  useEffect(() => {
    // Do nothing until entries are loaded
    if (!allEntries || allEntries.length === 0) {
      setLeaderboardData({ leaderboard: [], totalUsers: 0, topPerformerScore: 0 });
      setCurrentUserRank(null);
      return;
    }

    let working = [...allEntries];

    if (leaderboardScope === 'my-school') {
      // Only show for allowed schools. If user's school is not allowed, show empty list.
      if (!userSchool || !allowedSchools.has(userSchool)) {
        setLeaderboardData({ leaderboard: [], totalUsers: 0, topPerformerScore: 0 });
        setCurrentUserRank(null);
        return;
      }
      working = working.filter((e) => (e.school || '').trim() === userSchool);
    } else if (leaderboardScope === 'friends') {
      const friendSet = new Set(userFriends);
      if (user?.uid) friendSet.add(user.uid);
      working = working.filter((e) => friendSet.has(e.userId));
    }

    // Sort by overall competency (highest first), then by total questions as tiebreaker
    working.sort((a, b) => {
      if (a.overallCompetency !== b.overallCompetency) {
        return b.overallCompetency - a.overallCompetency;
      }
      return b.totalQuestionsAnswered - a.totalQuestionsAnswered;
    });

    // Assign ranks for the current view
    working.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Limit to top 100 for performance
    const topEntries = working.slice(0, 100);
    const topPerformerScore = topEntries.length > 0 ? topEntries[0].overallCompetency : 0;

    const data: LeaderboardData = {
      leaderboard: topEntries,
      totalUsers: working.length,
      topPerformerScore
    };

    setLeaderboardData(data);
    
    // Find current user's rank in the current view
    if (user) {
      const userEntry = data.leaderboard.find(entry => entry.userId === user.uid);
      setCurrentUserRank(userEntry?.rank || null);
    }
  }, [leaderboardScope, allEntries, user, userSchool, userFriends]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLeaderboard();
    setIsRefreshing(false);
    toast.success('Leaderboard updated!');
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
        <div className="py-6 px-4 md:py-8 md:pr-8 md:pl-14 xl:pl-16">
          <PageHeader
            title={
              leaderboardScope === 'global'
                ? '🌍 Global Leaderboard'
                : leaderboardScope === 'friends'
                  ? '👥 Friends Leaderboard'
                  : '🏫 My School Leaderboard'
            }
            description={
              leaderboardScope === 'global'
                ? 'See how you rank against students from around the world based on your mastery level.'
                : leaderboardScope === 'friends'
                  ? 'See how you rank among your friends.'
                  : (allowedSchools.has(userSchool || '')
                      ? `See how you rank among students at ${userSchool}.`
                      : (allowedSchools.size > 0
                          ? `School leaderboard is currently available for: ${Array.from(allowedSchools).join(', ')}.`
                          : 'School leaderboard is not enabled for any schools yet.'))
            }
          >
            <div className="flex items-center gap-2">
              <Select value={leaderboardScope} onValueChange={(v) => setLeaderboardScope(v as 'global' | 'my-school' | 'friends')}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="friends">Friends</SelectItem>
                  {allowedSchools.has(userSchool || '') && (
                    <SelectItem value="my-school">My School</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleRefresh} disabled={isLoading} variant="ghost" size="icon">
                      <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
                      <span className="sr-only">Refresh Leaderboard</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </PageHeader>
          
          {/* Stats Header */}
          <div className="mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                     <p className="text-2xl font-bold">
                       {leaderboardData?.totalUsers || '0'}
                     </p>
                     <p className="text-sm text-muted-foreground">{leaderboardScope === 'friends' ? 'Active Friends' : 'Active Students'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Award className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                     <p className="text-2xl font-bold">
                       {currentUserRank ? `#${currentUserRank}` : '--'}
                     </p>
                     <p className="text-sm text-muted-foreground">Your Rank</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                     <p className="text-2xl font-bold">
                       {leaderboardData?.topPerformerScore || '0'}%
                     </p>
                     <p className="text-sm text-muted-foreground">Top Performer</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Leaderboard */}
          <Card className="mt-6 md:mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top Performers
              </CardTitle>
              <CardDescription>
                Rankings are based on overall mastery level. To appear on the leaderboard you must complete at least 6 questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[150px]" />
                      </div>
                      <Skeleton className="h-6 w-[80px]" />
                      <Skeleton className="h-8 w-[60px]" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboardData?.leaderboard.map((entry, index) => (
                    <div
                      key={entry.userId}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border transition-colors hover:bg-muted/50",
                        entry.userId === user?.uid && "bg-primary/5 border-primary/20 ring-1 ring-primary/20",
                        index < 3 && "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200",
                        entry.username && "cursor-pointer"
                      )}
                      onClick={() => entry.username && router.push(`/friends/${entry.username}`)}
                    >
                      {/* Rank */}
                      <div className="flex items-center justify-center w-12">
                        {getRankIcon(entry.rank)}
                      </div>

                      {/* Country Flag */}
                      <div className="flex items-center justify-center w-8">
                        <span className="text-lg">{getCountryFlag(entry.countryCode)}</span>
                      </div>

                      {/* Avatar */}
                      <CustomAvatar
                        icon={entry.avatarIcon}
                        color={entry.avatarColor}
                        fallbackText={getInitials(entry.displayName)}
                        size="lg"
                        className={cn(
                          entry.userId === user?.uid && "ring-2 ring-primary ring-offset-2"
                        )}
                      />

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium truncate">
                            {entry.username ? `@${entry.username}` : entry.displayName}
                            {entry.userId === user?.uid && (
                              <span className="text-primary"> (You)</span>
                            )}
                          </h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>{entry.totalQuestionsAnswered} questions</span>
                          <span>•</span>
                          <span>{formatTimeSpent(entry.totalTimeSpent)} studied</span>
                          <span>•</span>
                          <span>{formatLastActive(entry.lastActive)}</span>
                        </div>
                      </div>

                      {/* Mastery Level */}
                      <Badge className={cn("capitalize", getMasteryColor(entry.masteryLevel))}>
                        {entry.masteryLevel}
                      </Badge>

                      {/* Score */}
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          {entry.overallCompetency.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">Competency</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {!isLoading && leaderboardData?.leaderboard.length === 0 && (
                <div className="text-center py-12">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    No rankings yet
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Be the first to appear on the leaderboard by practicing!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 