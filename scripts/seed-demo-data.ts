#!/usr/bin/env ts-node
/**
 * seed-demo-data.ts
 *
 * Seeds a Firebase project with minimal demo data so a new contributor can
 * run the app end-to-end immediately after setup:
 *
 *   - 1 admin Firebase Auth user  (admin@demo.cultivated.app / DemoAdmin123!)
 *   - 1 demo school               (Demo High School)
 *   - 10 example questions        (from scripts/data/questions.example.json)
 *
 * Safe to re-run — uses set({ merge: true }) so existing data is not
 * clobbered. Pass --reset to delete and recreate from scratch.
 *
 * Usage:
 *   npm run seed:demo [-- --reset]
 *
 * Environment:
 *   Reads FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *   from .env.local (or process.env). See .env.example.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const ADMIN_EMAIL = 'admin@demo.cultivated.app';
const ADMIN_PASSWORD = 'DemoAdmin123!';
const ADMIN_DISPLAY_NAME = 'Demo Admin';

const DEMO_SCHOOL = {
  name: 'Demo High School',
  slug: 'demo-high-school',
  active: true,
  createdAt: Timestamp.now(),
};

// ─── Firebase init ──────────────────────────────────────────────────────────

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
const auth = getAuth();

const reset = process.argv.includes('--reset');

// ─── Helpers ────────────────────────────────────────────────────────────────

async function upsertUser(): Promise<string> {
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL);
    uid = existing.uid;
    console.log(`  ℹ️  Auth user already exists: ${ADMIN_EMAIL} (uid=${uid})`);
  } catch {
    const created = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_DISPLAY_NAME,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`  ✓ Created Auth user: ${ADMIN_EMAIL} (uid=${uid})`);
  }

  await auth.setCustomUserClaims(uid, { admin: true });
  console.log(`  ✓ Set admin custom claim on uid=${uid}`);
  return uid;
}

async function upsertUserDoc(uid: string) {
  const ref = db.collection('users').doc(uid);
  await ref.set(
    {
      uid,
      email: ADMIN_EMAIL,
      displayName: ADMIN_DISPLAY_NAME,
      username: 'demo_admin',
      isAdmin: true,
      onboarded: true,
      createdAt: Timestamp.now(),
    },
    { merge: true }
  );
  console.log(`  ✓ Upserted users/${uid}`);
}

async function upsertSchool(): Promise<string> {
  const q = db.collection('schools').where('slug', '==', DEMO_SCHOOL.slug).limit(1);
  const snap = await q.get();
  if (!snap.empty) {
    console.log(`  ℹ️  School already exists: ${DEMO_SCHOOL.name}`);
    return snap.docs[0].id;
  }
  const ref = await db.collection('schools').add(DEMO_SCHOOL);
  console.log(`  ✓ Created school: ${DEMO_SCHOOL.name} (id=${ref.id})`);
  return ref.id;
}

async function seedQuestions() {
  const examplePath = path.resolve(__dirname, 'data/questions.example.json');
  if (!fs.existsSync(examplePath)) {
    console.log('  ⚠️  scripts/data/questions.example.json not found — skipping questions.');
    return;
  }

  const questions = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
  const batch = db.batch();

  for (const q of questions) {
    if (!q.id) {
      console.log('  ⚠️  Skipping question without id');
      continue;
    }
    const ref = db.collection('questions').doc(q.id);
    if (reset) {
      batch.set(ref, q);
    } else {
      batch.set(ref, q, { merge: true });
    }
  }

  await batch.commit();
  console.log(`  ✓ Seeded ${questions.length} example questions`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n🌱 Seeding demo data...\n');

  if (reset) {
    console.log('  ⚠️  --reset flag set. Existing demo documents will be overwritten.\n');
  }

  console.log('1/3 Admin user');
  const uid = await upsertUser();
  await upsertUserDoc(uid);

  console.log('\n2/3 Demo school');
  await upsertSchool();

  console.log('\n3/3 Example questions');
  await seedQuestions();

  console.log('\n✅ Demo data ready.');
  console.log(`\n   Login credentials:`);
  console.log(`     Email:    ${ADMIN_EMAIL}`);
  console.log(`     Password: ${ADMIN_PASSWORD}`);
  console.log('\n   Sign in at http://localhost:3000/login\n');
}

run().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
