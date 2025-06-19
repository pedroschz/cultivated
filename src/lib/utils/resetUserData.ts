import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { app } from '@/lib/firebaseClient';

/**
 * Comprehensive reset function that clears all user statistics and data
 */
export async function resetUserData(userId: string): Promise<void> {
  if (!app) throw new Error('Firebase app not initialized');

  const db = getFirestore(app);
  const userRef = doc(db, 'users', userId);

  try {
    // Reset all user data fields
    await updateDoc(userRef, {
      // Clear legacy statistics
      stats: {},
      
      // Clear practice history
      history: [],
      
      // Clear bookmarks
      bookmarks: [],
      
      // Reset adaptive learning data to initial state
      adaptiveLearning: {
        subdomainScores: {},
        domainSummaries: {},
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
        algorithmVersion: '1.0.0',
        lastFullUpdate: Date.now(),
        lastQuestionUpdate: Date.now(),
        questionQueue: []
      }
    });

    console.log(`Successfully reset all data for user ${userId}`);
  } catch (error) {
    console.error('Error resetting user data:', error);
    throw error;
  }
}

/**
 * Reset only statistics data (keeping bookmarks and other preferences)
 */
export async function resetUserStats(userId: string): Promise<void> {
  if (!app) throw new Error('Firebase app not initialized');

  const db = getFirestore(app);
  const userRef = doc(db, 'users', userId);

  try {
    await updateDoc(userRef, {
      stats: {},
      history: [],
      adaptiveLearning: {
        subdomainScores: {},
        domainSummaries: {},
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
        algorithmVersion: '1.0.0',
        lastFullUpdate: Date.now(),
        lastQuestionUpdate: Date.now(),
        questionQueue: []
      }
    });

    console.log(`Successfully reset statistics for user ${userId}`);
  } catch (error) {
    console.error('Error resetting user statistics:', error);
    throw error;
  }
} 