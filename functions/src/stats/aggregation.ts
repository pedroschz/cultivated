import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Initialize Firestore if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Aggregates statistics for a question when a user answers it.
 * Listens to: users/{userId}/history/{attemptId}
 * Updates: questions/{questionId} (stats field)
 */
export const onUserAnswerCreated = onDocumentCreated({
  document: 'users/{userId}/history/{attemptId}',
  region: 'us-central1',
}, async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  const questionId = data.questionId;
  const timeSpent = Number(data.timeSpent || 0);
  const isCorrect = data.correct === true;

  if (!questionId || timeSpent <= 0) return;

  const db = admin.firestore();
  const questionRef = db.collection('questions').doc(questionId);

  // Use a transaction to safely update the stats
  await db.runTransaction(async (transaction) => {
    const questionDoc = await transaction.get(questionRef);
    if (!questionDoc.exists) return; // Should not happen ideally

    const qData = questionDoc.data();
    const currentStats = qData?.stats || {
      totalAttempts: 0,
      totalCorrect: 0,
      totalTimeSpent: 0,
      sumOfSquaredTimes: 0,
      averageTime: 0,
      stdDev: 0,
    };

    const newTotalAttempts = (currentStats.totalAttempts || 0) + 1;
    const newTotalCorrect = (currentStats.totalCorrect || 0) + (isCorrect ? 1 : 0);
    const newTotalTimeSpent = (currentStats.totalTimeSpent || 0) + timeSpent;
    
    // Incremental sum of squares for variance calculation
    const currentSumOfSquares = currentStats.sumOfSquaredTimes || 0;
    const newSumOfSquares = currentSumOfSquares + (timeSpent * timeSpent);

    const newAverageTime = newTotalTimeSpent / newTotalAttempts;
    
    // Standard Deviation formula: sqrt((SumSq / N) - Mean^2)
    // We add a small epsilon to avoid negative values due to floating point precision
    const variance = (newSumOfSquares / newTotalAttempts) - (newAverageTime * newAverageTime);
    const newStdDev = variance > 0 ? Math.sqrt(variance) : 0;

    transaction.update(questionRef, {
      stats: {
        totalAttempts: newTotalAttempts,
        totalCorrect: newTotalCorrect,
        totalTimeSpent: newTotalTimeSpent,
        sumOfSquaredTimes: newSumOfSquares,
        averageTime: newAverageTime,
        stdDev: newStdDev,
        lastUpdated: Date.now()
      }
    });
  });
});
