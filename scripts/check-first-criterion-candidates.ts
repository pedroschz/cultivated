/**
 * Check whether the first subject-scoped criterion for a user has exact-match candidates
 * in the questions pool at the requested difficulty (0/1/2) using skill-name matching.
 *
 * Usage:
 *   TS_NODE_TRANSPILE_ONLY=1 ts-node scripts/check-first-criterion-candidates.ts <uid-or-username> Math
 */
import 'dotenv/config';
import { db } from '../src/lib/firebaseAdmin';
import { AdaptiveLearningEngine } from '../src/lib/adaptive-learning/scoring-engine';
import type { AdaptiveLearningData } from '../src/lib/types/adaptive-learning';
import { ALL_SKILLS, getSkillMapping, getDomainForSkill } from '../src/lib/adaptive-learning/skill-mapping';

type Subject = 'Math' | 'Reading & Writing';

async function resolveUser(userOrUsername: string) {
  let doc = await db.collection('users').doc(userOrUsername).get();
  if (!doc.exists) {
    const q = await db.collection('users').where('username', '==', userOrUsername).limit(1).get();
    if (q.empty) throw new Error('No user found by uid or username');
    doc = await db.collection('users').doc(q.docs[0].id).get();
  }
  return { uid: doc.id, data: doc.data() as any };
}

function isMathSkill(skillName: string): boolean {
  const d = getDomainForSkill(skillName);
  return d !== null && d <= 3;
}

async function main() {
  const [userArg, subjectArg] = process.argv.slice(2);
  if (!userArg || !subjectArg) {
    console.error('Usage: ts-node scripts/check-first-criterion-candidates.ts <uid-or-username> <Math|Reading & Writing>');
    process.exit(1);
  }
  const subject = subjectArg as Subject;
  const isMath = subject === 'Math';

  const { uid, data } = await resolveUser(userArg);
  const al = (data.adaptiveLearning || null) as AdaptiveLearningData | null;
  if (!al) throw new Error('No adaptive learning data for user');

  // Build allowed skills from question pool (subject-scoped)
  const qsSnap = await db.collection('questions').get();
  const questions: Array<{ id: string; skill?: string; difficulty?: any; domain?: any; reported?: boolean }> = [];
  qsSnap.forEach((d) => questions.push({ id: d.id, ...(d.data() as any) }));
  const allowedSkills = new Set<string>();
  for (const q of questions) {
    if (q.reported) continue;
    const domain = Number(q.domain);
    if (Number.isNaN(domain)) continue;
    if (isMath ? domain > 3 : domain < 4) continue;
    if (typeof q.skill === 'string' && q.skill.trim().length > 0) {
      allowedSkills.add(q.skill);
    }
  }

  // Generate criteria and subject-scope them
  const engine = new AdaptiveLearningEngine();
  const criteria = engine.generateQuestionSelectionCriteria(al as any, 200);
  const attemptsBySub = al.subdomainScores || {};
  const isUnassessed = (subId: string) => ((attemptsBySub[subId]?.totalAttempts || 0) === 0);
  const subjectCriteria = criteria.filter((c) => {
    const skill = ALL_SKILLS.find((s) => s.subdomainId === c.subdomainId)?.skill;
    if (!skill) return false;
    if (!allowedSkills.has(skill)) return false;
    return isMath ? isMathSkill(skill) : !isMathSkill(skill);
  });

  // First criterion: prefer first unassessed if exists, else first in subject criteria
  const firstUnassessed = subjectCriteria.find((c) => isUnassessed(c.subdomainId));
  const firstCriterion = firstUnassessed || subjectCriteria[0];
  if (!firstCriterion) {
    console.log('No subject-scoped criteria available.');
    process.exit(0);
  }

  const skillName = ALL_SKILLS.find((s) => s.subdomainId === firstCriterion.subdomainId)?.skill || 'UNKNOWN';
  const requestedDifficulty = firstCriterion.difficulty; // 0|1|2

  // Compute availability for this skill at exact difficulty and distribution
  const dist: Record<string, number> = { '0': 0, '1': 0, '2': 0, other: 0 };
  const exactIds: string[] = [];
  for (const q of questions) {
    if (q.reported) continue;
    const domain = Number(q.domain);
    if (Number.isNaN(domain)) continue;
    if (isMath ? domain > 3 : domain < 4) continue;
    if (q.skill !== skillName) continue;
    const d = Number(q.difficulty);
    if (d === 0 || d === 1 || d === 2) dist[String(d)]++;
    else dist.other++;
    if (d === requestedDifficulty) {
      exactIds.push(q.id);
    }
  }

  console.log(`User: ${uid}`);
  console.log(`Subject: ${subject}`);
  const isUnassessedFirst = (al.subdomainScores[firstCriterion.subdomainId]?.totalAttempts || 0) === 0;
  console.log('First criterion:', { subdomainId: firstCriterion.subdomainId, skill: skillName, difficulty: requestedDifficulty, priority: firstCriterion.priority, reason: isUnassessedFirst ? 'unassessed' : 'by-priority' });
  console.log('Availability for skill:', skillName);
  console.log('Difficulty distribution:', dist);
  console.log(`Exact-match count (skill + difficulty ${requestedDifficulty}):`, exactIds.length);
  console.log('Sample exact IDs:', exactIds.slice(0, 10));
}

main().catch((e) => { console.error(e); process.exit(1); });


