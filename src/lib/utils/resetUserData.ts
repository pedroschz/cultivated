import { getFirestore, doc, updateDoc, collection, getDocs, deleteDoc, deleteField } from 'firebase/firestore';
import { app } from '@/lib/firebaseClient';
import { AdaptiveLearningEngine } from '@/lib/adaptive-learning/scoring-engine';
import { ALL_SKILLS } from '@/lib/adaptive-learning/skill-mapping';
import { AdaptiveLearningData, SubdomainScore } from '@/lib/types/adaptive-learning';

/**
 * This module provides utility functions for resetting user data in Firestore.
 * This is useful for allowing users to clear their progress and start over.
 */

/**
 * Resets all practice-related data for a given user, including statistics,
 * history, bookmarks, and adaptive learning progress. This is a complete wipe
 * of their performance data.
 *
 * @param userId The ID of the user whose data will be reset.
 * @throws If Firebase is not initialized or if the update operation fails.
 */
export async function resetUserData(userId: string): Promise<void> {
  if (!app) throw new Error('Firebase app not initialized');

  const db = getFirestore(app);
  const userRef = doc(db, 'users', userId);

  try {
    // Overwrite the fields with their initial or empty states.
    // Delete history and metrics subcollections
    const db = getFirestore(app);
    const historySnap = await getDocs(collection(db, 'users', userId, 'history'));
    for (const d of historySnap.docs) {
      await deleteDoc(d.ref);
    }
    // metrics subcollection has been deprecated and removed; no-op

    const initialAdaptive = buildInitialAdaptiveLearningData();

    await updateDoc(userRef, {
      // Clear user-visible non-critical arrays
      bookmarks: [],
      // Reset adaptive learning to a clean initial state
      adaptiveLearning: initialAdaptive,
      // Clear legacy/derived fields that may still exist
      history: deleteField(),
      stats: deleteField(),
      // Reset UX flags
      flags: {
        hasSeenFirstWrongAnswerTutorial: false,
        hasStartedPractice: false,
        hasCompletedFirstSession: false,
        hasSeenCalculatorTip: false,
        hasSeenRWAnnotatorTip: false,
        showFirstSessionComplete: false
      }
    });

    console.log(`Successfully reset all data for user ${userId}`);
  } catch (error) {
    console.error('Error resetting user data:', error);
    throw error;
  }
}

/**
 * Resets only the user's statistics and adaptive learning data,
 * preserving other data like bookmarks and account preferences.
 *
 * @param userId The ID of the user whose stats will be reset.
 * @throws If Firebase is not initialized or if the update operation fails.
 */
export async function resetUserStats(userId: string): Promise<void> {
  if (!app) throw new Error('Firebase app not initialized');

  const db = getFirestore(app);
  const userRef = doc(db, 'users', userId);

  try {
    // Delete history and metrics subcollections
    const db = getFirestore(app);
    const historySnap = await getDocs(collection(db, 'users', userId, 'history'));
    for (const d of historySnap.docs) {
      await deleteDoc(d.ref);
    }
    // metrics subcollection has been deprecated and removed; no-op

    const initialAdaptive = buildInitialAdaptiveLearningData();

    await updateDoc(userRef, {
      // Reset adaptive learning to a clean initial state
      adaptiveLearning: initialAdaptive,
      // Clear legacy/derived fields that may still exist
      history: deleteField(),
      stats: deleteField(),
      // Reset UX flags related to practice flows
      flags: {
        hasSeenFirstWrongAnswerTutorial: false,
        hasStartedPractice: false,
        hasCompletedFirstSession: false,
        hasSeenCalculatorTip: false,
        hasSeenRWAnnotatorTip: false,
        showFirstSessionComplete: false
      }
    });

    console.log(`Successfully reset statistics for user ${userId}`);
  } catch (error) {
    console.error('Error resetting user statistics:', error);
    throw error;
  }
}

/**
 * Builds the initial adaptive learning data structure matching first-time setup.
 */
function buildInitialAdaptiveLearningData(): AdaptiveLearningData {
  const engine = new AdaptiveLearningEngine();

  const subdomainScores: { [subdomainId: string]: SubdomainScore } = {};
  ALL_SKILLS.forEach((skill) => {
    subdomainScores[skill.subdomainId] = engine.initializeSubdomainScore();
  });

  const domainSummaries = recalculateDomainSummaries(subdomainScores);

  const adaptive: AdaptiveLearningData = {
    subdomainScores,
    domainSummaries,
    learningProfile: {
      learningVelocity: 5,
      retentionRate: 7,
      consistencyScore: 6,
      sessionOptimalLength: 15,
      averageSessionLength: 12,
      preferredDifficultyProgression: 1.2,
      prioritySubdomains: [],
      strongSubdomains: []
    },
    overallCompetency: 50,
    totalQuestionsAnswered: 0,
    totalTimeSpent: 0,
    algorithmVersion: '2.0.0',
    lastFullUpdate: Date.now(),
    lastQuestionUpdate: Date.now(),
    questionQueue: [],
    masteryHistory: [],
    masteryHistoryBackfilled: false,
  };

  // Seed today's snapshot so dashboards render immediately
  const todayIso = getIsoDateString(new Date());
  const mathDomains = ['0','1','2','3'];
  const rwDomains = ['4','5','6','7'];
  const mathValues = mathDomains
    .filter((id) => (domainSummaries as any)[id])
    .map((id) => (domainSummaries as any)[id].averageCompetency);
  const rwValues = rwDomains
    .filter((id) => (domainSummaries as any)[id])
    .map((id) => (domainSummaries as any)[id].averageCompetency);
  const mathAvg = mathValues.length > 0 ? mathValues.reduce((a, b) => a + b, 0) / mathValues.length : adaptive.overallCompetency;
  const rwAvg = rwValues.length > 0 ? rwValues.reduce((a, b) => a + b, 0) / rwValues.length : adaptive.overallCompetency;
  const domainCompetency: { [domainId: string]: number } = {};
  Object.keys(domainSummaries).forEach((k) => {
    domainCompetency[k] = (domainSummaries as any)[k].averageCompetency;
  });
  (adaptive.masteryHistory as any[]).push({
    date: todayIso,
    overall: Math.round(adaptive.overallCompetency),
    math: Math.round(mathAvg),
    readingWriting: Math.round(rwAvg),
    domainCompetency,
  });

  return adaptive;
}

function recalculateDomainSummaries(subdomainScores: { [key: string]: SubdomainScore }) {
  const domains: { [domainId: string]: any } = {};
  // Compute per-domain average using the domain encoded in subdomainId via ALL_SKILLS mapping
  const totals: Record<string, { sum: number; count: number }> = {};
  for (const skill of ALL_SKILLS) {
    const subId = skill.subdomainId;
    const score = subdomainScores[subId];
    if (!score) continue;
    const d = String(skill.domain);
    if (!totals[d]) totals[d] = { sum: 0, count: 0 };
    totals[d].sum += score.competencyScore;
    totals[d].count += 1;
  }
  for (const [domainId, { sum, count }] of Object.entries(totals)) {
    domains[domainId] = {
      domainId: parseInt(domainId, 10),
      averageCompetency: count > 0 ? sum / count : 0,
      subdomainScores: Object.fromEntries(
        Object.entries(subdomainScores).filter(([sid]) => {
          const m = ALL_SKILLS.find((s) => s.subdomainId === sid);
          return m && String(m.domain) === domainId;
        })
      ),
      lastUpdated: Date.now(),
    };
  }
  return domains;
}

function getIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
