/**
 * @file This file implements the main user dashboard page. It serves as the central hub
 * for users, displaying their progress, statistics, and providing the ability to start
 * new practice sessions. It fetches and processes user data from Firestore to present
 * a comprehensive overview of their performance.
 */
"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, app } from '@/lib/firebaseClient';
import { usePracticeSession, fetchOptimizedQuestion } from '@/lib/context/PracticeSessionContext';
import { PracticeSessionDuration, Question, PracticeSubject } from '@/lib/types/practice';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { getPublicUser } from '@/lib/users-public';
import Image from 'next/image';
import { 
  Button,
  Loading,
  Sidebar,
  NavigationErrorBoundary,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
  Progress,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components';
import { 
  Pencil,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  Users,
  Trophy,
  MessageSquareQuote,
  Sparkles,
  Flame,
  BookOpenCheck,
  BarChart3,
  School,
  Bold,
  Italic,
  Type
} from 'lucide-react';
import { DOMAIN_NAMES } from '@/lib/constants';
import { getSkillMapping } from '@/lib/adaptive-learning/skill-mapping';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SkillMastery } from '@/components/SkillMastery';
import { HeroSection, HistoricalMasteryCard } from '@/components';
import { ConsistencyMap } from '@/components/dashboard/ConsistencyMap';
import { BentoGrid, type BentoItem } from '@/components/dashboard/BentoGrid';
import { PracticeWidget } from '@/components/dashboard/PracticeWidget';
import { FirstTimeExperience, FirstSessionComplete } from '@/components/onboarding';
import { ProfileCompletionBanner } from '@/components/dashboard/ProfileCompletionBanner';
import { fetchQuestions } from '@/lib/context/PracticeSessionContext'; // Import fetchQuestions
import { adaptiveLearningService } from '@/lib/adaptive-learning/adaptive-service';
import type { MasteryHistoryEntry } from '@/lib/types/adaptive-learning';
import { CustomAvatar } from '@/components/ui/custom-avatar';
import { getInitials } from '@/lib/constants/avatar';
import { 
  WIDGET_DEFINITIONS, 
  WidgetType, 
  DashboardWidget, 
  WidgetDefinition, 
  DEFAULT_COLS, 
  GRID_SCALE, 
  getWidgetVariant,
  getWidgetLayoutCategory,
  WidgetLayoutCategory
} from '@/lib/constants/widgets';

// Type definitions for the component's props and state.

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
  competencyScore?: number;
  domainBreakdown?: {
    domain: string;
    subdomain: string;
    accuracy: number;
  }[];
}

interface HistoricalData {
  date: string;
  overall: number | null;
  math: number | null;
  readingWriting: number | null;
}

interface LeaderboardEntryLite {
  userId: string;
  displayName: string;
  username?: string;
  overallCompetency: number;
  totalQuestionsAnswered: number;
  totalTimeSpent: number;
  lastActive: number;
  rank: number;
  avatarIcon?: string;
  avatarColor?: string;
  school?: string;
}

interface FriendActivity {
  userId: string;
  displayName: string;
  username?: string;
  avatarIcon?: string;
  avatarColor?: string;
  lastActive: number;
  overallCompetency?: number;
  recentGains?: number; // Cumulative gains from last practice session
}

interface DomainData {
  totalCorrect: number;
  totalAnswered: number;
  averageTime: number;
}

interface SkillDataByDomainId {
  [domainId: string]: DomainData;
}

interface StatsData {
  math?: {
    [skillKey: string]: SkillDataByDomainId;
  };
  readingAndWriting?: {
    [skillKey: string]: SkillDataByDomainId;
  };
}

const getIsoDateLocal = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

import { getAllowedSchools } from "@/lib/config";
const ALLOWED_SCHOOLS = new Set(getAllowedSchools());

const createDefaultLayout = (includeAssignments: boolean): DashboardWidget[] => {
  const withDefaults = (type: WidgetType, partial: Omit<DashboardWidget, 'type' | 'id' | 'minW' | 'minH' | 'maxW' | 'maxH' | 'locked' | 'config'> & { id?: string; config?: Record<string, any> }) => {
    const def = WIDGET_DEFINITIONS[type];
    return {
      id: partial.id || type,
      type,
      x: partial.x * GRID_SCALE,
      y: partial.y * GRID_SCALE,
      w: partial.w * GRID_SCALE,
      h: partial.h * GRID_SCALE,
      minW: Math.max(1, def.minW),
      minH: Math.max(1, def.minH),
      maxW: def.maxW * GRID_SCALE,
      maxH: def.maxH * GRID_SCALE,
      locked: def.mandatory,
      config: { ...(def.defaultConfig || {}), ...(partial.config || {}) },
    } as DashboardWidget;
  };

  // Default layout: Only Quick Practice, Mastery Progress, and Skill Mastery widgets
  // Positions and sizes are in logical units (will be multiplied by GRID_SCALE=2)
  // Final grid units:
  // - Mastery Progress: w: 8, h: 6, x: 0, y: 0
  // - Skill Mastery: w: 8, h: 6, x: 8, y: 0
  // - Quick Practice: w: 5, h: 2, x: 0, y: 8
  const practiceDef = WIDGET_DEFINITIONS['practice'];
  const base: DashboardWidget[] = [
    withDefaults('masteryProgress', { id: 'masteryProgress', x: 0, y: 0, w: 4, h: 3 }), // Grid: x: 0, y: 0, w: 8, h: 6
    withDefaults('skillMastery', { id: 'skillMastery', x: 4, y: 0, w: 4, h: 3 }), // Grid: x: 8, y: 0, w: 8, h: 6
    // Quick Practice: manually set to exact grid units (w: 5, h: 2) since 5/2 = 2.5 logical units
    {
      id: 'practice',
      type: 'practice',
      x: 0,
      y: 8, // Grid units directly
      w: 5, // Grid units directly
      h: 2, // Grid units directly
      minW: Math.max(1, practiceDef.minW),
      minH: Math.max(1, practiceDef.minH),
      maxW: practiceDef.maxW * GRID_SCALE,
      maxH: practiceDef.maxH * GRID_SCALE,
      locked: practiceDef.mandatory,
      config: { ...(practiceDef.defaultConfig || {}) },
    } as DashboardWidget,
  ];

  if (includeAssignments) {
    base.push(withDefaults('assignments', { id: 'assignments', x: 0, y: 17, w: 4, h: 3 }));
  }

  return base;
};

const placeSequentially = (items: DashboardWidget[], cols: number) => {
  const collides = (a: DashboardWidget, b: DashboardWidget) => {
    if (a.id === b.id) return false;
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };
  const placed: DashboardWidget[] = [];
  items.forEach((item) => {
    let y = 0;
    let found = false;
    while (!found) {
      for (let x = 0; x <= cols - item.w; x += 1) {
        const candidate = { ...item, x, y };
        const collision = placed.some((existing) => collides(candidate, existing));
        if (!collision) {
          placed.push(candidate);
          found = true;
          break;
        }
      }
      if (!found) y += 1;
    }
  });
  return placed;
};

const rescaleLayout = (items: DashboardWidget[], fromScale: number, toScale: number) => {
  if (fromScale === toScale) return items;
  const ratio = toScale / fromScale;
  return items.map((item) => ({
    ...item,
    x: Math.round(item.x * ratio),
    y: Math.round(item.y * ratio),
    w: Math.max(1, Math.round(item.w * ratio)),
    h: Math.max(1, Math.round(item.h * ratio)),
  }));
};

const normalizeLayout = (raw: any, includeAssignments: boolean, layoutScale: number): DashboardWidget[] => {
  if (!Array.isArray(raw)) return createDefaultLayout(includeAssignments);
  const seen = new Set<WidgetType>();
  const cleaned: DashboardWidget[] = [];
  let needsPlacement = false;
  const safeScale = Number.isFinite(layoutScale) && layoutScale > 0 ? layoutScale : 1;
  raw.forEach((entry) => {
    const type = entry?.type as WidgetType;
    const def = WIDGET_DEFINITIONS[type];
    if (!def || seen.has(type)) return;
    if (type === 'assignments' && !includeAssignments) return;
    const defaultW = def.defaultW * safeScale;
    const defaultH = def.defaultH * safeScale;
    const minW = Math.max(1, safeScale === GRID_SCALE ? def.minW : def.minW * safeScale);
    const minH = Math.max(1, safeScale === GRID_SCALE ? def.minH : def.minH * safeScale);
    const maxW = def.maxW * safeScale;
    const maxH = def.maxH * safeScale;
    let w = Math.min(Math.max(Number(entry?.w || defaultW), minW), maxW, DEFAULT_COLS * safeScale);
    let h = Math.min(Math.max(Number(entry?.h || defaultH), minH), maxH);
    
    // Custom constraint: No widget can have w=1 or h=1 except for 1x2 or 2x1
    if (w === 1 && h !== 2) {
      // If width is 1, height must be 2 (1x2 is valid)
      // Otherwise, force width to 2
      if (h === 1) {
        // 1x1 is invalid, prefer width expansion
        w = 2;
      } else {
        // w=1 but h != 2, force w=2
        w = 2;
      }
    }
    if (h === 1 && w !== 2) {
      // If height is 1, width must be 2 (2x1 is valid)
      // Otherwise, force height to 2
      if (w === 1) {
        // 1x1 is invalid, prefer width expansion
        w = 2;
      } else {
        // h=1 but w != 2, force h=2
        h = 2;
      }
    }
    const hasX = Number.isFinite(entry?.x);
    const hasY = Number.isFinite(entry?.y);
    const x = Math.max(0, Math.min(Number(entry?.x || 0), DEFAULT_COLS * safeScale - w));
    const y = Math.max(0, Number(entry?.y || 0));
    if (!hasX || !hasY) needsPlacement = true;
    cleaned.push({
      id: entry?.id || type,
      type,
      x,
      y,
      w,
      h,
      minW: Math.max(1, def.minW),
      minH: Math.max(1, def.minH),
      maxW: def.maxW * safeScale,
      maxH: def.maxH * safeScale,
      locked: def.mandatory,
      config: { ...(def.defaultConfig || {}), ...(entry?.config || {}) },
    });
    seen.add(type);
  });

  const ensureMandatory = (Object.keys(WIDGET_DEFINITIONS) as WidgetType[])
    .filter((key) => WIDGET_DEFINITIONS[key].mandatory)
    .filter((key) => !seen.has(key));
  ensureMandatory.forEach((type) => {
    const def = WIDGET_DEFINITIONS[type];
    cleaned.push({
      id: type,
      type,
      x: 0,
      y: 0,
      w: def.defaultW * safeScale,
      h: def.defaultH * safeScale,
      minW: Math.max(1, def.minW),
      minH: Math.max(1, def.minH),
      maxW: def.maxW * safeScale,
      maxH: def.maxH * safeScale,
      locked: def.mandatory,
      config: { ...(def.defaultConfig || {}) },
    });
  });

  const scaled = rescaleLayout(cleaned, safeScale, GRID_SCALE).map((item) => {
    const def = WIDGET_DEFINITIONS[item.type];
    const minW = Math.max(1, def.minW);
    const minH = Math.max(1, def.minH);
    const maxW = def.maxW * GRID_SCALE;
    const maxH = def.maxH * GRID_SCALE;
    let w = Math.min(Math.max(item.w, minW), maxW, DEFAULT_COLS * GRID_SCALE);
    let h = Math.min(Math.max(item.h, minH), maxH);
    
    // Custom constraint: No widget can have w=1 or h=1 except for 1x2 or 2x1
    if (w === 1 && h !== 2) {
      // If width is 1, height must be 2 (1x2 is valid)
      // Otherwise, force width to 2
      if (h === 1) {
        // 1x1 is invalid, prefer width expansion
        w = 2;
      } else {
        // w=1 but h != 2, force w=2
        w = 2;
      }
    }
    if (h === 1 && w !== 2) {
      // If height is 1, width must be 2 (2x1 is valid)
      // Otherwise, force height to 2
      if (w === 1) {
        // 1x1 is invalid, prefer width expansion
        w = 2;
      } else {
        // h=1 but w != 2, force h=2
        h = 2;
      }
    }
    
    const x = Math.max(0, Math.min(item.x, DEFAULT_COLS * GRID_SCALE - w));
    const y = Math.max(0, item.y);
    return {
      ...item,
      x,
      y,
      w,
      h,
      minW,
      minH,
      maxW,
      maxH,
      locked: def.mandatory,
    };
  });

  return needsPlacement ? placeSequentially(scaled, DEFAULT_COLS * GRID_SCALE) : scaled;
};

