/**
 * Prints available question counts by subdomain for a subject pool (Math or R&W).
 * Helps diagnose why high-priority subdomains don't appear: zero-candidate cases.
 *
 * Usage:
 *   TS_NODE_TRANSPILE_ONLY=1 ts-node scripts/subject-availability.ts [Math|Reading & Writing]
 */
import 'dotenv/config';
import { db } from '../src/lib/firebaseAdmin';
import { DOMAIN_RANGES, ALL_SKILLS } from '../src/lib/adaptive-learning/skill-mapping';
import type { AdaptiveLearningData } from '../src/lib/types/adaptive-learning';
import { DocumentData } from 'firebase-admin/firestore';

type Subject = 'Math' | 'Reading & Writing';

function getSubIdFromQuestion(q: any): string {
  if (q.skill) {
    const skill = ALL_SKILLS.find(s => s.skill === q.skill || s.subdomainId === q.skill);
    if (skill) return skill.subdomainId;
  }
  const domain = Number(q.domain);
  // Fallback to first subdomain of the domain
  for (const [domainId, [start, end]] of Object.entries(DOMAIN_RANGES)) {
    if (Number(domainId) === domain) return String(start);
  }
  return '0';
}

async function main() {
  const subject = (process.argv[2] as Subject) || 'Math';
  const userArg = process.argv[3];
  const isMath = subject === 'Math';
  const questions = await db.collection('questions').get();

  // Optionally exclude already-answered questionIds for a user (uid or username)
  const excludeIds = new Set<string>();
  if (userArg) {
    let userDoc = await db.collection('users').doc(userArg).get();
    if (!userDoc.exists) {
      const byUsername = await db.collection('users').where('username', '==', userArg).limit(1).get();
      if (!byUsername.empty) {
        userDoc = await db.collection('users').doc(byUsername.docs[0].id).get();
      }
    }
    if (userDoc.exists) {
      const histSnap = await db.collection('users').doc(userDoc.id).collection('history').get();
      histSnap.forEach((d) => {
        const qid = (d.data() as DocumentData)?.questionId;
        if (qid) excludeIds.add(String(qid));
      });
    }
  }

  const counts = new Map<string, number>();
  const skills = new Set<string>();

  questions.forEach(doc => {
    const q = doc.data();
    if (q.reported) return;
    const d = Number(q.domain);
    if (Number.isNaN(d)) return;
    if (isMath ? d > 3 : d < 4) return;
    if (excludeIds.has(doc.id)) return;
    const subId = getSubIdFromQuestion(q);
    counts.set(subId, (counts.get(subId) || 0) + 1);
    if (typeof q.skill === 'string' && q.skill.trim().length > 0) skills.add(q.skill.trim());
  });

  const rows = Array.from(counts.entries()).map(([subId, count]) => {
    const skill = ALL_SKILLS.find(s => s.subdomainId === subId);
    const name = skill ? `${skill.domainName} / ${skill.skill}` : `Sub ${subId}`;
    return { subId, count, name };
  }).sort((a, b) => b.count - a.count);

  console.log(`Subject availability: ${subject}`);
  console.log('count\tsubId\tname');
  for (const r of rows) {
    console.log(`${r.count}\t${r.subId}\t${r.name}`);
  }
  if (userArg) {
    console.log(`\nAllowed skills (canonical) for ${subject} pool excluding answered by ${userArg}:`);
    console.log(Array.from(skills).sort().join('\n'));
  }
}

main().catch(e => { console.error(e); process.exit(1); });


