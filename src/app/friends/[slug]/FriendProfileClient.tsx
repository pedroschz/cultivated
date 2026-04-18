"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
} from 'firebase/firestore';
import { getPublicUser, getPublicUserByUsername } from '@/lib/users-public';
import { Sidebar } from '@/components/layout/sidebar';
import { PageHeader } from '@/components/layout/page-header';
import { auth, app } from '@/lib/firebaseClient';
import { DEFAULT_AVATAR } from '@/lib/constants/avatar';
import { cn } from '@/lib/utils';
import { 
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Skeleton
} from '@/components';
import { 
  Flame,
  Zap,
  Clock,
  TrendingUp,
  Users,
  ArrowLeft,
  UserPlus
} from 'lucide-react';
import { CustomAvatar } from '@/components/ui/custom-avatar';
import type { MasteryHistoryEntry } from '@/lib/types/adaptive-learning';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const getIsoDateLocal = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface FriendProfile {
  id: string;
  name?: string;
  displayName?: string;
  username?: string;
  avatarIcon?: string;
  avatarColor?: string;
  createdAt?: any;
  adaptiveLearning?: {
    overallCompetency?: number;
    totalQuestionsAnswered?: number;
    totalTimeSpent?: number;
    lastQuestionUpdate?: number;
    masteryHistory?: MasteryHistoryEntry[];
  };
  friends?: string[];
}

interface WeeklyData {
  date: string;
  overall: number | null;
  math: number | null;
  readingWriting: number | null;
}

