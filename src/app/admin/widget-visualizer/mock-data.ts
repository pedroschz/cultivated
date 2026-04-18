import { ConsistencyMapDay } from '@/components/dashboard/ConsistencyMap';
import { MasteryHistoryEntry } from '@/lib/types/adaptive-learning';
import { DomainSummary } from '@/components/SkillMastery';

// Deterministic seeded random number generator
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Use a fixed base date for deterministic date generation
const BASE_DATE = new Date('2026-01-15T12:00:00Z');

export const mockConsistencyDays: ConsistencyMapDay[] = Array.from({ length: 90 }, (_, i) => {
  const date = new Date(BASE_DATE);
  date.setDate(date.getDate() - (89 - i));
  const seed = i * 7 + 12345; // Deterministic seed based on index
  return {
    date: date.toISOString().split('T')[0],
    minutes: Math.floor(seededRandom(seed) * 60),
    level: Math.floor(seededRandom(seed + 1) * 5) as 0 | 1 | 2 | 3 | 4,
  };
});

export const mockHistoricalData: MasteryHistoryEntry[] = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(BASE_DATE);
  date.setDate(date.getDate() - (6 - i));
  const seed = i * 11 + 54321; // Deterministic seed based on index
  return {
    date: date.toISOString().split('T')[0],
    overall: 50 + seededRandom(seed) * 40,
    math: 40 + seededRandom(seed + 1) * 50,
    readingWriting: 60 + seededRandom(seed + 2) * 30,
  };
});

export const mockUserStats = {
  averageAccuracy: 78,
  strengths: [
    { domain: 'Math', subdomain: 'Algebra', accuracy: 95 },
    { domain: 'R&W', subdomain: 'Grammar', accuracy: 88 },
  ],
  weaknesses: [
    { domain: 'Math', subdomain: 'Geometry', accuracy: 45 },
    { domain: 'R&W', subdomain: 'Vocabulary', accuracy: 52 },
  ],
};

export const mockLeaderboardEntries = [
  {
    userId: '1',
    displayName: 'You',
    rank: 4,
    overallCompetency: 82,
    avatarIcon: 'robot',
    avatarColor: 'blue',
  },
  {
    userId: '2',
    displayName: 'Alice',
    rank: 1,
    overallCompetency: 95,
    avatarIcon: 'cat',
    avatarColor: 'purple',
  },
  {
    userId: '3',
    displayName: 'Bob',
    rank: 2,
    overallCompetency: 91,
    avatarIcon: 'dog',
    avatarColor: 'green',
  },
  {
    userId: '4',
    displayName: 'Charlie',
    rank: 3,
    overallCompetency: 88,
    avatarIcon: 'bear',
    avatarColor: 'orange',
  },
  {
    userId: '5',
    displayName: 'David',
    rank: 5,
    overallCompetency: 75,
    avatarIcon: 'fox',
    avatarColor: 'red',
  },
];

// Use a fixed base time for deterministic dates (same as BASE_DATE)
const BASE_TIME = BASE_DATE.getTime();

export const mockFriendsActivity = [
  {
    userId: '2',
    displayName: 'Alice',
    lastActive: BASE_TIME - 1000 * 60 * 1, // 1 min ago (online)
    overallCompetency: 95,
    recentGains: 12.5, // Cumulative gains from last practice session
    avatarIcon: 'cat',
    avatarColor: 'purple',
  },
  {
    userId: '3',
    displayName: 'Bob',
    lastActive: BASE_TIME - 1000 * 60 * 30, // 30 mins ago
    overallCompetency: 91,
    recentGains: 8.3,
    avatarIcon: 'dog',
    avatarColor: 'green',
  },
  {
    userId: '4',
    displayName: 'Charlie',
    lastActive: BASE_TIME - 1000 * 60 * 60 * 3, // 3 hours ago
    overallCompetency: 88,
    recentGains: 15.2,
    avatarIcon: 'bear',
    avatarColor: 'orange',
  },
  {
    userId: '5',
    displayName: 'David',
    lastActive: BASE_TIME - 1000 * 60 * 60 * 12, // 12 hours ago
    overallCompetency: 75,
    recentGains: 5.7,
    avatarIcon: 'fox',
    avatarColor: 'red',
  },
];

export const mockAssignments = [
  {
    id: '1',
    title: 'Algebra Practice',
    subject: 'math',
    dueAt: new Date(BASE_TIME + 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days
    minutesGoal: 30,
    progressMinutes: 15,
  },
  {
    id: '2',
    title: 'Reading Comprehension',
    subject: 'rw',
    dueAt: new Date(BASE_TIME + 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days
    minutesGoal: 45,
    progressMinutes: 0,
  },
];

export const mockSkillMasteryData: DomainSummary[] = [
  {
    domainId: '0', // Algebra (Math)
    domainName: 'Algebra',
    averageCompetency: 75,
    subdomains: [
      {
        subdomainId: '1',
        subdomainName: 'Linear equations in two variables',
        score: {
          competencyScore: 85,
          confidenceLevel: 0.8,
          lastPracticed: BASE_TIME,
          totalAttempts: 10,
          correctCount: 8,
          recentStreak: 3,
          improvementRate: 0.1,
          timeToMastery: 60,
        },
      },
      {
        subdomainId: '2',
        subdomainName: 'Linear functions',
        score: {
          competencyScore: 65,
          confidenceLevel: 0.6,
          lastPracticed: BASE_TIME - 1000 * 60 * 60 * 24,
          totalAttempts: 15,
          correctCount: 9,
          recentStreak: 1,
          improvementRate: 0.05,
          timeToMastery: 120,
        },
      },
    ],
  },
  {
    domainId: '7', // Standard English Conventions (R&W)
    domainName: 'Standard English Conventions',
    averageCompetency: 82,
    subdomains: [
      {
        subdomainId: '32',
        subdomainName: 'Boundaries',
        score: {
          competencyScore: 90,
          confidenceLevel: 0.9,
          lastPracticed: BASE_TIME - 1000 * 60 * 60 * 48,
          totalAttempts: 20,
          correctCount: 18,
          recentStreak: 5,
          improvementRate: 0.15,
          timeToMastery: 30,
        },
      },
    ],
  },
  {
    domainId: '3', // Geometry and Trigonometry (Math)
    domainName: 'Geometry and Trigonometry',
    averageCompetency: 45,
    subdomains: [
      {
        subdomainId: '15',
        subdomainName: 'Area and volume',
        score: {
          competencyScore: 45,
          confidenceLevel: 0.5,
          lastPracticed: BASE_TIME - 1000 * 60 * 60 * 72,
          totalAttempts: 5,
          correctCount: 2,
          recentStreak: 0,
          improvementRate: 0.0,
          timeToMastery: 200,
        },
      },
    ],
  },
];
