#!/usr/bin/env ts-node
/**
 * import-questions.ts
 *
 * Imports a JSON question bank into the Firestore `questions` collection.
 *
 * Usage:
 *   npm run import:questions -- --file=path/to/questions.json [--dry-run] [--overwrite]
 *
 * Options:
 *   --file <path>       Path to the JSON file (required). Must be an array of question objects.
 *   --dry-run           Validate and print each question but don't write to Firestore.
 *   --overwrite         Overwrite documents that already exist. Default: skip.
 *   --batch-size <n>    Firestore writes per batch (default 400, max 500).
 *
 * Environment:
 *   Reads FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY from
 *   process.env (or .env.local via dotenv). See .env.example for details.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─── Argument parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const get = (flag: string) => {
  const i = args.findIndex((a) => a.startsWith(`${flag}=`));
  if (i !== -1) return args[i].split('=').slice(1).join('=');
  const j = args.indexOf(flag);
  if (j !== -1) return args[j + 1];
  return undefined;
};

const filePath = get('--file');
const dryRun = args.includes('--dry-run');
const overwrite = args.includes('--overwrite');
const batchSize = parseInt(get('--batch-size') || '400', 10);

if (!filePath) {
  console.error('Usage: npm run import:questions -- --file=path/to/questions.json [--dry-run] [--overwrite]');
  process.exit(1);
}

// ─── Firebase init ─────────────────────────────────────────────────────────

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      'Missing Firebase Admin credentials.\n' +
      'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local'
    );
    process.exit(1);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

// ─── Validation ────────────────────────────────────────────────────────────

interface RawQuestion {
  id?: string;
  domain: number;
  skill: string;
  difficulty: 0 | 1 | 2;
  question: string;
  options: string[] | null;
  answer: number | string | (number | string)[];
  [key: string]: unknown;
}

function validate(q: RawQuestion, index: number): string[] {
  const errors: string[] = [];
  if (typeof q.domain !== 'number') errors.push('domain must be a number 0–7');
  if (q.domain < 0 || q.domain > 7) errors.push(`domain ${q.domain} is out of range (0–7)`);
  if (typeof q.skill !== 'string' || !q.skill.trim()) errors.push('skill is required (string)');
  if (![0, 1, 2].includes(q.difficulty)) errors.push('difficulty must be 0, 1, or 2');
  if (typeof q.question !== 'string' || !q.question.trim()) errors.push('question text is required');
  if (q.options !== null && !Array.isArray(q.options)) errors.push('options must be array or null');
  if (q.answer === undefined || q.answer === null) errors.push('answer is required');
  return errors.map((e) => `  [${index}] ${e}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function run() {
  const resolvedPath = path.resolve(process.cwd(), filePath!);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  let questions: RawQuestion[];
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    questions = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse JSON:', e);
    process.exit(1);
  }

  if (!Array.isArray(questions)) {
    console.error('JSON file must contain an array of question objects at the top level.');
    process.exit(1);
  }

  console.log(`\nLoaded ${questions.length} question(s) from ${resolvedPath}`);
  if (dryRun) console.log('DRY RUN — no writes will be made.\n');

  // Validate
  const allErrors: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    allErrors.push(...validate(questions[i], i));
  }

  if (allErrors.length > 0) {
    console.error('\nValidation errors:');
    allErrors.forEach((e) => console.error(e));
    console.error('\nFix the errors above and re-run.');
    process.exit(1);
  }

  console.log('✓ All questions passed validation.\n');
  if (dryRun) {
    questions.forEach((q, i) => {
      const id = q.id || `(auto-id)`;
      console.log(`  [${i}] id=${id}  domain=${q.domain}  difficulty=${q.difficulty}  skill="${q.skill}"`);
    });
    console.log('\nDry run complete. No data written.');
    return;
  }

  // Write in batches
  const collectionRef = db.collection('questions');
  let written = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const q of questions) {
    const docId = q.id || db.collection('questions').doc().id;
    const docRef = collectionRef.doc(docId);

    if (!overwrite) {
      const snap = await docRef.get();
      if (snap.exists) {
        console.log(`  SKIP (already exists) — id=${docId}`);
        skipped++;
        continue;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...data } = q;
    batch.set(docRef, { id: docId, ...data }, overwrite ? { merge: true } : {});
    batchCount++;
    written++;

    if (batchCount >= batchSize) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount}`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount}`);
  }

  console.log(`\n✅ Done. Written: ${written}  Skipped: ${skipped}  Total: ${questions.length}`);
}

run().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