/**
 * The main content component for the dashboard.
 * It handles user authentication, data fetching, and renders the dashboard UI.
 */
function DashboardContent() {
  // State for user information and UI management.
  const [userName, setUserName] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string | null>(null);
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [dayStreak, setDayStreak] = useState<number>(0);
  const [pointsIncrease, setPointsIncrease] = useState<number>(0);
  const [baselineSatTotal, setBaselineSatTotal] = useState<number | null>(null);
  const [showFirstTimeExperience, setShowFirstTimeExperience] = useState(false);
  const [showFirstSessionComplete, setShowFirstSessionComplete] = useState(false);
  const [shouldShowFirstSessionComplete, setShouldShowFirstSessionComplete] = useState(false);
  const [isSidebarCollapsed] = useState(false);
  const [redirectingToAdmin, setRedirectingToAdmin] = useState(false);
  const [userSchoolId, setUserSchoolId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Array<{ id: string; title: string; minutesGoal?: number | null; dueAt?: number | null; progressMinutes?: number; subject?: 'math' | 'rw' | null }>>([]);
  const [assignmentsReloadKey, setAssignmentsReloadKey] = useState(0);
  const [dashboardLayout, setDashboardLayout] = useState<DashboardWidget[]>([]);
  const [persistedLayout, setPersistedLayout] = useState<DashboardWidget[]>([]);
  const [isEditingDashboard, setIsEditingDashboard] = useState(false);
  const [isSavingDashboard, setIsSavingDashboard] = useState(false);
  const [consistencyDays, setConsistencyDays] = useState<Array<{ date: string; level: number; minutes: number }>>([]);
  const [consistencyDaysThisYear, setConsistencyDaysThisYear] = useState(0);
  const [userSchoolName, setUserSchoolName] = useState<string | null>(null);
  const [userFriends, setUserFriends] = useState<string[]>([]);
  const [tutorName, setTutorName] = useState<string>('My Tutor');
  const [tutorVoice, setTutorVoice] = useState<string | undefined>(undefined);
  const [gridCols, setGridCols] = useState(DEFAULT_COLS * GRID_SCALE);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntryLite[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([]);
  const [friendsActivityLoading, setFriendsActivityLoading] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [pendingSessionConfig, setPendingSessionConfig] = useState<{duration: PracticeSessionDuration, subject: PracticeSubject} | null>(null);
  const [existingSessionInfo, setExistingSessionInfo] = useState<{duration: number, subject: string} | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, dispatch } = usePracticeSession();

  // Helper for safe localStorage access
  const safeLocalStorage = {
    getItem: (key: string): string | null => {
      if (typeof window === 'undefined') return null;
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    setItem: (key: string, value: string) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {}
    },
    removeItem: (key: string) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.removeItem(key);
      } catch (e) {}
    }
  };

  // Cache user data in localStorage
  const CACHE_KEY_PREFIX = 'cultivated_user_data_';
  const CACHE_VERSION = '1';
  const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  const getCachedUserData = (uid: string) => {
    try {
      const cached = safeLocalStorage.getItem(`${CACHE_KEY_PREFIX}${uid}`);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (parsed.version !== CACHE_VERSION) return null;
      if (Date.now() - parsed.timestamp > CACHE_EXPIRY_MS) return null;
      return parsed.data;
    } catch {
      return null;
    }
  };

  const setCachedUserData = (uid: string, data: any) => {
    try {
      const cacheData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        data
      };
      safeLocalStorage.setItem(`${CACHE_KEY_PREFIX}${uid}`, JSON.stringify(cacheData));
    } catch {}
  };

  const buildConsistencyData = (history: MasteryHistoryEntry[], weeks = 12) => {
    const totals = new Map<string, number>();
    history.forEach((entry) => {
      const total = Number(entry?.secondsStudiedMath || 0) + Number(entry?.secondsStudiedReadingWriting || 0);
      if (total > 0 && entry?.date) totals.set(entry.date, total);
    });

    const totalDays = weeks * 7;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (totalDays - 1));

    const minutesByDate: Array<{ date: string; minutes: number }> = [];
    const nonZeroMinutes: number[] = [];
    for (let i = 0; i < totalDays; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = getIsoDateLocal(d);
      const minutes = Math.round((totals.get(iso) || 0) / 60);
      minutesByDate.push({ date: iso, minutes });
      if (minutes > 0) nonZeroMinutes.push(minutes);
    }

    let thresholds = [10, 20, 40];
    if (nonZeroMinutes.length >= 6) {
      const sorted = [...nonZeroMinutes].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)] || 10;
      const q2 = sorted[Math.floor(sorted.length * 0.5)] || 20;
      const q3 = sorted[Math.floor(sorted.length * 0.75)] || 40;
      const t1 = Math.max(5, q1);
      const t2 = Math.max(t1 + 1, q2);
      const t3 = Math.max(t2 + 1, q3);
      thresholds = [t1, t2, t3];
    }

    const levelForMinutes = (minutes: number) => {
      if (minutes <= 0) return 0;
      if (minutes <= thresholds[0]) return 1;
      if (minutes <= thresholds[1]) return 2;
      if (minutes <= thresholds[2]) return 3;
      return 4;
    };

    const days: Array<{ date: string; level: number; minutes: number }> = minutesByDate.map((entry) => ({
      date: entry.date,
      minutes: entry.minutes,
      level: levelForMinutes(entry.minutes),
    }));

    const yearPrefix = `${today.getFullYear()}-`;
    const daysThisYear = Array.from(totals.keys()).filter((iso) => iso.startsWith(yearPrefix)).length;

    return { days, daysThisYear };
  };

  const toMillis = (value: unknown): number => {
    if (!value) return 0;
    if (typeof value === 'number') {
      return value < 1e12 ? value * 1000 : value;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof (value as any)?.toMillis === 'function') {
      try { return (value as any).toMillis(); } catch { /* noop */ }
    }
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
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    if (!Number.isFinite(diff) || diff < 0) return 'Never';
    // If less than 2 minutes ago, consider them online
    if (diff < 120000) return 'online';
    // Show minutes if less than 1 hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    // Show hours if less than 24 hours
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    // Show days otherwise
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days === 0 ? 'Today' : `${days}d ago`;
  };

  // Effect to handle user authentication state changes.
  useEffect(() => {
    if (!auth) {
      setUserName("Valued User");
      setUser(null);
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
      if (currentUser) {
        // Load cached data immediately for instant display
        const cachedData = getCachedUserData(currentUser.uid);
        if (cachedData) {
          setUserName(cachedData.userName || currentUser.displayName || "Valued User");
          setUserUsername(cachedData.userUsername || null);
          setUserAvatarIcon(cachedData.userAvatarIcon || null);
          setUserAvatarColor(cachedData.userAvatarColor || null);
          setTutorName(cachedData.tutorName || 'My Tutor');
          setTutorVoice(cachedData.tutorVoice || undefined);
        } else {
          setUserName(currentUser.displayName || "Valued User");
        }
        setUser(currentUser);
        
        // Immediately redirect admins/teachers and show loading to avoid student dashboard flash
        try {
          const idt = await currentUser.getIdTokenResult(true);
          const role = String((idt.claims as any)?.role || '');
          if (role === 'schoolAdmin' || role === 'teacher') {
            setRedirectingToAdmin(true);
            router.replace('/schooladmin');
            return;
          }
        } catch {}
        
        // Fetch additional user data from Firestore.
        if (app) {
          try {
            const db = getFirestore(app);
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const userNameValue = userData.name || userData.displayName || currentUser.displayName || "Valued User";
              const userUsernameValue = userData.username || null;
              const userAvatarIconValue = userData.avatarIcon || null;
              const userAvatarColorValue = userData.avatarColor || null;
              const sid = (userData as any)?.schoolId || null;
              const userSchoolIdValue = sid ? String(sid) : null;
              const userSchoolNameValue = (userData as any)?.school || null;
              const userFriendsValue = Array.isArray((userData as any)?.friends) ? (userData as any)?.friends : [];
              
              // Update state with fresh data
              setUserName(userNameValue);
              setUserUsername(userUsernameValue);
              setUserAvatarIcon(userAvatarIconValue);
              setUserAvatarColor(userAvatarColorValue);
              setUserSchoolId(userSchoolIdValue);
              setUserSchoolName(userSchoolNameValue);
              setUserFriends(userFriendsValue);
              
              // Capture baseline SAT total from onboarding if available
              const baseline = (userData as any)?.studyCommitment?.currentSatTotal;
              if (typeof baseline === 'number') {
                setBaselineSatTotal(baseline);
              }
              const tn = (userData && (userData['tutor-name'] as string)) || '';
              const tutorNameValue = tn && tn.trim() ? tn.trim() : 'My Tutor';
              setTutorName(tutorNameValue);
              const tv = (userData && (userData['tutor-voice'] as string)) || '';
              const tutorVoiceValue = tv && tv.trim() ? tv.trim() : undefined;
              setTutorVoice(tutorVoiceValue);
              
              // Cache the user data for faster loading next time
              setCachedUserData(currentUser.uid, {
                userName: userNameValue,
                userUsername: userUsernameValue,
                userAvatarIcon: userAvatarIconValue,
                userAvatarColor: userAvatarColorValue,
                tutorName: tutorNameValue,
                tutorVoice: tutorVoiceValue,
              });
              
              const includeAssignments = !!sid;
              const layoutRaw = (userData as any)?.dashboardLayoutV2 || (userData as any)?.dashboardLayout || null;
              const storedScale = Number((userData as any)?.dashboardLayoutScale || 1);
              const normalizedLayout = normalizeLayout(layoutRaw, includeAssignments, storedScale);
              setDashboardLayout(normalizedLayout);
              setPersistedLayout(normalizedLayout);
            } else {
              const defaultLayout = createDefaultLayout(false);
              setDashboardLayout(defaultLayout);
              setPersistedLayout(defaultLayout);
            }
          } catch (error) {
            console.log('Could not fetch username:', error);
          }
        }
      } else {
        setUserName("Valued User");
        setUserUsername(null);
        setUser(null);
        setUserSchoolId(null);
        setUserSchoolName(null);
        setUserFriends([]);
        setTutorName('My Tutor');
        setTutorVoice(undefined);
        const defaultLayout = createDefaultLayout(false);
        setDashboardLayout(defaultLayout);
        setPersistedLayout(defaultLayout);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Effect to manage onboarding experiences for new users and after the first session.
  useEffect(() => {
    if (shouldShowFirstSessionComplete) {
      setShowFirstSessionComplete(true);
      setShouldShowFirstSessionComplete(false);
    }
    
    const isNewUser = searchParams.get('new_user') === 'true';
    if (isNewUser) {
      setShowFirstTimeExperience(true);
    }
  }, [shouldShowFirstSessionComplete, searchParams]);

  // Auto-start practice if query params are present (?start=10|20, ?subject=math|rw)
  useEffect(() => {
    const startParam = searchParams.get('start');
    const subjectParam = searchParams.get('subject');
    if (!startParam || !subjectParam) return;
    const duration = Number(startParam);
    const subject = subjectParam.toLowerCase() === 'math' ? 'Math' : 'Reading & Writing';
    if ((duration === 10 || duration === 20) && (subject === 'Math' || subject === 'Reading & Writing')) {
      // Clear params to avoid repeat trigger on re-render
      const next = new URL(window.location.href);
      next.searchParams.delete('start');
      next.searchParams.delete('subject');
      window.history.replaceState({}, '', next.toString());
      startPracticeSession(duration as any, subject as any);
    }
  }, [searchParams]);

  // Live subscription to user flags so UI reacts immediately when toggled (e.g., showFirstSessionComplete)
  useEffect(() => {
    if (!user || !app) return;
    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, async (userDoc) => {
      if (!userDoc.exists()) return;
      const data = userDoc.data() as any;
      const flags = data.flags || {};
      if (flags.showFirstSessionComplete) {
        setShouldShowFirstSessionComplete(true);
        try {
          await updateDoc(userRef, { 'flags.showFirstSessionComplete': false });
        } catch (e) {
          console.error('Failed to reset showFirstSessionComplete flag:', e);
        }
      }
    });
    return () => unsubscribe();
  }, [user, app]);

  // Fetch assignments for school-linked users and compute per-user progress (minutes since creation)
  useEffect(() => {
    (async () => {
      try {
        if (!user || !app || !userSchoolId) { setAssignments([]); return; }
        const db = getFirestore(app);
        const assignmentsSnap = await getDocs(collection(db, 'schools', String(userSchoolId), 'assignments'));
        const list = assignmentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        if (!list.length) { setAssignments([]); return; }
        const dailySnap = await getDocs(collection(db, 'users', user.uid, 'metrics', 'daily', 'days'));
        const dailyMap = new Map<string, number>();
        dailySnap.docs.forEach((ds) => {
          const sec = Number((ds.data() as any)?.secondsStudied || 0);
          dailyMap.set(ds.id, sec);
        });
        type DashboardAssignment = { id: string; title: string; minutesGoal?: number | null; dueAt?: number | null; progressMinutes?: number; subject?: 'math' | 'rw' | null };
        const enriched: DashboardAssignment[] = list.map((a) => {
          const startMs = Number(a.createdAt || 0) || Date.now();
          const endMs = Number(a.dueAt || Date.now());
          // Sum from start to end (inclusive)
          let totalSec = 0;
          const cursor = new Date(startMs);
          const endDate = new Date(endMs);
          // Guard if invalid dueAt
          if (endDate < cursor) endDate.setTime(Date.now());
          while (cursor <= endDate) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
            totalSec += dailyMap.get(key) || 0;
            cursor.setDate(cursor.getDate() + 1);
          }
          const progressMinutes = Math.round(totalSec / 60);
          const subject: 'math' | 'rw' | null = (a as any)?.subject === 'math' ? 'math' : ((a as any)?.subject === 'rw' ? 'rw' : null);
          return { id: a.id, title: String(a.title || 'Assignment'), minutesGoal: a.minutesGoal ?? null, dueAt: a.dueAt ?? null, progressMinutes, subject };
        });
        setAssignments(enriched);
      } catch (e) {
        setAssignments([]);
      }
    })();
  }, [user, app, userSchoolId, assignmentsReloadKey]);

  const hasLeaderboardWidget = useMemo(() => dashboardLayout.some((widget) => widget.type === 'leaderboard'), [dashboardLayout]);
  const hasFriendsWidget = useMemo(() => dashboardLayout.some((widget) => widget.type === 'friendsActivity'), [dashboardLayout]);

  useEffect(() => {
    if (!user || !app || !hasFriendsWidget) { setFriendsActivity([]); return; }
    if (!userFriends.length) { setFriendsActivity([]); return; }
    (async () => {
      setFriendsActivityLoading(true);
      try {
        const db = getFirestore(app);
        const profiles = await Promise.all(
          userFriends.slice(0, 20).map(async (uid) => {
            try {
              const data = await getPublicUser(db, uid);
              if (!data) return null;
              // `recentGains` previously came from per-subdomain attempts in
              // the private user doc. Those are no longer readable for other
              // users; the friend widget now shows just competency + lastActive.
              return {
                userId: data.id,
                displayName: data.displayName || data.firstName || data.username || 'Student',
                username: data.username,
                avatarIcon: data.avatarIcon,
                avatarColor: data.avatarColor,
                lastActive: toMillis(data.lastActive || data.lastLogin || 0),
                overallCompetency: typeof data.publicCompetency === 'number' ? data.publicCompetency : undefined,
              } as FriendActivity;
            } catch {
              return null;
            }
          })
        );
        setFriendsActivity(profiles.filter(Boolean) as FriendActivity[]);
      } finally {
        setFriendsActivityLoading(false);
      }
    })();
  }, [user, app, userFriends, hasFriendsWidget]);

  useEffect(() => {
    if (!user || !app || !hasLeaderboardWidget) { setLeaderboardEntries([]); return; }
    (async () => {
      setLeaderboardLoading(true);
      try {
        const db = getFirestore(app);
        const usersSnapshot = await getDocs(collection(db, 'users_public'));
        const entries: LeaderboardEntryLite[] = [];
        usersSnapshot.forEach((docSnap) => {
          const userData = docSnap.data() as any;
          const competency = userData.publicCompetency;
          const totalQ = userData.publicQuestionsAnswered ?? 0;
          if (typeof competency === 'number' && totalQ >= 5) {
            const displayName = userData.displayName || userData.firstName || userData.username;
            if (displayName && displayName !== 'Anonymous User' && String(displayName).trim() !== '') {
              entries.push({
                userId: docSnap.id,
                displayName,
                username: userData.username,
                overallCompetency: Math.round(competency * 100) / 100,
                totalQuestionsAnswered: totalQ,
                totalTimeSpent: 0,
                lastActive: toMillis(userData.lastActive || userData.lastLogin || Date.now()),
                rank: 0,
                avatarIcon: userData.avatarIcon,
                avatarColor: userData.avatarColor,
                school: userData.school,
              });
            }
          }
        });
        setLeaderboardEntries(entries);
      } catch (e) {
        setLeaderboardEntries([]);
      } finally {
        setLeaderboardLoading(false);
      }
    })();
  }, [user, app, hasLeaderboardWidget]);

  const handleSetAssignmentSubject = async (assignmentId: string, subject: 'math' | 'rw') => {
    try {
      if (!app || !userSchoolId) return;
      const db = getFirestore(app);
      await updateDoc(doc(db, 'schools', String(userSchoolId), 'assignments', assignmentId), { subject });
      setAssignmentsReloadKey((k) => k + 1);
    } catch (e) {
      toast.error('Failed to update assignment section');
    }
  };

  // No redirect from dashboard; resume occurs only when navigating to /practice or on refresh

  // Effect to fetch and process user statistics when the user object changes.
  useEffect(() => {
    async function fetchUserStats() {
      if (!user || !app) {
        console.log('No user or app available, skipping stats fetch');
        setIsStatsLoading(false);
        return;
      }
      
      setIsStatsLoading(true);
      console.log('Fetching stats for user:', user.uid);
      
      try {
        const cacheData = safeLocalStorage.getItem(`dashboard_stats_cache_${user.uid}`);
        if (cacheData) {
          const parsed = JSON.parse(cacheData);
          if (parsed.dayStreak !== undefined) setDayStreak(parsed.dayStreak);
          if (parsed.userStats !== undefined) setUserStats(parsed.userStats);
          if (parsed.consistencyDays !== undefined) setConsistencyDays(parsed.consistencyDays);
          if (parsed.consistencyDaysThisYear !== undefined) setConsistencyDaysThisYear(parsed.consistencyDaysThisYear);
          if (parsed.historicalData !== undefined) setHistoricalData(parsed.historicalData);
          if (parsed.pointsIncrease !== undefined) setPointsIncrease(parsed.pointsIncrease);
          setIsStatsLoading(false); // UI renders immediately while fetching fresh data
        }
      } catch (e) {}
      
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      
      // Fetch all questions to create a map for subdomainId, used for stats calculation.
      const allQuestions = await fetchQuestions();
      const questionMap = new Map<string, Question>();
      allQuestions.forEach(q => questionMap.set(q.id, q));

      try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          console.log('User document does not exist');
          setIsStatsLoading(false);
          return;
        }
        
        const userData = userDoc.data();
        const flags = (userData as any).flags || {};
        
        // Check for and handle the "first session complete" flag.
        if (flags.showFirstSessionComplete) {
          setShouldShowFirstSessionComplete(true);
          await updateDoc(userRef, {
            'flags.showFirstSessionComplete': false
          });
        }
        
        // Compute totals using adaptiveLearning and history subcollection
        const alRoot = userData.adaptiveLearning || {};
        const totalTimeSpent = Math.max(0, Math.floor((alRoot.totalTimeSpent || 0)));

        // Build history-derived aggregates
        const historyRef = collection(getFirestore(app!), 'users', user.uid, 'history');
        const historySnap = await getDocs(historyRef);
        const allHistory = historySnap.docs.map((d) => d.data() as any);
        const totalQuestionsAnswered = {
          math: 0,
          readingAndWriting: 0,
        };

        const domainAccuracies: { [key:string]: { correct: number, total: number } } = {};
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        const recentHistory = allHistory.filter((entry: any) => {
          const ts = typeof entry.answeredAtTs === 'number' ? entry.answeredAtTs : (entry.answeredAt?.toDate ? entry.answeredAt.toDate().getTime() : Date.parse(entry.answeredAt));
          return ts > fifteenDaysAgo.getTime();
        });

        const recentDomainAccuracies: { [key: string]: { correct: number; total: number } } = {};
          recentHistory.forEach((entry: any) => {
            const question = questionMap.get(entry.questionId);
            if (question && question.skill) {
              const key = question.skill;
              if (!recentDomainAccuracies[key]) {
                recentDomainAccuracies[key] = { correct: 0, total: 0 };
              }
              if (entry.correct) {
                recentDomainAccuracies[key].correct++;
              }
              recentDomainAccuracies[key].total++;
            }
          });

        // Build overall domain accuracies from entire history
          allHistory.forEach((entry: any) => {
            const q = questionMap.get(entry.questionId);
            if (!q || !q.skill) return;
            const key = q.skill;
            if (!domainAccuracies[key]) domainAccuracies[key] = { correct: 0, total: 0 };
            if (entry.correct) domainAccuracies[key].correct++;
            domainAccuracies[key].total++;
          // Math vs R&W counts
          const domainId = q.domain;
          if (typeof domainId === 'number') {
            if (domainId <= 3) totalQuestionsAnswered.math++;
            else totalQuestionsAnswered.readingAndWriting++;
          }
        });

        const domainResults = Object.entries(domainAccuracies).map(([key, value]) => {
          let domain = 'Unknown Domain';
          let subdomain = key;
          
          if (key.includes('_')) {
            const [domainId, subdomainId] = key.split('_');
            domain = DOMAIN_NAMES[domainId] || 'Unknown Domain';
            subdomain = `Skill ${subdomainId}`;
          } else {
            const skillMapping = getSkillMapping(key);
            if (skillMapping) {
              domain = skillMapping.domainName;
              subdomain = skillMapping.skill;
            } else {
              subdomain = key;
              domain = 'Unknown Domain';
            }
          }
          
          return {
            domain,
            subdomain,
            accuracy: value.total > 0 ? (value.correct / value.total) * 100 : 0
          };
        });

        domainResults.sort((a, b) => a.accuracy - b.accuracy);
        
        const strengths = domainResults.slice(-3).reverse();
        const weaknesses = domainResults.slice(0, 3);

        const totalCorrect = Object.values(recentDomainAccuracies).reduce((sum, data) => sum + data.correct, 0);
        const totalAnswered = Object.values(recentDomainAccuracies).reduce((sum, data) => sum + data.total, 0);
        const averageAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;

        // Compute daily streak from history entries (local day boundaries)
        const datesWithActivity = new Set<string>();
        for (const entry of allHistory) {
          const ts = typeof entry.answeredAtTs === 'number'
            ? entry.answeredAtTs
            : (entry.answeredAt?.toDate ? entry.answeredAt.toDate().getTime() : Date.parse(entry.answeredAt));
          if (!Number.isFinite(ts)) continue;
          datesWithActivity.add(getIsoDateLocal(new Date(ts)));
        }

        const todayLocalForStreak = new Date();
        const todayIso = getIsoDateLocal(todayLocalForStreak);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayIso = getIsoDateLocal(yesterday);

        let streak = 0;
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
          streak += 1;
          const next = new Date(cursor);
          next.setDate(cursor.getDate() - 1);
          cursor = next;
        }
        setDayStreak(streak);

        let overallCompetency = 0;
        const al2 = userData.adaptiveLearning || {};
        overallCompetency = al2.overallCompetency ?? 0;

        const calculatedStats = {
          totalTimeSpent: Math.floor(totalTimeSpent / 60),
          totalQuestionsAnswered,
          strengths,
          weaknesses,
          averageAccuracy,
          domainBreakdown: domainResults,
          competencyScore: overallCompetency
        };

        console.log('Calculated stats:', calculatedStats);
        setUserStats(calculatedStats);
        
        // Backfill once from granular history, then ensure snapshots exist through today
        await adaptiveLearningService.backfillMasteryHistory(user.uid);
        const al = await adaptiveLearningService.getUserAdaptiveLearningData(user.uid);
        const masteryHistory = Array.isArray(al?.masteryHistory) ? (al?.masteryHistory as MasteryHistoryEntry[]) : [];
        const consistency = buildConsistencyData(masteryHistory);
        setConsistencyDays(consistency.days);
        setConsistencyDaysThisYear(consistency.daysThisYear);

        // Generate historical data for trend charts from adaptiveLearning.masteryHistory (authoritative)
        const today = new Date();
        const lastSevenIso: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          lastSevenIso.push(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          );
        }

        const history = (al?.masteryHistory || []).reduce<Record<string, any>>((acc, entry) => {
          acc[entry.date] = entry;
          return acc;
        }, {});

        const sevenDays: HistoricalData[] = lastSevenIso.map((iso) => {
          // Parse ISO as local date to avoid UTC off-by-one for labels
          const [y, m, d] = iso.split('-').map(Number);
          const labelDate = new Date(y, (m || 1) - 1, d || 1);
          const label = labelDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const h = history[iso];
          return {
            date: label,
            overall: typeof h?.overall === 'number' ? Math.round(h.overall) : null,
            math: typeof h?.math === 'number' ? Math.round(h.math) : null,
            readingWriting: typeof h?.readingWriting === 'number' ? Math.round(h.readingWriting) : null,
          };
        });

        setHistoricalData(sevenDays);

        // Compute all-time points increase based on total seconds studied across Math and R&W
        try {
          const totalSecondsStudied = (al?.masteryHistory || []).reduce((sum: number, entry: any) => {
            const mathSec = Number(entry?.secondsStudiedMath || 0);
            const rwSec = Number(entry?.secondsStudiedReadingWriting || 0);
            return sum + mathSec + rwSec;
          }, 0);
          const inc = Math.floor(totalSecondsStudied / 1200);
          setPointsIncrease(inc);
          
          try {
            safeLocalStorage.setItem(`dashboard_stats_cache_${user.uid}`, JSON.stringify({
              dayStreak: streak,
              userStats: calculatedStats,
              consistencyDays: consistency.days,
              consistencyDaysThisYear: consistency.daysThisYear,
              historicalData: sevenDays,
              pointsIncrease: inc,
            }));
          } catch(e) {}
        } catch {
          setPointsIncrease(0);
        }
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
      setUserStats(null);
      setIsStatsLoading(false);
      setConsistencyDays([]);
      setConsistencyDaysThisYear(0);
      setLeaderboardEntries([]);
      setFriendsActivity([]);
    }
  }, [user]);

  /**
   * Starts a new practice session with the specified duration.
   * @param duration The length of the session in minutes.
   */
  const startPracticeSession = (duration: PracticeSessionDuration, subject: PracticeSubject, force: boolean = false) => {
    // Early check: ensure no other device holds an active practice session
    (async () => {
      try {
        if (!auth?.currentUser || !app) throw new Error('AUTH_REQUIRED');
        const { getFirestore, doc, getDoc, updateDoc } = await import('firebase/firestore');
        const db = getFirestore(app);
        const userRef = doc(db, 'users', auth.currentUser.uid);
        
        if (!force) {
          const snap = await getDoc(userRef);
          const data = snap.exists() ? (snap.data() as any) : {};
          const active = !!data['active-practice-session'];
          
          // Stale safety: if our local state shows no time left or session finished, clear stale flag
          if (active && (!state.isActive || state.showResults || (typeof state.timeRemaining === 'number' && state.timeRemaining <= 0))) {
            await updateDoc(userRef, { ['active-practice-session']: false } as any).catch(() => {});
          } else if (active) {
            setPendingSessionConfig({ duration, subject });
            if (state.isActive && state.session) {
              setExistingSessionInfo({ subject: state.session.subject, duration: state.session.duration });
            } else {
              setExistingSessionInfo(null);
            }
            setShowResumeDialog(true);
            return;
          }
        } else {
          // If forced, clear the active flag so a new session can start cleanly
          await updateDoc(userRef, { ['active-practice-session']: false } as any).catch(() => {});
        }
        
        // Not active → proceed to start; the practice page will set the flag
        const toastId = toast.loading(`Starting ${duration}-minute ${subject} session...`);
        
        try {
          const firstQuestion = await fetchOptimizedQuestion([], subject);
          dispatch({
            type: 'START_SESSION',
            payload: {
              duration,
              subject,
              initialQuestion: firstQuestion || undefined
            },
          });
          toast.success(`Session started!`, { id: toastId });
          window.location.href = '/practice';
          await new Promise((r) => setTimeout(r, 50));
        } catch (err) {
          toast.error('Failed to load first question.', { id: toastId });
        }
      } catch (e: any) {
        toast.error('Failed to start practice session. Please try again.');
        return;
      }
    })();
  };

  /**
   * Handles the completion of the first-time user experience modal.
   */
  const handleFirstTimeExperienceComplete = () => {
    setShowFirstTimeExperience(false);
    router.replace('/dashboard', { scroll: false });
  };

  /**
   * Handles the continuation from the "first session complete" modal.
   */
  const handleFirstSessionCompleteContinue = () => {
    setShowFirstSessionComplete(false);
    toast.success('Welcome back to your dashboard!');
  };

  const findOpenPosition = (layout: DashboardWidget[], item: DashboardWidget, cols: number) => {
    const collides = (a: DashboardWidget, b: DashboardWidget) => {
      if (a.id === b.id) return false;
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    };

    let y = 0;
    while (true) {
      for (let x = 0; x <= cols - item.w; x += 1) {
        const candidate = { ...item, x, y };
        const collision = layout.some((existing) => collides(candidate, existing));
        if (!collision) return { x, y };
      }
      y += 1;
    }
  };

  const saveDashboardLayout = async (nextLayout: DashboardWidget[]) => {
    if (!user || !app) return;
    setIsSavingDashboard(true);
    try {
      const db = getFirestore(app);
      const payload = nextLayout.map((widget) => ({
        type: widget.type,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        config: JSON.parse(JSON.stringify(widget.config || {})),
      }));
      await setDoc(doc(db, 'users', user.uid), { dashboardLayoutV2: payload, dashboardLayoutScale: GRID_SCALE }, { merge: true });
      setPersistedLayout(nextLayout);
    } catch (e) {
      console.error('Failed to save dashboard layout:', e);
      toast.error('Failed to save dashboard layout');
      setDashboardLayout(persistedLayout);
    } finally {
      setIsSavingDashboard(false);
    }
  };

  const handleToggleEditDashboard = async () => {
    if (!isEditingDashboard) {
      setIsEditingDashboard(true);
      return;
    }
    const normalized = normalizeLayout(dashboardLayout, !!userSchoolId, GRID_SCALE);
    setDashboardLayout(normalized);
    await saveDashboardLayout(normalized);
    setIsEditingDashboard(false);
  };

  const handleCancelEditDashboard = () => {
    setDashboardLayout(persistedLayout);
    setIsEditingDashboard(false);
  };

  const handleResetDashboard = () => {
    const fallback = createDefaultLayout(!!userSchoolId);
    setDashboardLayout(fallback);
  };

  const handleAddWidget = (type: WidgetType, position?: { x: number; y: number }) => {
    if (dashboardLayout.some((widget) => widget.type === type)) return;
    const def = WIDGET_DEFINITIONS[type];
    const scaledDefaultW = def.defaultW * GRID_SCALE;
    const scaledDefaultH = def.defaultH * GRID_SCALE;
    const minW = Math.max(1, def.minW);
    const minH = Math.max(1, def.minH);
    const maxW = def.maxW * GRID_SCALE;
    const maxH = def.maxH * GRID_SCALE;
    const adjustedMinW = Math.min(minW, gridCols);
    const w = Math.max(adjustedMinW, Math.min(scaledDefaultW, maxW, gridCols));
    const base: DashboardWidget = {
      id: type,
      type,
      x: 0,
      y: 0,
      w,
      h: Math.min(scaledDefaultH, maxH),
      minW: Math.min(minW, gridCols),
      minH,
      maxW: Math.min(maxW, gridCols),
      maxH,
      locked: def.mandatory,
      config: { ...(def.defaultConfig || {}) },
    };
    setDashboardLayout((prev) => {
      const dropPosition = position
        ? { x: Math.min(position.x, Math.max(0, gridCols - base.w)), y: Math.max(0, position.y) }
        : findOpenPosition(prev, base, gridCols);
      return [...prev, { ...base, ...dropPosition }];
    });
  };

  const handleRemoveWidget = (type: WidgetType) => {
    if (WIDGET_DEFINITIONS[type]?.mandatory) return;
    setDashboardLayout((prev) => prev.filter((widget) => widget.type !== type));
  };

  const updateWidgetConfig = (type: WidgetType, patch: Record<string, any>, persist: boolean = false) => {
    setDashboardLayout((prev) => {
      const next = prev.map((widget) => (
        widget.type === type ? { ...widget, config: { ...(widget.config || {}), ...patch } } : widget
      ));
      if (persist && !isEditingDashboard) {
        saveDashboardLayout(next);
      }
      return next;
    });
  };

  // Renders a loading state with skeletons while initial data is being fetched.
  if (isLoading || (user && isStatsLoading) || redirectingToAdmin) {
    return (
      <div className="min-h-screen ambient-bg">
        <Sidebar />
        
        <div className={cn(
          "transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "ml-0 md:ml-16" : "ml-0 md:ml-64"
        )}>
          <div className="px-4 md:pl-10 md:pr-6 pt-5 pb-6">
            <HeroSection 
              userName={userName}
              onStart10Math={() => startPracticeSession(10, 'Math')}
              onStart10RW={() => startPracticeSession(10, 'Reading & Writing')}
              onStart20Math={() => startPracticeSession(20, 'Math')}
              onStart20RW={() => startPracticeSession(20, 'Reading & Writing')}
              overallMastery={undefined}
              metrics={undefined}
            />

            <div className="pt-0 flex flex-col lg:flex-row gap-6 animate-fade-in mt-10">
              <div className="lg:basis-1/2 min-w-0">
                <div className="rounded-2xl border-2 border-border border-b-4 bg-card shadow-none h-[500px] p-6">
                  <div className="h-6 w-48 mb-4 bg-muted/70 rounded"></div>
                  <div className="space-y-3">
                    <div className="h-4 w-24 bg-muted/60 rounded"></div>
                    <div className="relative h-64 w-full bg-muted/50 rounded">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-sm text-muted-foreground text-center px-4">Stats will show here once you start practicing</p>
                      </div>
                    </div>
                    <div className="h-4 w-36 bg-muted/60 rounded"></div>
                  </div>
                </div>
              </div>
              <div className="lg:basis-1/2">
                <div className="rounded-2xl border-2 border-border border-b-4 bg-card shadow-none h-[500px] p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-20 w-full bg-muted/50 rounded" />
                  <div className="h-20 w-full bg-muted/50 rounded" />
                  <div className="h-20 w-full bg-muted/50 rounded" />
                  <div className="h-20 w-full bg-muted/50 rounded" />
                  <div className="h-20 w-full bg-muted/50 rounded" />
                  <div className="h-20 w-full bg-muted/50 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalQuestions = userStats ? (userStats.totalQuestionsAnswered.math + userStats.totalQuestionsAnswered.readingAndWriting) : 0;
  const hasStats = !!userStats && totalQuestions > 0;

  const metricsData = hasStats ? [
    { label: 'Point Increase', value: pointsIncrease },
    ...(baselineSatTotal != null ? [{ label: 'Projected Score', value: baselineSatTotal + pointsIncrease }] : []),
    { label: 'Overall', value: `${userStats!.averageAccuracy.toFixed(1)}%` },
    { label: 'Study Time', value: `${Math.floor(userStats!.totalTimeSpent / 60)}h ${userStats!.totalTimeSpent % 60}m` },
    { label: 'Math', value: userStats!.totalQuestionsAnswered.math },
    { label: 'R&W', value: userStats!.totalQuestionsAnswered.readingAndWriting },
  ] : [];

  const totalMinutes = userStats?.totalTimeSpent || 0;
  const projectedScore = baselineSatTotal != null ? baselineSatTotal + pointsIncrease : null;
  const minutesLast7 = consistencyDays.slice(-7).reduce((sum, day) => sum + day.minutes, 0);

  const widgetTypesInLayout = new Set(dashboardLayout.map((widget) => widget.type));
  const availableWidgets = (Object.keys(WIDGET_DEFINITIONS) as WidgetType[])
    .filter((type) => !widgetTypesInLayout.has(type))
    .filter((type) => (type === 'assignments' ? !!userSchoolId : true));

  const getLeaderboardEntriesForScope = (scope: 'global' | 'my-school' | 'friends') => {
    let working = [...(leaderboardEntries as LeaderboardEntryLite[])];
    if (scope === 'my-school') {
      if (!userSchoolName || !ALLOWED_SCHOOLS.has(userSchoolName)) return [] as LeaderboardEntryLite[];
      working = working.filter((entry) => (entry.school || '').trim() === userSchoolName);
    } else if (scope === 'friends') {
      const friendSet = new Set(userFriends);
      if (user?.uid) friendSet.add(user.uid);
      working = working.filter((entry) => friendSet.has(entry.userId));
    }
    working.sort((a, b) => {
      if (a.overallCompetency !== b.overallCompetency) return b.overallCompetency - a.overallCompetency;
      return b.totalQuestionsAnswered - a.totalQuestionsAnswered;
    });
    working.forEach((entry, index) => { entry.rank = index + 1; });
    return working;
  };

  interface StickyNoteWidgetProps {
    note: string;
    fontSize: number;
    isEditing: boolean;
    onUpdateNote: (note: string) => void;
    onUpdateFontSize: (fontSize: number) => void;
  }

  const StickyNoteWidget = ({ note, fontSize, isEditing, onUpdateNote, onUpdateFontSize }: StickyNoteWidgetProps) => {
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const isUserTypingRef = useRef(false);
    const lastSyncedNoteRef = useRef(note);
    
    const textStyle: React.CSSProperties = {
      fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
      fontSize: `${fontSize}px`,
    };
    
    // Initialize content on mount or when switching to editing mode
    useEffect(() => {
      if (contentEditableRef.current && isEditing) {
        const currentContent = contentEditableRef.current.innerHTML;
        // Only update if contentEditable is empty or if note prop changed from outside
        if (!currentContent || (note !== lastSyncedNoteRef.current && !isUserTypingRef.current)) {
          contentEditableRef.current.innerHTML = note || '';
          setIsEmpty(!contentEditableRef.current.textContent?.trim());
          lastSyncedNoteRef.current = note;
        }
      }
    }, [note, isEditing]);
    
    const handleInput = () => {
      if (contentEditableRef.current) {
        const textContent = contentEditableRef.current.textContent?.trim() || '';
        setIsEmpty(!textContent);
        // Update character count immediately (reads from DOM, no state update needed)
      }
    };
    
    const handleBlur = () => {
      if (contentEditableRef.current) {
        isUserTypingRef.current = true;
        const htmlContent = contentEditableRef.current.innerHTML;
        const textContent = contentEditableRef.current.textContent?.trim() || '';
        const textLength = textContent.length;
        if (textLength <= 280) {
          lastSyncedNoteRef.current = htmlContent;
          onUpdateNote(htmlContent);
        }
        setTimeout(() => {
          isUserTypingRef.current = false;
        }, 100);
      }
    };
    
    const toggleFormat = (command: string, tag: string) => {
      const editable = contentEditableRef.current;
      if (!editable) return;
      
      // Save current selection before focusing
      const savedSelection = window.getSelection();
      let savedRange: Range | null = null;
      if (savedSelection && savedSelection.rangeCount > 0) {
        savedRange = savedSelection.getRangeAt(0).cloneRange();
      }
      
      // Focus the editable
      editable.focus();
      
      // Restore selection if we had one
      if (savedRange) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(savedRange);
        }
      }
      
      // Get current selection after focus
      let selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        // No selection, select all or create a collapsed range at end
        selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        if (editable.textContent && editable.textContent.trim()) {
          // If there's content, select all
          range.selectNodeContents(editable);
        } else {
          // If empty, just position cursor
          range.selectNodeContents(editable);
          range.collapse(false);
        }
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      // Check if we're inside the tag we want to toggle
      let element = container.nodeType === Node.TEXT_NODE 
        ? container.parentElement 
        : container as Element;
      
      let isFormatted = false;
      while (element && element !== editable) {
        if (element.tagName?.toLowerCase() === tag.toLowerCase() || 
            (tag === 'b' && element.tagName?.toLowerCase() === 'strong')) {
          isFormatted = true;
          break;
        }
        element = element.parentElement;
      }
      
      if (isFormatted) {
        // Remove formatting
        document.execCommand('removeFormat', false);
        // Also try to unwrap the specific tag
        const selectedText = range.toString();
        if (selectedText || range.collapsed) {
          if (range.collapsed) {
            const parent = container.nodeType === Node.TEXT_NODE 
              ? container.parentElement 
              : container as Element;
            if (parent && (parent.tagName?.toLowerCase() === tag.toLowerCase() || 
                (tag === 'b' && parent.tagName?.toLowerCase() === 'strong'))) {
              // Unwrap the parent
              const parentElement = parent;
              const parentParent = parentElement.parentElement;
              if (parentParent) {
                while (parentElement.firstChild) {
                  parentParent.insertBefore(parentElement.firstChild, parentElement);
                }
                parentParent.removeChild(parentElement);
              }
            }
          } else {
            // Unwrap selected content
            const contents = range.extractContents();
            range.insertNode(contents);
          }
        }
      } else {
        // Add formatting - ensure we have a selection
        if (range.collapsed && editable.textContent && editable.textContent.trim()) {
          // If collapsed and there's content, try to select the word at cursor
          // Move start backward to word boundary
          try {
            range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
            range.setEnd(range.endContainer, Math.min(range.endContainer.textContent?.length || 0, range.endOffset + 1));
          } catch (e) {
            // If that fails, just use the collapsed range
          }
        }
        document.execCommand(command, false, undefined);
      }
      
      // Update content after formatting
      setTimeout(() => {
        handleBlur();
        editable.focus();
      }, 10);
    };
    
    const toggleBold = () => toggleFormat('bold', 'b');
    const toggleItalic = () => toggleFormat('italic', 'i');
    
    return (
      <div className="h-full flex flex-col">
        {isEditing && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggleBold}
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggleItalic}
                title="Italic"
              >
                <Italic className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Type className="h-4 w-4 text-muted-foreground" />
              <Select
                value={String(fontSize)}
                onValueChange={(value) => onUpdateFontSize(Number(value))}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12px</SelectItem>
                  <SelectItem value="14">14px</SelectItem>
                  <SelectItem value="16">16px</SelectItem>
                  <SelectItem value="18">18px</SelectItem>
                  <SelectItem value="20">20px</SelectItem>
                  <SelectItem value="24">24px</SelectItem>
                  <SelectItem value="28">28px</SelectItem>
                  <SelectItem value="32">32px</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {isEditing ? (
          <div className="flex-1 relative">
            <div
              ref={contentEditableRef}
              contentEditable
              onInput={handleInput}
              onBlur={handleBlur}
              className="flex-1 resize-none bg-transparent overflow-auto outline-none min-h-full"
              style={textStyle}
              suppressContentEditableWarning
            />
            {isEmpty && (
              <div className="absolute top-0 left-0 text-muted-foreground pointer-events-none">
                Type a quote, goal, or reminder...
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex-1 overflow-auto"
            style={textStyle}
            dangerouslySetInnerHTML={{ __html: note }}
          />
        )}
        {isEditing && (
          <div className="text-[10px] text-muted-foreground mt-2 text-right">
            {(contentEditableRef.current?.textContent?.length || 0)}/280
          </div>
        )}
      </div>
    );
  };

  const renderStatWidget = (title: string, value: string, subtitle: string) => (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
        <BarChart3 className="h-4 w-4" /> {title}
      </div>
      <div>
        <div className="text-3xl font-extrabold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
      </div>
    </div>
  );

  const renderWidgetContent = (widget: DashboardWidget) => {
    // Get the new layout category (minimal, minimal-vertical, minimal-horizontal, regular)
    const layoutCategory = getWidgetLayoutCategory(widget);
    // Keep variant for backward compatibility with widgets that haven't been migrated yet
    const variant = getWidgetVariant(widget);
    switch (widget.type) {
      case 'practice': {
        // Wrapper to convert widget's signature to startPracticeSession's signature
        const handleStartSession = (minutes: number, subject: 'Math' | 'Reading & Writing') => {
          startPracticeSession(minutes as PracticeSessionDuration, subject as PracticeSubject);
        };
        return (
          <PracticeWidget
            w={widget.w}
            h={widget.h}
            gridScale={GRID_SCALE}
            onStartSession={handleStartSession}
          />
        );
      }
      case 'streak': {
        const hasActivity = consistencyDays.some((day) => day.level > 0);
        if (!hasActivity) {
          return (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Start practicing to build a streak.
            </div>
          );
        }
        
        // Migrated to new layout category system
        // 'regular' = large enough for consistency map (was 'large')
        if (layoutCategory === 'regular') {
          // Calculate grid dimensions
          // Note: widget.w and widget.h are in GRID UNITS, so multiply by pixel size
          const gridUnitPx = 80; // Should match page constant, but local is fine
          const padding = 24 * 2; // p-6 * 2
          const gap = 6; // gap-1.5 = 6px
          const dotSize = 12; // h-3 w-3 = 12px
          
          // widget.w and widget.h are in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableWidth = widget.w * gridUnitPx - padding;
          const availableHeight = widget.h * gridUnitPx - padding - 40; // -40 for text

          const dotSpace = dotSize + gap;
          const rows = Math.max(1, Math.floor(availableHeight / dotSpace)); // At least 1 row
          const cols = Math.max(1, Math.floor(availableWidth / dotSpace)); // At least 1 col
          
          // Generate extra mock data if needed to fill the grid
          const needed = rows * cols;
          let displayDays = [...consistencyDays];
          if (displayDays.length < needed) {
             const extraNeeded = needed - displayDays.length;
             const lastDate = displayDays.length > 0 
                ? new Date(displayDays[displayDays.length - 1].date)
                : new Date();
                
             for (let i = 0; i < extraNeeded; i++) {
               const nextDate = new Date(lastDate);
               nextDate.setDate(nextDate.getDate() + i + 1);
               displayDays.push({
                 date: nextDate.toISOString().split('T')[0],
                 minutes: 0,
                 level: Math.floor(Math.random() * 5) as 0 | 1 | 2 | 3 | 4
               });
             }
          }

          return (
            <div className="h-full flex flex-col justify-between gap-4 p-6">
              <div className="flex-1 flex items-center justify-center w-full min-h-0 overflow-hidden">
                <ConsistencyMap 
                  days={displayDays} 
                  weeks={cols}
                  rows={rows}
                  dotClassName="h-3 w-3"
                  className="h-auto w-auto"
                  gridClassName="place-content-center gap-1.5"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                You&apos;ve studied on <span className="font-semibold text-foreground">{consistencyDaysThisYear} days</span> this year.
              </p>
            </div>
          );
        }
        // 'minimal-vertical' or 'minimal-horizontal' = medium size with last 7 days (was 'medium')
        if (layoutCategory === 'minimal-vertical' || layoutCategory === 'minimal-horizontal') {
          const lastSeven = consistencyDays.slice(-7);
          return (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-2 py-2">
              <div className="flex items-center justify-center gap-2">
                <Flame className="h-5 w-5 text-[#FF9600] fill-[#FF9600]" />
                <span className="text-3xl font-extrabold text-foreground">{dayStreak}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">day streak</span>
              </div>
              <div className="flex gap-2 justify-center">
                {lastSeven.map((day, idx) => (
                  <span key={`${day.date}-${idx}`} className={cn('h-3 w-3 rounded-full', day.level === 0 ? 'bg-muted/60' : day.level === 1 ? 'bg-emerald-200' : day.level === 2 ? 'bg-emerald-300' : day.level === 3 ? 'bg-emerald-400' : 'bg-emerald-500')} />
                ))}
              </div>
            </div>
          );
        }
        // 'minimal' = smallest size, just show streak number (was 'small')
        return (
          <div className="h-full flex items-center justify-center px-2 py-2">
            <div className="flex flex-col items-center gap-2">
              <Flame className="h-6 w-6 text-[#FF9600] fill-[#FF9600]" />
              <div className="text-4xl font-extrabold text-foreground">{dayStreak}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">day streak</div>
            </div>
          </div>
        );
      }
      case 'masteryProgress': {
        if (historicalData && historicalData.length > 0) {
          return <HistoricalMasteryCard data={historicalData} embedded className="h-full" />;
        }
        return (
          <div className="h-full flex flex-col justify-center items-center text-sm text-muted-foreground">
            Mastery trends will appear after you complete a few sessions.
          </div>
        );
      }
      case 'strengthsWeaknesses': {
        if (!hasStats || !userStats) {
          return (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Answer more questions to reveal your strengths and focus areas.
            </div>
          );
        }
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">Strengths</p>
              <div className="space-y-3">
                {userStats.strengths.map((item) => (
                  <div key={`${item.domain}-${item.subdomain}`} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.subdomain}</p>
                      <p className="text-xs text-muted-foreground">{item.domain}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">{item.accuracy.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">Focus Areas</p>
              <div className="space-y-3">
                {userStats.weaknesses.map((item) => (
                  <div key={`${item.domain}-${item.subdomain}`} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.subdomain}</p>
                      <p className="text-xs text-muted-foreground">{item.domain}</p>
                    </div>
                    <span className="text-sm font-semibold text-amber-600">{item.accuracy.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case 'skillMastery': {
        if (layoutCategory === 'minimal') {
          // Minimal: Show overall score only
          const overallScore = userStats?.competencyScore || 0;
          return (
            <div className="h-full flex flex-col items-center justify-center gap-1 px-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Mastery</div>
              <div className="text-3xl font-extrabold text-foreground">{Math.round(overallScore)}%</div>
              <div className="text-[10px] text-muted-foreground">Overall</div>
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-vertical') {
          // Minimal-vertical: Show domain scores vertically
          if (!hasStats || !userStats) {
            return (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Answer more questions to reveal skill mastery.
              </div>
            );
          }
          // For minimal-vertical, just show a message to resize
          return (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Resize to explore skill mastery.
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-horizontal') {
          // Minimal-horizontal: Show domain scores horizontally
          if (!hasStats || !userStats) {
            return (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Answer more questions to reveal skill mastery.
              </div>
            );
          }
          // For minimal-horizontal, just show a message to resize
          return (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Resize to explore skill mastery.
            </div>
          );
        }
        
        // Regular: Full layout
        return (
          <div className="h-full overflow-y-auto pr-1">
            <SkillMastery 
              showOverall={false} 
              embedded 
              layoutCategory={layoutCategory}
              widgetWidth={widget.w}
              widgetHeight={widget.h}
            />
          </div>
        );
      }
      case 'assignments': {
        if (!userSchoolId) {
          return (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Connect your school account to see assignments here.
            </div>
          );
        }
        if (!assignments.length) {
          return (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No assignments yet. Check back later.
            </div>
          );
        }
        return (
          <div className="h-full overflow-y-auto pr-1 space-y-2">
            {assignments.map((a) => {
              const goal = Number(a.minutesGoal || 0);
              const progress = Math.max(0, Math.min(100, goal > 0 ? Math.round((a.progressMinutes || 0) / goal * 100) : 0));
              return (
                <div key={a.id} className="border-2 border-border rounded-xl p-2 bg-background">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="font-medium truncate max-w-[40%] text-foreground">{a.title}</div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant={a.subject === 'math' ? 'secondary' : 'outline'} className="h-7 px-2" onClick={() => handleSetAssignmentSubject(a.id, 'math')}>Math</Button>
                      <Button size="sm" variant={a.subject === 'rw' ? 'secondary' : 'outline'} className="h-7 px-2" onClick={() => handleSetAssignmentSubject(a.id, 'rw')}>R&W</Button>
                    </div>
                    {a.dueAt ? (
                      <div className="text-xs text-muted-foreground whitespace-nowrap">Due {new Date(a.dueAt).toLocaleDateString()}</div>
                    ) : null}
                    {goal > 0 ? (
                      <div className="ml-auto flex items-center gap-2 w-56">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{a.progressMinutes || 0} / {goal} min</div>
                        <Progress value={progress} className="h-2 flex-1" />
                      </div>
                    ) : (
                      <div className="ml-auto text-xs text-muted-foreground whitespace-nowrap">Progress updates as you practice</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case 'leaderboard': {
        const scope = (widget.config?.scope as 'global' | 'my-school' | 'friends') || 'global';
        const entries = getLeaderboardEntriesForScope(scope);
        const userIndex = entries.findIndex((entry) => entry.userId === user?.uid);
        if (leaderboardLoading) {
          return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading leaderboard…</div>;
        }
        if (!entries.length) {
          return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Leaderboard data is not available yet.</div>;
        }

        // Migrated to new layout category system
        // 'minimal' = 2x2, show just rank (was 'small' with is2x2)
        if (layoutCategory === 'minimal') {
          const rank = userIndex >= 0 ? entries[userIndex].rank : null;
          return (
            <div className="h-full flex flex-col">
              {isEditingDashboard && (
                <Select value={scope} onValueChange={(value) => updateWidgetConfig('leaderboard', { scope: value }, true)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="friends">Friends</SelectItem>
                    {userSchoolId && (
                      <SelectItem value="my-school">My School</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
              <div className="flex-1 flex flex-col justify-center text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Your Rank</div>
                <div className="text-4xl font-extrabold text-foreground">{rank ? `#${rank}` : '--'}</div>
              </div>
            </div>
          );
        }
        // 'minimal-vertical' = 2x3, 2x4, etc. - show board like regular layout, calculate rows that fit
        if (layoutCategory === 'minimal-vertical') {
          // Calculate how many rows can fit based on widget height
          // CardContent has pt-2 (8px top) + pb-2 (8px bottom) = 16px vertical padding for minimal-vertical
          const gridUnitPx = 80; // Grid unit size in pixels
          const cardContentPadding = 8 + 8; // pt-2 + pb-2 = 16px total vertical padding
          const selectHeight = 32; // h-8 = 32px
          const gap = 12; // gap-3 = 12px
          const rowHeight = 28; // Actual height per row (text-sm with small avatar)
          const rowGap = 8; // space-y-2 = 8px between rows
          
          // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableHeight = widget.h * gridUnitPx - cardContentPadding - selectHeight - gap;
          const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
          
          // Show entries around the user, similar to regular layout
          const start = userIndex >= 0 ? Math.max(0, userIndex - Math.floor((rowsThatFit - 1) / 2)) : 0;
          const slice = entries.slice(start, start + rowsThatFit);
          
          return (
            <div className="h-full flex flex-col gap-3">
              <Select value={scope} onValueChange={(value) => updateWidgetConfig('leaderboard', { scope: value }, true)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="friends">Friends</SelectItem>
                  {userSchoolId && (
                    <SelectItem value="my-school">My School</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {slice.map((entry) => (
                  <div 
                    key={entry.userId} 
                    className={cn(
                      'flex items-center gap-3 text-sm', 
                      entry.userId === user?.uid && 'font-semibold text-foreground',
                      entry.username && 'cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors'
                    )}
                    onClick={() => entry.username && router.push(`/friends/${entry.username}`)}
                  >
                    <span className="text-xs text-muted-foreground w-6">#{entry.rank}</span>
                    <CustomAvatar size="sm" icon={entry.avatarIcon} color={entry.avatarColor} fallbackText={getInitials(entry.displayName || 'U')} />
                    <div className="flex-1 truncate">{entry.displayName}</div>
                    <span className="text-xs text-muted-foreground">{Math.round(entry.overallCompetency)}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        // 'minimal-horizontal' = 3x2, 4x2, etc. - show buttons and rank (was 'small' with !is2x2 && !isWidth2Or3)
        if (layoutCategory === 'minimal-horizontal') {
          const rank = userIndex >= 0 ? entries[userIndex].rank : null;
          return (
            <div className="h-full flex flex-col">
              <div className="flex gap-2 justify-center items-center w-full px-1">
                {(['global', 'friends', ...(userSchoolId ? ['my-school'] : [])] as const).map((opt) => (
                  <Button key={opt} size="sm" variant={scope === opt ? 'secondary' : 'outline'} className="h-7 px-2 flex-1 min-w-0" onClick={() => updateWidgetConfig('leaderboard', { scope: opt }, true)}>
                    <span className="truncate">{opt === 'global' ? 'Global' : opt === 'friends' ? 'Friends' : 'School'}</span>
                  </Button>
                ))}
              </div>
              <div className="text-center mt-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Your Rank</div>
                <div className="text-4xl font-extrabold text-foreground">{rank ? `#${rank}` : '--'}</div>
              </div>
            </div>
          );
        }
        // 'regular' with smaller width (< 6 grid units) = calculate rows that fit based on height (no button)
        if (layoutCategory === 'regular' && widget.w < 6) {
          // Calculate how many rows can fit based on widget height
          // CardContent has pt-6 (24px top) + pb-2 (8px bottom) = 32px vertical padding
          const gridUnitPx = 80; // Grid unit size in pixels
          const cardContentPadding = 24 + 8; // pt-6 + pb-2 = 32px total vertical padding
          const selectHeight = 32; // h-8 = 32px
          const gap = 12; // gap-3 = 12px
          const rowHeight = 28; // Actual height per row (text-sm with small avatar)
          const rowGap = 8; // space-y-2 = 8px between rows
          
          // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableHeight = widget.h * gridUnitPx - cardContentPadding - selectHeight - gap;
          const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
          
          // Show entries around the user, similar to minimal-vertical
          const start = userIndex >= 0 ? Math.max(0, userIndex - Math.floor((rowsThatFit - 1) / 2)) : 0;
          const slice = entries.slice(start, start + rowsThatFit);
          
          return (
            <div className="h-full flex flex-col gap-3">
              <Select value={scope} onValueChange={(value) => updateWidgetConfig('leaderboard', { scope: value }, true)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="friends">Friends</SelectItem>
                  {userSchoolId && (
                    <SelectItem value="my-school">My School</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {slice.map((entry) => (
                  <div 
                    key={entry.userId} 
                    className={cn(
                      'flex items-center gap-3 text-sm', 
                      entry.userId === user?.uid && 'font-semibold text-foreground',
                      entry.username && 'cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors'
                    )}
                    onClick={() => entry.username && router.push(`/friends/${entry.username}`)}
                  >
                    <span className="text-xs text-muted-foreground w-6">#{entry.rank}</span>
                    <CustomAvatar size="sm" icon={entry.avatarIcon} color={entry.avatarColor} fallbackText={getInitials(entry.displayName || 'U')} />
                    <div className="flex-1 truncate">{entry.displayName}</div>
                    <span className="text-xs text-muted-foreground">{Math.round(entry.overallCompetency)}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        // 'regular' with larger width = calculate rows that fit based on height (account for button)
        return (
          <div className="h-full flex flex-col gap-3">
            <Select value={scope} onValueChange={(value) => updateWidgetConfig('leaderboard', { scope: value }, true)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="friends">Friends</SelectItem>
                {userSchoolId && (
                  <SelectItem value="my-school">My School</SelectItem>
                )}
              </SelectContent>
            </Select>
            {/* Calculate how many rows can fit based on widget height */}
            {(() => {
              // CardContent has pt-6 (24px top) + pb-2 (8px bottom) = 32px vertical padding
              const gridUnitPx = 80; // Grid unit size in pixels
              const cardContentPadding = 24 + 8; // pt-6 + pb-2 = 32px total vertical padding
              const selectHeight = 32; // h-8 = 32px
              const gap = 12; // gap-3 = 12px
              const buttonHeight = 32; // Button height (size="sm")
              const rowHeight = 28; // Actual height per row (text-sm with small avatar)
              const rowGap = 8; // space-y-2 = 8px between rows
              
              // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
              // Account for cardContent padding, select, gap, and button
              const availableHeight = widget.h * gridUnitPx - cardContentPadding - selectHeight - gap - buttonHeight - gap;
              const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
              
              // Show entries around the user
              const start = userIndex >= 0 ? Math.max(0, userIndex - Math.floor((rowsThatFit - 1) / 2)) : 0;
              const slice = entries.slice(start, start + rowsThatFit);
              
              return (
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {slice.map((entry) => (
                    <div 
                      key={entry.userId} 
                      className={cn(
                        'flex items-center gap-3 text-sm', 
                        entry.userId === user?.uid && 'font-semibold text-foreground',
                        entry.username && 'cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors'
                      )}
                      onClick={() => entry.username && router.push(`/friends/${entry.username}`)}
                    >
                      <span className="text-xs text-muted-foreground w-6">#{entry.rank}</span>
                      <CustomAvatar size="sm" icon={entry.avatarIcon} color={entry.avatarColor} fallbackText={getInitials(entry.displayName || 'U')} />
                      <div className="flex-1 truncate">{entry.displayName}</div>
                      <span className="text-xs text-muted-foreground">{Math.round(entry.overallCompetency)}%</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <Button size="sm" variant="outline" onClick={() => router.push('/leaderboard')}>Open leaderboard</Button>
          </div>
        );
      }
      case 'friendsActivity': {
        if (friendsActivityLoading) {
          return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading friends…</div>;
        }
        if (!friendsActivity.length) {
          return (
            <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-3">
              No friends activity yet.
              <Button size="sm" variant="outline" onClick={() => router.push('/friends')}>Find Friends</Button>
            </div>
          );
        }
        const sorted = [...friendsActivity].sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
        
        if (layoutCategory === 'minimal') {
          // Minimal: Show just count or top friend
          const topFriend = sorted[0];
          return (
            <div className="h-full flex flex-col items-center justify-center gap-1 px-2">
              {topFriend ? (
                <div 
                  className={cn("flex flex-col items-center gap-1 w-full", topFriend.username && "cursor-pointer hover:opacity-80 transition-opacity")}
                  onClick={() => topFriend.username && router.push(`/friends/${topFriend.username}`)}
                >
                  <CustomAvatar size="sm" icon={topFriend.avatarIcon} color={topFriend.avatarColor} fallbackText={getInitials(topFriend.displayName || 'U')} />
                  <div className="text-xs font-medium text-foreground truncate w-full text-center">{topFriend.displayName}</div>
                  {typeof topFriend.recentGains === 'number' && (
                    <div className="text-[10px] text-emerald-600">+{topFriend.recentGains.toFixed(1)}%</div>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Friends</div>
                  <div className="text-2xl font-extrabold text-foreground">{sorted.length}</div>
                </>
              )}
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-vertical') {
          // Minimal-vertical: Calculate rows that fit based on widget height
          // CardContent has pt-2 (8px top) + pb-2 (8px bottom) = 16px vertical padding for minimal-vertical
          const gridUnitPx = 80; // Grid unit size in pixels
          const cardContentPadding = 8 + 8; // pt-2 + pb-2 = 16px total vertical padding
          const rowHeight = 40; // Actual height per row (text-xs with two-line text + avatar)
          const rowGap = 6; // gap-1.5 = 6px between rows
          
          // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableHeight = widget.h * gridUnitPx - cardContentPadding;
          const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
          
          const visible = sorted.slice(0, rowsThatFit);
          return (
            <div className="h-full flex flex-col gap-1.5 px-2 py-1 overflow-y-auto">
              {visible.map((friend) => (
                <div 
                  key={friend.userId} 
                  className={cn("flex items-center gap-2", friend.username && "cursor-pointer hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors")}
                  onClick={() => friend.username && router.push(`/friends/${friend.username}`)}
                >
                  <CustomAvatar size="sm" icon={friend.avatarIcon} color={friend.avatarColor} fallbackText={getInitials(friend.displayName || 'U')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{friend.displayName}</div>
                    <div className="text-[10px] text-muted-foreground">{formatLastActive(friend.lastActive)}</div>
                  </div>
                  {typeof friend.recentGains === 'number' && (
                    <span className="text-[10px] font-semibold text-emerald-600">+{friend.recentGains.toFixed(1)}%</span>
                  )}
                </div>
              ))}
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-horizontal') {
          // Minimal-horizontal: Calculate how many friends can fit based on widget width (doubled density)
          const gridUnitPx = 80; // Grid unit size in pixels
          const padding = 8 * 2; // px-2 * 2 = 16px total horizontal padding
          const cardMinWidth = 60; // Minimum width per card (reduced for higher density)
          const gap = 4; // gap-1 = 4px between cards (reduced gap)
          
          // widget.w is in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableWidth = widget.w * gridUnitPx - padding;
          const friendsThatFit = Math.max(1, Math.floor(availableWidth / (cardMinWidth + gap)));
          
          const visible = sorted.slice(0, friendsThatFit);
          return (
            <div className="h-full flex items-center gap-1 px-2">
              {visible.map((friend) => (
                <div 
                  key={friend.userId} 
                  className={cn("flex-1 flex flex-col items-center gap-0.5 min-w-0", friend.username && "cursor-pointer hover:opacity-80 transition-opacity")}
                  onClick={() => friend.username && router.push(`/friends/${friend.username}`)}
                >
                  <CustomAvatar size="sm" icon={friend.avatarIcon} color={friend.avatarColor} fallbackText={getInitials(friend.displayName || 'U')} />
                  <div className="text-[10px] font-medium text-foreground truncate w-full text-center">{friend.displayName}</div>
                  {typeof friend.recentGains === 'number' && (
                    <div className="text-[9px] text-emerald-600">+{friend.recentGains.toFixed(1)}%</div>
                  )}
                </div>
              ))}
            </div>
          );
        }
        
        // Regular: Calculate rows that fit based on widget height
        // Split into smaller width (< 6) and larger width (>= 6) with button
        if (layoutCategory === 'regular' && widget.w < 6) {
          // Regular with smaller width (< 6 grid units) = calculate rows that fit (no button)
          const gridUnitPx = 80; // Grid unit size in pixels
          const cardContentPadding = 24 + 8; // pt-6 + pb-2 = 32px total vertical padding
          const rowHeight = 44; // Actual height per row (text-sm with two-line text + avatar)
          const rowGap = 8; // space-y-2 = 8px between rows
          
          // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
          const availableHeight = widget.h * gridUnitPx - cardContentPadding;
          const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
          
          const visible = sorted.slice(0, rowsThatFit);
          return (
            <div className="h-full flex flex-col gap-2">
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {visible.map((friend) => (
                  <div 
                    key={friend.userId} 
                    className={cn("flex items-center gap-3 text-sm", friend.username && "cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors")}
                    onClick={() => friend.username && router.push(`/friends/${friend.username}`)}
                  >
                    <CustomAvatar size="sm" icon={friend.avatarIcon} color={friend.avatarColor} fallbackText={getInitials(friend.displayName || 'U')} />
                    <div className="flex-1 truncate">
                      <div className="font-medium text-foreground">{friend.displayName}</div>
                      <div className="text-xs text-muted-foreground">{formatLastActive(friend.lastActive)}</div>
                    </div>
                    {typeof friend.recentGains === 'number' && (
                      <span className="text-xs font-semibold text-emerald-600">+{friend.recentGains.toFixed(1)}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        
        // Regular with larger width (>= 6 grid units) = calculate rows that fit (with button)
        return (
          <div className="h-full flex flex-col gap-2">
            {/* Calculate how many rows can fit based on widget height */}
            {(() => {
              // CardContent has pt-6 (24px top) + pb-2 (8px bottom) = 32px vertical padding
              const gridUnitPx = 80; // Grid unit size in pixels
              const cardContentPadding = 24 + 8; // pt-6 + pb-2 = 32px total vertical padding
              const buttonHeight = 32; // Button height (size="sm")
              const rowHeight = 44; // Actual height per row (text-sm with two-line text + avatar)
              const rowGap = 8; // space-y-2 = 8px between rows
              
              // widget.h is in GRID UNITS, so multiply by gridUnitPx to get pixels
              // Account for cardContent padding and button
              const availableHeight = widget.h * gridUnitPx - cardContentPadding - buttonHeight - 8; // 8px gap before button
              const rowsThatFit = Math.max(1, Math.floor(availableHeight / (rowHeight + rowGap)));
              
              const visible = sorted.slice(0, rowsThatFit);
              
              return (
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {visible.map((friend) => (
                    <div key={friend.userId} className="flex items-center gap-3 text-sm">
                      <CustomAvatar size="sm" icon={friend.avatarIcon} color={friend.avatarColor} fallbackText={getInitials(friend.displayName || 'U')} />
                      <div className="flex-1 truncate">
                        <div className="font-medium text-foreground">{friend.displayName}</div>
                        <div className="text-xs text-muted-foreground">{formatLastActive(friend.lastActive)}</div>
                      </div>
                      {typeof friend.overallCompetency === 'number' && (
                        <span className="text-xs font-semibold text-emerald-600">{Math.round(friend.overallCompetency)}%</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
            <Button size="sm" variant="outline" className="w-full" onClick={() => router.push('/friends')}>
              View all friends
            </Button>
          </div>
        );
      }
      case 'myTutor': {
        const layoutCategory = getWidgetLayoutCategory(widget);
        
        // Calculate orb size based on widget size (only width, height will be set by aspect ratio)
        const getOrbSize = () => {
          if (layoutCategory === 'minimal') return 'w-16';
          if (layoutCategory === 'minimal-vertical') return 'w-20';
          if (layoutCategory === 'minimal-horizontal') return 'w-20'; // Slightly smaller to fit better
          // For regular layout, use w-20 if height is 3 grid units, otherwise w-32
          if (layoutCategory === 'regular' && widget.h === 3) return 'w-20';
          return 'w-32';
        };
        
        const orbSize = getOrbSize();
        
        // Tutor orb component (simplified version of the one in TutorLiveCoach)
        const TutorOrb = () => {
          const [blobShape, setBlobShape] = useState({ tl: 50, tr: 50, br: 50, bl: 50, rot: 0, skewX: 0, skewY: 0, scale: 1 });
          
          // Animate the orb with subtle movement
          useEffect(() => {
            const interval = setInterval(() => {
              const intensity = 0.3; // Subtle animation
              const jitter = 15 * intensity;
              const rand = () => (Math.random() - 0.5);
              setBlobShape({
                tl: Math.max(40, Math.min(60, 50 + rand() * jitter)),
                tr: Math.max(40, Math.min(60, 50 + rand() * jitter)),
                br: Math.max(40, Math.min(60, 50 + rand() * jitter)),
                bl: Math.max(40, Math.min(60, 50 + rand() * jitter)),
                rot: rand() * 8 * intensity,
                skewX: rand() * 4 * intensity,
                skewY: rand() * 4 * intensity,
                scale: 1 + 0.1 * intensity,
              });
            }, 2000);
            return () => clearInterval(interval);
          }, []);
          
          return (
            <div className={cn("relative flex-shrink-0", orbSize)} style={{ aspectRatio: '1 / 1' }}>
              <div
                className="absolute inset-0 bg-[#93d333] cursor-pointer hover:bg-[#95DF26] transition-colors"
                style={{
                  borderRadius: `${blobShape.tl}% ${blobShape.tr}% ${blobShape.br}% ${blobShape.bl}% / ${blobShape.tr}% ${blobShape.br}% ${blobShape.bl}% ${blobShape.tl}%`,
                  opacity: 0.9,
                  transform: `translateZ(0) rotate(${blobShape.rot}deg) skew(${blobShape.skewX}deg, ${blobShape.skewY}deg) scale(${blobShape.scale})`,
                  transition: 'transform 200ms ease, border-radius 300ms ease, opacity 200ms ease, background-color 200ms ease',
                  boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.1)'
                }}
              />
              <div
                className="absolute inset-2 rounded-full bg-white opacity-20"
                style={{
                  transform: 'scale(0.8) translate(-10%, -10%)',
                  filter: 'blur(6px)'
                }}
              />
            </div>
          );
        };
        
        if (layoutCategory === 'minimal') {
          return (
            <div className="h-full flex items-center justify-center">
              <button
                onClick={() => { window.location.href = '/my-tutor?autoStart=true'; }}
                className="focus:outline-none focus:ring-2 focus:ring-[#93d333] focus:ring-offset-2 rounded-full"
                aria-label="Open Tutor"
              >
                <TutorOrb />
              </button>
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-vertical') {
          return (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <button
                onClick={() => { window.location.href = '/my-tutor?autoStart=true'; }}
                className="focus:outline-none focus:ring-2 focus:ring-[#93d333] focus:ring-offset-2 rounded-full"
                aria-label="Open Tutor"
              >
                <TutorOrb />
              </button>
              <p className="text-xs font-semibold text-foreground">{tutorName}</p>
            </div>
          );
        }
        
        if (layoutCategory === 'minimal-horizontal') {
          return (
            <div className="h-full flex items-center justify-between px-2">
              <div>
                <p className="text-xs font-semibold text-foreground">{tutorName}</p>
                <p className="text-[10px] text-muted-foreground">{tutorVoice || 'AI Tutor'}</p>
              </div>
              <div className="flex items-center justify-center flex-shrink-0 pt-3 pb-1">
                <button
                  onClick={() => { window.location.href = '/my-tutor?autoStart=true'; }}
                  className="focus:outline-none focus:ring-2 focus:ring-[#93d333] focus:ring-offset-2 rounded-full"
                  aria-label="Open Tutor"
                >
                  <TutorOrb />
                </button>
              </div>
            </div>
          );
        }
        
        // Regular layout
        return (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <button
              onClick={() => { window.location.href = '/my-tutor?autoStart=true'; }}
              className="focus:outline-none focus:ring-2 focus:ring-[#93d333] focus:ring-offset-2 rounded-full"
              aria-label="Open Tutor"
            >
              <TutorOrb />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">{tutorName}</p>
              <p className="text-xs text-muted-foreground">{tutorVoice ? `Voice: ${tutorVoice}` : 'Your always-on AI tutor.'}</p>
            </div>
          </div>
        );
      }
      case 'stickyNote': {
        const note = String(widget.config?.note || '');
        const fontSize = Number(widget.config?.fontSize || 16);
        
        return (
          <StickyNoteWidget
            note={note}
            fontSize={fontSize}
            isEditing={isEditingDashboard}
            onUpdateNote={(newNote) => updateWidgetConfig('stickyNote', { note: newNote }, false)}
            onUpdateFontSize={(newFontSize) => updateWidgetConfig('stickyNote', { fontSize: newFontSize }, false)}
          />
        );
      }
      case 'statAccuracy':
        return renderStatWidget('Accuracy', hasStats ? `${userStats!.averageAccuracy.toFixed(1)}%` : '--', 'Last 15 days');
      case 'statStudyTime':
        return renderStatWidget(
          'Study Time',
          hasStats ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : '--',
          hasStats ? `${minutesLast7} min in last 7 days` : 'Start practicing to unlock'
        );
      case 'statQuestions':
        return renderStatWidget(
          'Questions',
          hasStats ? `${totalQuestions}` : '--',
          hasStats ? 'All-time answered' : 'Answer a few questions first'
        );
      case 'statPoints':
        return renderStatWidget(
          'Point Boost',
          hasStats ? `${pointsIncrease}` : '--',
          hasStats ? 'Based on practice time' : 'Points grow with practice'
        );
      case 'statProjectedScore':
        return renderStatWidget(
          'Projected',
          projectedScore ? `${projectedScore}` : '--',
          projectedScore ? 'Based on baseline' : 'Set baseline in onboarding'
        );
      default:
        return null;
    }
  };

  const renderWidget = (widget: DashboardWidget) => {
    const meta = WIDGET_DEFINITIONS[widget.type];
    const gridW = widget.w / GRID_SCALE;
    const gridH = widget.h / GRID_SCALE;
    
    // Get the layout category (minimal, minimal-vertical, minimal-horizontal, regular)
    const layoutCategory = getWidgetLayoutCategory(widget);
    
    // Check if the widget is 1x2 logical units (which is gridH=1, gridW=2 in grid units if scale=2)
    // Wait, if gridScale is 2, a "1x2" widget (logical) would have w=4, h=2 (so gridW=2, gridH=1).
    // The user's definition of "width 2" seems to be logical units.
    const isPractice1x2 = widget.type === 'practice' && Math.round(gridH) === 1 && Math.round(gridW) === 2;
    const isPracticeNx1 = widget.type === 'practice' && Math.round(gridW) === 1;
    const isPractice2x2 = widget.type === 'practice' && widget.w === 2 && widget.h === 2; // 2x2 grid units
    const isPracticeWidth2 = widget.type === 'practice' && widget.w === 2 && widget.h !== 2; // width 2 but not 2x2

    // Hide header for minimal sizes (except practice, streak, leaderboard which handle their own headers)
    // For myTutor, also hide header for minimal-vertical and minimal-horizontal
    const shouldHideHeader = 
      (layoutCategory === 'minimal' || 
       (widget.type === 'myTutor' && (layoutCategory === 'minimal-vertical' || layoutCategory === 'minimal-horizontal'))) &&
      widget.type !== 'practice' && 
      widget.type !== 'streak' && 
      widget.type !== 'leaderboard';

    const iconMap: Record<WidgetType, React.ReactElement> = {
      practice: <BookOpenCheck className="h-4 w-4" />,
      streak: <Flame className="h-4 w-4" />,
      leaderboard: <Trophy className="h-4 w-4" />,
      friendsActivity: <Users className="h-4 w-4" />,
      myTutor: <Sparkles className="h-4 w-4" />,
      stickyNote: <MessageSquareQuote className="h-4 w-4" />,
      masteryProgress: <BarChart3 className="h-4 w-4" />,
      skillMastery: <Sparkles className="h-4 w-4" />,
      strengthsWeaknesses: <Sparkles className="h-4 w-4" />,
      assignments: <BookOpenCheck className="h-4 w-4" />,
      statAccuracy: <BarChart3 className="h-4 w-4" />,
      statStudyTime: <BarChart3 className="h-4 w-4" />,
      statQuestions: <BarChart3 className="h-4 w-4" />,
      statPoints: <BarChart3 className="h-4 w-4" />,
      statProjectedScore: <BarChart3 className="h-4 w-4" />,
    };

    return (
      <Card className={cn(
        "relative h-full flex flex-col rounded-2xl border-2 border-border border-b-4 shadow-none gap-0",
        widget.type === 'stickyNote' ? "bg-[#FFF8D6] border-[#E8D28A]" : "bg-card"
      )}>
        {widget.type !== 'stickyNote' && widget.type !== 'streak' && widget.type !== 'leaderboard' && !shouldHideHeader && (
          <CardHeader className={cn(
            "pb-2",
            isPractice1x2 && "px-4 pt-4 pb-1",
            isPracticeNx1 && "px-0 pt-2 pb-0",
            isPractice2x2 && "px-0 pt-1 pb-0 flex items-center justify-center",
            widget.type === 'myTutor' && "pb-0"
          )}>
          <div className={cn(
            "flex items-start justify-between gap-3",
            isPractice2x2 && "w-full justify-center"
          )}>
            <div className={cn(
              "min-w-0 flex-1",
              isPractice2x2 && "flex justify-center"
            )}>
              <div className={cn(
                "flex items-center gap-2 uppercase tracking-wider text-muted-foreground font-bold truncate",
                isPracticeNx1 && "justify-center gap-0 scale-90 origin-top text-sm mt-2",
                isPractice2x2 && "justify-center gap-0 text-sm mt-2",
                !isPracticeNx1 && !isPractice2x2 && "text-xs"
              )}>
                {!isPracticeNx1 && !isPractice2x2 && iconMap[widget.type]}
                <span className="truncate">{(isPracticeNx1 || isPractice2x2) ? 'Practice' : meta.title}</span>
              </div>
              {!isPractice1x2 && !isPracticeNx1 && !isPractice2x2 && (
                <CardDescription className="text-xs text-muted-foreground truncate">{meta.description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        )}
        {isEditingDashboard && !meta.mandatory && (
          <button
            type="button"
            aria-label={`Remove ${meta.title}`}
            className="absolute -top-3 -right-3 h-8 w-8 rounded-full border-2 border-border bg-background text-foreground shadow-md flex items-center justify-center text-lg font-semibold leading-none z-20"
            onClick={() => handleRemoveWidget(widget.type)}
          >
            -
          </button>
        )}
        <CardContent className={cn(
          "flex-1 min-h-0 overflow-hidden", 
          isPractice1x2 && "pt-2", 
          isPracticeNx1 && "px-1 pb-2",
          isPractice2x2 && "px-1 -mt-1 pb-2",
          isPracticeWidth2 && "px-1 pt-2 pb-2",
          widget.type === 'leaderboard' && "pt-6",
          widget.type === 'stickyNote' && "pt-6",
          // Minimal sizes: maximize space, minimal padding
          shouldHideHeader && "p-1",
          layoutCategory === 'minimal-vertical' && !shouldHideHeader && "pt-2 px-2",
          layoutCategory === 'minimal-horizontal' && !shouldHideHeader && "pt-2 px-2",
          // SkillMastery: responsive padding based on size
          widget.type === 'skillMastery' && layoutCategory === 'regular' && (
            (widget.w < 6 || widget.h < 4) ? "px-2" : 
            (widget.w < 8 && widget.h < 6) ? "px-3" : 
            "px-4"
          )
        )}>
          {renderWidgetContent(widget)}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen ambient-bg">
      {!isEditingDashboard && (
        <Sidebar />
      )}
      {isEditingDashboard && (
        <div className="hidden md:flex fixed left-4 top-4 bottom-4 z-30 flex-col bg-background border-2 border-border rounded-3xl overflow-hidden w-64">
          <div className="flex items-center justify-between p-6">
            <Image src="/text-logo.png" alt="CultivatED Logo" width={120} height={40} className="dark:brightness-0 dark:invert" />
          </div>
          <div className="flex-1 px-4 pb-4 overflow-y-auto no-scrollbar">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Widget Store</div>
              <p className="text-xs text-muted-foreground mt-1">Drag widgets onto the canvas or click add.</p>
            </div>
            <div className="space-y-3">
              {availableWidgets.length > 0 ? (
                availableWidgets.map((type) => (
                  <div
                    key={type}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-cultivated-widget', type);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="border-2 border-border rounded-xl p-3 bg-background flex items-start justify-between gap-3 cursor-grab active:cursor-grabbing"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{WIDGET_DEFINITIONS[type].title}</p>
                      <p className="text-xs text-muted-foreground">{WIDGET_DEFINITIONS[type].description}</p>
                    </div>
                    <Button size="sm" onClick={() => handleAddWidget(type)}>
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">All widgets are already on your dashboard.</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "ml-0 md:ml-16" : "ml-0 md:ml-64"
      )}>
        <div className="px-4 md:pl-10 md:pr-6 pt-5 pb-6">
          <FirstTimeExperience 
            isVisible={showFirstTimeExperience}
            onComplete={handleFirstTimeExperienceComplete}
          />
          <FirstSessionComplete
            isVisible={showFirstSessionComplete}
            onContinue={handleFirstSessionCompleteContinue}
          />

          <ProfileCompletionBanner />

          <HeroSection 
            userName={userName} 
            onStart10Math={() => startPracticeSession(10, 'Math')} 
            onStart10RW={() => startPracticeSession(10, 'Reading & Writing')} 
            onStart20Math={() => startPracticeSession(20, 'Math')} 
            onStart20RW={() => startPracticeSession(20, 'Reading & Writing')} 
            overallMastery={hasStats ? (userStats.competencyScore ?? userStats.averageAccuracy) : undefined}
            dayStreak={dayStreak}
            metrics={metricsData}
            headerAction={
              isEditingDashboard ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEditDashboard} disabled={isSavingDashboard}>Cancel</Button>
                  <Button variant="outline" size="sm" onClick={handleResetDashboard} disabled={isSavingDashboard}>Reset</Button>
                  <Button size="sm" onClick={handleToggleEditDashboard} disabled={isSavingDashboard}>
                    <Check className="h-4 w-4" /> {isSavingDashboard ? 'Saving' : 'Done'}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={handleToggleEditDashboard}>
                  <Pencil className="h-4 w-4" /> Edit Dashboard
                </Button>
              )
            }
          />

          {userSchoolId && assignments.some(a => (a.minutesGoal || 0) > (a.progressMinutes || 0)) && (
            <div className="mt-6 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <School className="h-4 w-4" />
                  Active Assignments
                </div>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 text-muted-foreground hover:text-primary"
                  onClick={() => router.push('/school')}
                >
                  View All
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {assignments
                  .filter(a => (a.minutesGoal || 0) > (a.progressMinutes || 0))
                  .slice(0, 3)
                  .map((a) => {
                    const goal = Number(a.minutesGoal || 0);
                    const progress = Math.max(0, Math.min(100, goal > 0 ? Math.round((a.progressMinutes || 0) / goal * 100) : 0));
                    return (
                      <Card key={a.id} className="border-2 border-border/50 bg-card/50 shadow-none hover:bg-card transition-colors cursor-pointer" onClick={() => router.push('/school')}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="font-medium text-sm truncate" title={a.title}>{a.title}</div>
                            {a.dueAt && (
                              <div className="text-[10px] text-muted-foreground whitespace-nowrap px-1.5 py-0.5 rounded bg-muted">
                                Due {new Date(a.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                              {a.progressMinutes || 0} / {goal}m
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="mt-8">
            {dashboardLayout.length > 0 ? (
              <BentoGrid
                items={dashboardLayout}
                isEditing={isEditingDashboard}
                onLayoutChange={setDashboardLayout}
                onColsChange={setGridCols}
                gridScale={GRID_SCALE}
                renderItem={renderWidget}
                className="min-h-[200px]"
                onDropItem={(payload) => handleAddWidget(payload.type as WidgetType, { x: payload.x, y: payload.y })}
              />
            ) : (
              <Card className="border-2 border-border border-b-4 shadow-none bg-card rounded-2xl">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Your dashboard is empty. Add widgets or reset to the default layout.
                </CardContent>
              </Card>
            )}
          </div>

          <p className="mt-8 pb-4 text-center text-xs text-muted-foreground">
            CultivatED is currently in beta. You may encounter occasional product bugs.
          </p>
        </div>
      </div>
      
      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume Session?</AlertDialogTitle>
            <AlertDialogDescription>
              {existingSessionInfo 
                ? `You have an ongoing practice session in ${existingSessionInfo.subject} for ${existingSessionInfo.duration} minutes. Would you like to resume it, or start a new one?`
                : "You have an ongoing practice session on another device or tab. Would you like to resume it, or start a new one?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-transparent border border-input text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => {
                e.preventDefault();
                setShowResumeDialog(false);
                if (pendingSessionConfig) {
                  startPracticeSession(pendingSessionConfig.duration, pendingSessionConfig.subject, true);
                }
              }}
            >
              Start New Session
            </AlertDialogAction>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                setShowResumeDialog(false);
                window.location.href = '/practice';
              }}
            >
              Resume
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * A wrapper component that provides a Suspense boundary for the dashboard content.
 * This is the default export for the dashboard page route.
 */
export default function DashboardPage() {
  return (
    <NavigationErrorBoundary>
      <Suspense fallback={<Loading />}>
        <DashboardContent />
      </Suspense>
    </NavigationErrorBoundary>
  );
}
