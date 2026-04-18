/**
 * Audit the balance of basePriority components for a user's subdomains.
 * Prints per-subdomain breakdown and summary statistics, sorted by effective priority.
 *
 * Usage:
 *   TS_NODE_TRANSPILE_ONLY=1 ts-node scripts/audit-priority-balance.ts <uid-or-username> [Math|Reading & Writing|Both]
 */
import 'dotenv/config';
import { adminApp, db } from '../src/lib/firebaseAdmin';
import { AdaptiveLearningEngine } from '../src/lib/adaptive-learning/scoring-engine';
import { DOMAIN_RANGES, ALL_SKILLS } from '../src/lib/adaptive-learning/skill-mapping';
import fs from 'fs';
import path from 'path';

type Subject = 'Math' | 'Reading & Writing' | 'Both';

function daysSince(ts: number): number {
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

function skillName(subId: string): string {
  const s = ALL_SKILLS.find(s => s.subdomainId === subId);
  return s ? `${s.domainName} / ${s.skill}` : `Subdomain ${subId}`;
}

function getAllowedSubdomainIds(subject: Subject): Set<string> {
  const allowed = new Set<string>();
  const pushRange = (start: number, end: number) => { for (let i = start; i <= end; i++) allowed.add(String(i)); };
  if (subject === 'Math') {
    const ranges = [['0'], ['1'], ['2'], ['3']].map(([d]) => DOMAIN_RANGES[d as keyof typeof DOMAIN_RANGES]);
    ranges.forEach(([s, e]) => pushRange(s, e));
  } else if (subject === 'Reading & Writing') {
    const ranges = [['4'], ['5'], ['6'], ['7']].map(([d]) => DOMAIN_RANGES[d as keyof typeof DOMAIN_RANGES]);
    ranges.forEach(([s, e]) => pushRange(s, e));
  } else {
    Object.values(DOMAIN_RANGES).forEach(([s, e]) => pushRange(s, e));
  }
  return allowed;
}

async function main() {
  const [argUser, subjectArg] = process.argv.slice(2);
  if (!argUser) {
    console.error('Usage: ts-node scripts/audit-priority-balance.ts <uid-or-username> [Math|Reading & Writing|Both]');
    process.exit(1);
  }
  const subject: Subject = (subjectArg as Subject) || 'Both';

  // Resolve user by uid or username
  let uid = argUser;
  let docSnap = await db.collection('users').doc(uid).get();
  if (!docSnap.exists) {
    const byUsername = await db.collection('users').where('username', '==', argUser).limit(1).get();
    if (byUsername.empty) {
      console.error('No user found by uid or username');
      process.exit(1);
    }
    uid = byUsername.docs[0].id;
    docSnap = await db.collection('users').doc(uid).get();
  }

  const user = docSnap.data() || {} as any;
  const al = user.adaptiveLearning;
  if (!al) {
    console.error('No adaptive learning data for user');
    process.exit(1);
  }

  const allowedSubs = getAllowedSubdomainIds(subject);
  const engine = new AdaptiveLearningEngine();

  // Compute criteria (effective priority) including megaboost
  const criteria = engine.generateQuestionSelectionCriteria(al as any, 200);
  const effPriorityBySub = new Map<string, number>();
  for (const c of criteria) {
    if (allowedSubs.size > 0 && !allowedSubs.has(c.subdomainId)) continue;
    const prev = effPriorityBySub.get(c.subdomainId) ?? -Infinity;
    if (c.priority > prev) effPriorityBySub.set(c.subdomainId, c.priority);
  }

  type Row = {
    subId: string;
    attempts: number;
    comp: number;
    conf: number;
    lastDays: number;
    C: number; F: number; T: number; S: number; R: number; D: number; V: number; TP: number;
    base: number;
    eff: number;
    name: string;
  };
  const rows: Row[] = [];

  for (const [subId, rawScore] of Object.entries(al.subdomainScores)) {
    if (allowedSubs.size > 0 && !allowedSubs.has(subId)) continue;
    const s: any = engine.applyTimeDecay(rawScore as any);
    const comp = Number(s.competencyScore) || 0;
    const conf = Number(s.confidenceLevel) || 0;
    const attempts = Number(s.totalAttempts) || 0;
    const lastDays = Math.max(0, daysSince(Number(s.lastPracticed) || Date.now()));

    const C = (100 - comp) * 2;
    const F = (100 - conf) * 1.5;
    const T = lastDays * 1.0; // rebalanced from 0.5 to 1.0
    const S = s.recentStreak < 0 ? 30 : -Math.abs(s.recentStreak) * 1; // rebalanced
    const R = s.needsReinforcement ? 25 : 0;
    let D = 0;
    if (attempts < 5) D = 10; else if (attempts < 10) D = 6; else if (attempts < 20) D = 2; else D = 0;
    let V = 7; // rebalanced default
    if (s.improvementRate > 5 && comp < 70) V = 12;
    else if (s.improvementRate < -3) V = 10;
    else if (Math.abs(s.improvementRate) < 2 && comp > 40 && comp < 80 && attempts > 10) V = 8;
    else if (comp > 85 && Math.abs(s.improvementRate) < 3) V = 2;
    let TP = 0;
    const avg = Number(s.averageTimeSpent) || 0;
    const opt = Number(s.optimalTimeEstimate) || 0;
    if (avg > 0 && opt > 0) {
      const r = avg / opt;
      if (r > 1.8) TP = 12;
      else if (r > 1.3 && comp > 70) TP = 8;
      else if (r < 0.7 && comp < 60) TP = 10;
      else if (r >= 0.8 && r <= 1.2) TP = 0;
      else TP = 3;
    }

    const base = C + F + T + S + R + D + V + TP;
    const eff = effPriorityBySub.get(subId) ?? base;
    rows.push({ subId, attempts, comp, conf, lastDays, C, F, T, S, R, D, V, TP, base, eff, name: skillName(subId) });
  }

  rows.sort((a, b) => (b.eff - a.eff) || (b.base - a.base));

  const header = [
    'effPriority','basePriority','attempts','subdomain','competency','confidence','daysSince','C','F','T','S','R','D','V','TP','name'
  ].join('\t');
  const lines = rows.map(r => [
    r.eff.toFixed(3), r.base.toFixed(3), String(r.attempts), r.subId,
    r.comp.toFixed(2), r.conf.toFixed(2), r.lastDays.toFixed(2),
    r.C.toFixed(2), r.F.toFixed(2), r.T.toFixed(2), r.S.toFixed(2), r.R.toFixed(2), r.D.toFixed(2), r.V.toFixed(2), r.TP.toFixed(2), r.name
  ].join('\t'));

  console.log(`User: ${uid}`);
  console.log(`Subject scope: ${subject}`);
  console.log('Priority balance (sorted by effPriority):');
  console.log(header);
  for (const line of lines) console.log(line);

  // Summary stats: mean contribution share per component
  const sum = { C:0,F:0,T:0,S:0,R:0,D:0,V:0,TP:0, total:0 };
  const shares = { C:0,F:0,T:0,S:0,R:0,D:0,V:0,TP:0 } as any;
  let n = 0;
  for (const r of rows) {
    if (r.base <= 0) continue;
    const compSum = r.C + r.F + r.T + r.S + r.R + r.D + r.V + r.TP;
    if (compSum <= 0) continue;
    shares.C += r.C / compSum; shares.F += r.F / compSum; shares.T += r.T / compSum; shares.S += r.S / compSum;
    shares.R += r.R / compSum; shares.D += r.D / compSum; shares.V += r.V / compSum; shares.TP += r.TP / compSum;
    sum.C += r.C; sum.F += r.F; sum.T += r.T; sum.S += r.S; sum.R += r.R; sum.D += r.D; sum.V += r.V; sum.TP += r.TP; sum.total += compSum;
    n++;
  }
  if (n > 0) {
    console.log('\nAverage contribution share per component:');
    console.log(['C','F','T','S','R','D','V','TP'].map(k => `${k}=${(shares as any)[k]/n as number}`).join('\t'));
    console.log('Average absolute component values:');
    console.log(['C','F','T','S','R','D','V','TP'].map(k => `${k}=${(sum as any)[k]/n as number}`).join('\t'));
  }

  const outDir = path.resolve(process.cwd(), 'priorities');
  fs.mkdirSync(outDir, { recursive: true });
  const safeSubject = String(subject).replace(/[^A-Za-z0-9_\-]+/g, '_');
  const outFile = path.join(outDir, `${uid}-${safeSubject}-audit-${Date.now()}.tsv`);
  fs.writeFileSync(outFile, [header, ...lines].join('\n'), 'utf8');
  console.log(`\nSaved detailed TSV to ${outFile}`);

  await (adminApp as any).delete?.();
}

main().catch((e) => { console.error(e); process.exit(1); });


