import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db, adminApp } from '../src/lib/firebaseAdmin';

interface StudentStats {
  name: string;
  email: string;
  totalMinutes: number;
  totalQuestions: number;
  accuracy: number;
}

async function main() {
  console.log('Fetching users...');
  const usersSnap = await db.collection('users').get();
  
  const students: StudentStats[] = [];

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const al = data.adaptiveLearning;

    if (!al) continue;

    const name = data.name || data.displayName || 'Unknown';
    const email = data.email || 'No email';
    
    // Calculate stats
    const totalTimeSeconds = al.totalTimeSpent || 0;
    const totalMinutes = totalTimeSeconds / 60;
    
    // Calculate accuracy and total questions from subdomain scores
    let totalCorrect = 0;
    let totalAttempts = 0;

    if (al.subdomainScores) {
      Object.values(al.subdomainScores).forEach((score: any) => {
        totalCorrect += (score.correctCount || 0);
        totalAttempts += (score.totalAttempts || 0);
      });
    }

    // Fallback to top-level totalQuestionsAnswered if subdomain sum is 0 but top-level isn't
    // (though they should match)
    const reportedQuestions = al.totalQuestionsAnswered || 0;
    const finalQuestions = Math.max(totalAttempts, reportedQuestions);

    if (finalQuestions === 0) continue; // Skip users with no activity

    const accuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

    students.push({
      name,
      email,
      totalMinutes,
      totalQuestions: finalQuestions,
      accuracy
    });
  }

  // Sort by total questions descending
  students.sort((a, b) => b.totalQuestions - a.totalQuestions);

  // Take top 20
  const top20 = students.slice(0, 20);

  console.log('\nTop 20 Students by Questions Answered:');
  console.table(top20.map(s => ({
    Name: s.name,
    Email: s.email,
    'Total Minutes': s.totalMinutes.toFixed(2),
    'Questions': s.totalQuestions,
    'Accuracy (%)': s.accuracy.toFixed(2) + '%'
  })));

  // Clean up
  // Check if delete exists on app (it usually does for admin SDK)
  try {
    if ('delete' in adminApp) {
        await (adminApp as any).delete();
    }
  } catch (e) {
    // Ignore cleanup error
  }
}

main().catch(console.error);
