/**
 * Print priority list for a user's subdomains, scoped to a subject pool (Math or R&W),
 * and optionally limited to subdomains that have available questions.
 *
 * Usage:
 *   TS_NODE_TRANSPILE_ONLY=1 ts-node scripts/print-priorities.ts <userId> [subject]
 * subject: 'Math' | 'Reading & Writing' (default: both pools from user data)
 */
import 'dotenv/config';
import { adminApp, db } from '../src/lib/firebaseAdmin';
import { AdaptiveLearningEngine } from '../src/lib/adaptive-learning/scoring-engine';
import type { AdaptiveLearningData, SubdomainScore } from '../src/lib/types/adaptive-learning';
import { DOMAIN_RANGES, ALL_SKILLS } from '../src/lib/adaptive-learning/skill-mapping';
import fs from 'fs';
import path from 'path';

type Subject = 'Math' | 'Reading & Writing' | 'Both';

async function main() {
  const [userId, subjectArg] = process.argv.slice(2);
  if (!userId) {
    console.error('Usage: ts-node scripts/print-priorities.ts <userId> [Math|Reading & Writing|Both]');
    process.exit(1);
  }
  const subject: Subject = (subjectArg as Subject) || 'Both';

  // Resolve user by uid or username
  let resolvedUid = userId;
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    const byUsername = await db.collection('users').where('username', '==', userId).limit(1).get();
    if (byUsername.empty) {
      console.error('No user found by uid or username');
      process.exit(1);
    }
    resolvedUid = byUsername.docs[0].id;
  }

  const resolvedDoc = userDoc.exists ? userDoc : await db.collection('users').doc(resolvedUid).get();
  const userData = resolvedDoc.data() || {} as any;
  const al = userData.adaptiveLearning as AdaptiveLearningData;
  if (!al) {
    console.error('No adaptive learning data for user');
    process.exit(1);
  }

  // Subject filter as a set of allowed subdomain ids
  const allowedSubdomainIds = new Set<string>();
  const pushRange = (start: number, end: number) => {
    for (let i = start; i <= end; i++) allowedSubdomainIds.add(String(i));
  };
  if (subject === 'Math') {
    const ranges = [['0'], ['1'], ['2'], ['3']].map(([d]) => DOMAIN_RANGES[d as keyof typeof DOMAIN_RANGES]);
    ranges.forEach(([s, e]) => pushRange(s, e));
  } else if (subject === 'Reading & Writing') {
    const ranges = [['4'], ['5'], ['6'], ['7']].map(([d]) => DOMAIN_RANGES[d as keyof typeof DOMAIN_RANGES]);
    ranges.forEach(([s, e]) => pushRange(s, e));
  } else {
    // Both
    Object.values(DOMAIN_RANGES).forEach(([s, e]) => pushRange(s, e));
  }

  // Apply time decay to compute base priority comparable to runtime behavior
  const engine = new AdaptiveLearningEngine();
  const withDecay: Array<{ subId: string; score: SubdomainScore; priority: number; attempts: number }> = [];
  for (const [subId, score] of Object.entries(al.subdomainScores as Record<string, SubdomainScore>)) {
    if (allowedSubdomainIds.size > 0 && !allowedSubdomainIds.has(subId)) continue;
    const decayed = engine.applyTimeDecay(score as SubdomainScore);
    const priority = engine.calculateSubdomainPriority(decayed);
    withDecay.push({ subId, score: decayed, priority, attempts: (score.totalAttempts || 0) });
  }

  // Compute effective criteria priorities used by the selector (includes unassessed boost)
  const criteria = engine.generateQuestionSelectionCriteria(al, 50);
  const criteriaPriorityBySubId = new Map<string, number>();
  for (const c of criteria) {
    if (allowedSubdomainIds.size > 0 && !allowedSubdomainIds.has(c.subdomainId)) continue;
    const prev = criteriaPriorityBySubId.get(c.subdomainId) ?? -Infinity;
    if (c.priority > prev) criteriaPriorityBySubId.set(c.subdomainId, c.priority);
  }

  // Sort by effective priority (criteria-based), then by base priority
  withDecay.sort((a, b) => {
    const effA = criteriaPriorityBySubId.get(a.subId) ?? a.priority;
    const effB = criteriaPriorityBySubId.get(b.subId) ?? b.priority;
    if (effA !== effB) return effB - effA;
    return b.priority - a.priority;
  });

  // Pretty print
  const skillName = (subId: string) => {
    const s = ALL_SKILLS.find(s => s.subdomainId === subId);
    return s ? `${s.domainName} / ${s.skill}` : `Subdomain ${subId}`;
  };

  const header = 'basePriority\teffPriority\tattempts\tsubdomain\tcompetency\tconfidence\tlastPracticed\tname';
  const lines = withDecay.map(item => [
    item.priority.toFixed(2),
    (criteriaPriorityBySubId.get(item.subId) ?? item.priority).toString(),
    String(item.attempts),
    item.subId,
    item.score.competencyScore.toFixed(2),
    item.score.confidenceLevel.toFixed(2),
    new Date(item.score.lastPracticed).toISOString(),
    skillName(item.subId),
  ].join('\t'));

  console.log(`User: ${userId}`);
  console.log(`Subject scope: ${subject}`);
  console.log('Top priorities (desc):');
  console.log(header);
  for (const line of lines) console.log(line);

  // Write to priorities/<user>-<subject>-<timestamp>.tsv
  const outDir = path.resolve(process.cwd(), 'priorities');
  fs.mkdirSync(outDir, { recursive: true });
  const safeSubject = String(subject).replace(/[^A-Za-z0-9_\-]+/g, '_');
  const outFile = path.join(outDir, `${userId}-${safeSubject}-${Date.now()}.tsv`);
  fs.writeFileSync(outFile, [header, ...lines].join('\n'), 'utf8');
  console.log(`\nSaved to ${outFile}`);

  // Exit cleanly
  await (adminApp as any).delete?.();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