export default function FriendProfileClient() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string | null>(null);
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null);
  const [isSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Friend profile state
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null);
  const [friendLoading, setFriendLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [friendFriends, setFriendFriends] = useState<FriendProfile[]>([]);
  const [friendFriendsLoading, setFriendFriendsLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [isCurrentUserFriend, setIsCurrentUserFriend] = useState(false);

  // Fetch friend profile by username
  // NOTE: This allows viewing ANY user's profile, regardless of friendship status
  // Anyone can view any profile by visiting /friends/[username]
  useEffect(() => {
    if (!app || !slug) return;

    const fetchFriendProfile = async () => {
      if (!app) return;
      setFriendLoading(true);
      try {
        const db = getFirestore(app);
        // Look up by username via the public mirror.
        const found = await getPublicUserByUsername(db, slug);
        if (!found) {
          console.log(`[FriendProfile] No user found with username: ${slug}`);
          setFriendProfile(null);
          setFriendLoading(false);
          return;
        }
        const friendData: FriendProfile = {
          ...(found as any),
          id: found.id,
          adaptiveLearning: {
            overallCompetency: typeof found.publicCompetency === 'number' ? found.publicCompetency : 0,
            totalQuestionsAnswered: typeof found.publicQuestionsAnswered === 'number' ? found.publicQuestionsAnswered : 0,
            totalTimeSpent: 0,
            lastQuestionUpdate: 0,
            masteryHistory: Array.isArray(found.publicMasteryHistory) ? found.publicMasteryHistory : [],
          },
        };
        
        setFriendProfile(friendData);

        // Calculate streak from mastery history
        // Note: We use mastery history instead of the history subcollection because
        // Firebase rules restrict subcollection access to owners/admins only
        try {
          const masteryHistory = friendData.adaptiveLearning?.masteryHistory || [];
          if (masteryHistory.length > 0) {
            const datesWithActivity = new Set<string>();
            masteryHistory.forEach((entry: MasteryHistoryEntry) => {
              if (entry.date) {
                datesWithActivity.add(entry.date);
              }
            });

            const todayLocalForStreak = new Date();
            const todayIso = getIsoDateLocal(todayLocalForStreak);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayIso = getIsoDateLocal(yesterday);

            let calculatedStreak = 0;
            let cursor = null as Date | null;
            if (datesWithActivity.has(todayIso)) {
              cursor = new Date(
                todayLocalForStreak.getFullYear(),
                todayLocalForStreak.getMonth(),
                todayLocalForStreak.getDate()
              );
            } else if (datesWithActivity.has(yesterdayIso)) {
              cursor = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
            } else {
              cursor = null;
            }
            while (cursor) {
              const iso = getIsoDateLocal(cursor);
              if (!datesWithActivity.has(iso)) break;
              calculatedStreak += 1;
              const next = new Date(cursor);
              next.setDate(cursor.getDate() - 1);
              cursor = next;
            }
            setStreak(calculatedStreak);
          } else {
            // No mastery history available, set streak to 0
            setStreak(0);
          }
        } catch (e) {
          console.error('Error calculating streak:', e);
          setStreak(0);
        }

        // Generate weekly data from mastery history
        const today = new Date();
        const lastSevenIso: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          lastSevenIso.push(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          );
        }

        const masteryHistory = friendData.adaptiveLearning?.masteryHistory || [];
        const history = masteryHistory.reduce<Record<string, any>>((acc, entry) => {
          acc[entry.date] = entry;
          return acc;
        }, {});

        const sevenDays: WeeklyData[] = lastSevenIso.map((iso) => {
          const [y, m, d] = iso.split('-').map(Number);
          const labelDate = new Date(y, (m || 1) - 1, d || 1);
          // Day abbreviations: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6
          const dayNames = ['S', 'D', 'L', 'Ma', 'Mi', 'J', 'V']; // Spanish abbreviations like Duolingo
          const dayIndex = labelDate.getDay();
          const label = dayNames[dayIndex] || labelDate.toLocaleDateString('en-US', { weekday: 'short' });
          const h = history[iso];
          return {
            date: label,
            overall: typeof h?.overall === 'number' ? Math.round(h.overall * 100) / 100 : null,
            math: typeof h?.math === 'number' ? Math.round(h.math * 100) / 100 : null,
            readingWriting: typeof h?.readingWriting === 'number' ? Math.round(h.readingWriting * 100) / 100 : null,
          };
        });

        setWeeklyData(sevenDays);

        // Fetch friend's friends
        const friendIds = friendData.friends || [];
        if (friendIds.length > 0) {
          setFriendFriendsLoading(true);
          const friendProfiles = await Promise.all(
            friendIds.slice(0, 20).map(async (fid: string) => {
              try {
                const pub = await getPublicUser(db, fid);
                if (!pub) return null;
                return { ...(pub as any), id: pub.id } as FriendProfile;
              } catch {
                return null;
              }
            })
          );
          setFriendFriends(friendProfiles.filter(Boolean) as FriendProfile[]);
          setFriendFriendsLoading(false);
        } else {
          setFriendFriends([]);
          setFriendFriendsLoading(false);
        }
      } catch (e) {
        console.error('Error fetching friend profile:', e);
        // Don't set profile to null on error - show error state instead
        // This allows viewing profiles even if there are permission issues
        setFriendProfile(null);
        setFriendLoading(false);
      }
    };

    fetchFriendProfile();
  }, [app, slug]);

  // Check if current user is friend
  useEffect(() => {
    if (!user || !friendProfile) return;
    const myFriends = friendProfile.friends || [];
    setIsCurrentUserFriend(myFriends.includes(user.uid));
  }, [user, friendProfile]);

  // Fetch current user data
  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && app) {
        try {
          const db = getFirestore(app);
          const userRef = doc(db, 'users', u.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            setUserName(data.name || u.displayName || 'Valued User');
            setUserUsername(data.username || null);
            setUserAvatarIcon(data.avatarIcon || DEFAULT_AVATAR.icon);
            setUserAvatarColor(data.avatarColor || DEFAULT_AVATAR.color);
          } else {
            setUserName(u.displayName || 'Valued User');
            setUserUsername(null);
            setUserAvatarIcon(DEFAULT_AVATAR.icon);
            setUserAvatarColor(DEFAULT_AVATAR.color);
          }
        } catch {
          setUserName(u.displayName || 'Valued User');
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const joinDate = useMemo(() => {
    if (!friendProfile?.createdAt) return null;
    const date = friendProfile.createdAt?.toDate 
      ? friendProfile.createdAt.toDate() 
      : (typeof friendProfile.createdAt === 'number' 
        ? new Date(friendProfile.createdAt) 
        : new Date(friendProfile.createdAt));
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [friendProfile]);

  const chartConfig = {
    overall: {
      label: "Overall",
      color: "hsl(220, 15%, 50%)",
    },
    math: {
      label: "Math",
      color: "hsl(0, 80%, 60%)",
    },
    readingWriting: {
      label: "Reading & Writing",
      color: "hsl(210, 80%, 55%)",
    },
  } satisfies ChartConfig;

  if (isLoading || friendLoading) {
    return (
      <div className="min-h-screen ambient-bg">
        <Sidebar 
          user={user}
          userName={userName}
          userUsername={userUsername}
          userAvatarIcon={userAvatarIcon}
          userAvatarColor={userAvatarColor}
        />
        <div className={cn('transition-all duration-300 ease-in-out', isSidebarCollapsed ? 'ml-16' : 'ml-64')}>
          <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
            <PageHeader title="Friend Profile" />
            <div className="max-w-6xl space-y-6">
              <Skeleton className="h-64" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (!friendProfile) {
    return (
      <div className="min-h-screen ambient-bg">
        <Sidebar 
          user={user}
          userName={userName}
          userUsername={userUsername}
          userAvatarIcon={userAvatarIcon}
          userAvatarColor={userAvatarColor}
        />
        <div className={cn('transition-all duration-300 ease-in-out', isSidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64')}>
          <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
            <PageHeader title="Friend Profile" />
            <Card className="max-w-4xl">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <p className="text-muted-foreground">User not found</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => router.push('/friends')}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Friends
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const displayName = friendProfile.name || friendProfile.displayName || 'User';
  const username = friendProfile.username || 'unknown';
  const overallCompetency = friendProfile.adaptiveLearning?.overallCompetency || 0;
  const totalQuestions = friendProfile.adaptiveLearning?.totalQuestionsAnswered || 0;
  const totalTimeSpent = Math.floor((friendProfile.adaptiveLearning?.totalTimeSpent || 0) / 60);
  const friendsCount = friendProfile.friends?.length || 0;

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
        'transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
      )}>
        <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => router.push('/friends')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Friends
            </Button>
            <PageHeader title={displayName} />
          </div>

          <div className="max-w-6xl space-y-6">
            {/* Profile Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  <CustomAvatar
                    icon={friendProfile.avatarIcon}
                    color={friendProfile.avatarColor}
                    size="xl"
                    className="w-24 h-24 text-4xl"
                  />
                  <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold">{displayName}</h1>
                    <p className="text-muted-foreground text-lg">@{username}</p>
                    {joinDate && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Joined in {joinDate}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-4 justify-center md:justify-start">
                      <div className="text-sm text-muted-foreground">
                        <Users className="h-4 w-4 inline mr-1" />
                        {friendsCount} {friendsCount === 1 ? 'friend' : 'friends'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Flame className="h-4 w-4" />
                    Streak
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{streak}</div>
                  <p className="text-xs text-muted-foreground mt-1">days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Total Questions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalQuestions}</div>
                  <p className="text-xs text-muted-foreground mt-1">answered</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Overall Competency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{Math.round(overallCompetency * 100) / 100}</div>
                  <p className="text-xs text-muted-foreground mt-1">score</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Study Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalTimeSpent}</div>
                  <p className="text-xs text-muted-foreground mt-1">minutes</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Weekly Progress Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>This Week's Progress</CardTitle>
                  <CardDescription>Mastery over the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  {weeklyData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <LineChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          domain={[0, 100]}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line
                          type="monotone"
                          dataKey="overall"
                          stroke="hsl(220, 15%, 50%)"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                        />
                        <Line
                          type="monotone"
                          dataKey="math"
                          stroke="hsl(0, 80%, 60%)"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                        />
                        <Line
                          type="monotone"
                          dataKey="readingWriting"
                          stroke="hsl(210, 80%, 55%)"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No progress data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Friends List */}
              <Card>
                <CardHeader>
                  <CardTitle>Friends</CardTitle>
                  <CardDescription>{friendsCount} {friendsCount === 1 ? 'friend' : 'friends'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {friendFriendsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                    </div>
                  ) : friendFriends.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No friends yet
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {friendFriends.map((f) => (
                        <div 
                          key={f.id} 
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => f.username && router.push(`/friends/${f.username}`)}
                        >
                          <CustomAvatar
                            icon={f.avatarIcon}
                            color={f.avatarColor}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {f.name || f.displayName || 'User'}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              @{f.username || 'unknown'}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round((f.adaptiveLearning?.overallCompetency || 0) * 100) / 100}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
