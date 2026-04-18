import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '@/lib/firebaseClient';

export interface QuestionStats {
  totalAttempts: number;
  totalCorrect: number;
  totalTimeSpent: number;
  sumOfSquaredTimes?: number;
  averageTime: number;
  stdDev?: number;
  lastUpdated: number;
}

/**
 * Fetches aggregated statistics for a specific question.
 * @param questionId The ID of the question to fetch stats for.
 * @returns The stats object or null if not found.
 */
export async function getQuestionStats(questionId: string): Promise<QuestionStats | null> {
  if (!app) return null;
  
  try {
    const db = getFirestore(app);
    const questionRef = doc(db, 'questions', questionId);
    const snap = await getDoc(questionRef);
    
    if (snap.exists()) {
      const data = snap.data();
      return (data.stats as QuestionStats) || null;
    }
    return null;
  } catch (error) {
    console.error('Error fetching question stats:', error);
    return null;
  }
}

/**
 * Fetches stats for multiple questions in parallel.
 * @param questionIds Array of question IDs.
 * @returns Map of questionId -> QuestionStats.
 */
export async function getBatchQuestionStats(questionIds: string[]): Promise<Record<string, QuestionStats>> {
  if (!app || questionIds.length === 0) return {};
  
  const results: Record<string, QuestionStats> = {};
  
  // Firestore doesn't support batch gets for widely scattered docs easily without IDs known ahead of time in specific ways
  // or using "in" queries which return documents.
  // For < 10 items (typical session review), parallel getDoc is acceptable.
  
  await Promise.all(
    questionIds.map(async (id) => {
      const stats = await getQuestionStats(id);
      if (stats) {
        results[id] = stats;
      }
    })
  );
  
  return results;
}
