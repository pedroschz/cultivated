import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineInt, defineString } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { Email, EMAIL_SECRETS } from './email.js';
import {
  registrationEmailTemplate,
  friendRequestEmailTemplate,
  reminderEmailTemplate,
  friendProgressEmailTemplate,
} from './templates.js';

const REMINDER_DAYS_INACTIVE = defineInt('REMINDER_DAYS_INACTIVE'); // default used below if unset
const SCHEDULE_TZ = defineString('TIME_ZONE'); // e.g. America/Los_Angeles; fallback to Etc/UTC

function getTimeZone(): string {
  const tz = SCHEDULE_TZ.value();
  return tz && tz.trim().length > 0 ? tz : 'Etc/UTC';
}

function getReminderDays(): number {
  const v = REMINDER_DAYS_INACTIVE.value();
  return v && v > 0 ? v : 3;
}

// Welcome email when a user document is created
export const sendWelcomeOnUserCreate = onDocumentCreated({
  document: 'users/{userId}',
  secrets: [...EMAIL_SECRETS],
}, async (event) => {
  try {
    const uid = event.params.userId as string;
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(uid).get();
    const data = userDoc.exists ? (userDoc.data() as any) : {};
    const name = (data?.name as string | undefined) || null;
    let toEmail: string | null = null;
    try {
      const authUser = await getAuth().getUser(uid);
      toEmail = (authUser.email || '').trim() || null;
    } catch {}
    if (!toEmail) return;
    const tpl = registrationEmailTemplate({ name });
    await Email.send({ to: toEmail, subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch {}
});

export const notifyOnFriendRequest = onDocumentCreated({
  document: 'friendRequests/{requestId}',
  secrets: [...EMAIL_SECRETS],
}, async (event) => {
  try {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as any;
    const fromUserId: string = data?.fromUserId;
    const toUserId: string = data?.toUserId;
    if (!fromUserId || !toUserId) return;

    const db = getFirestore();
    const [fromDoc, toDoc] = await Promise.all([
      db.collection('users').doc(fromUserId).get(),
      db.collection('users').doc(toUserId).get(),
    ]);

    const fromName: string | null = (fromDoc.exists ? (fromDoc.data() as any)?.name : null) || null;
    const fromUsername: string | null = (fromDoc.exists ? (fromDoc.data() as any)?.username : null) || null;

    // Recipient email preference
    const toSettings = toDoc.exists ? (((toDoc.data() as any)?.emailSettings) as any) : {};
    if (toSettings && toSettings.friendRequestEnabled === false) return;

    // Resolve recipient email from Auth to be safe
    let toEmail: string | null = null;
    try {
      const toAuth = await getAuth().getUser(toUserId);
      toEmail = (toAuth.email || '').trim() || null;
    } catch {}
    if (!toEmail) return;

    const toName: string | null = (toDoc.exists ? (toDoc.data() as any)?.name : null) || null;

    const tpl = friendRequestEmailTemplate({ toName, fromName, fromUsername });
    await Email.send({ to: toEmail, subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch {}
});

export const sendDailyInactivityReminders = onSchedule({
  schedule: 'every day 16:00',
  timeZone: getTimeZone(),
  secrets: [...EMAIL_SECRETS],
  region: 'us-central1',
}, async () => {
  const days = getReminderDays();
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const db = getFirestore();

  // Process up to 400 users per run to be conservative
  const snap = await db.collection('users').limit(400).get();
  const candidates = snap.docs.map((d) => ({ id: d.id, data: d.data() as any }));

  const inactive = candidates.filter((u) => {
    const settings = (u.data?.emailSettings as any) || {};
    if (settings.remindersEnabled === false) return false; // default to enabled
    
    const lastPracticeAt: Timestamp | null = (u.data?.lastPracticeAt as Timestamp | undefined) || null;
    const lastQuestionUpdate: Timestamp | null = (u.data?.adaptiveLearning?.lastQuestionUpdate as Timestamp | undefined) || null;
    
    // If we have no record of practice, we cannot calculate inactivity days.
    // Skip to avoid "20499 days" bug.
    if (!lastPracticeAt && !lastQuestionUpdate) return false;

    const lastMs = (lastPracticeAt || lastQuestionUpdate)!.toMillis();
    return lastMs < cutoffMs;
  });

  // Resolve emails in small batches
  for (const user of inactive) {
    try {
      const authUser = await getAuth().getUser(user.id);
      const email = (authUser.email || '').trim();
      if (!email) continue;

      const lastPracticeAt: Timestamp | null = (user.data?.lastPracticeAt as Timestamp | undefined) || null;
      const lastQuestionUpdate: Timestamp | null = (user.data?.adaptiveLearning?.lastQuestionUpdate as Timestamp | undefined) || null;
      
      const effectiveLastDate = lastPracticeAt || lastQuestionUpdate;
      if (!effectiveLastDate) continue;

      const lastMs = effectiveLastDate.toMillis();
      const daysInactive = Math.floor((Date.now() - lastMs) / (24 * 60 * 60 * 1000));

      const tpl = reminderEmailTemplate({
        name: (user.data?.name as string | undefined) || authUser.displayName || null,
        reason: 'inactivity',
        daysInactive,
      });
      await Email.send({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch {}
  }
});

// Real-time friend-start alert: when a user toggles active-practice-session false -> true
export const notifyFriendsOnPracticeStart = onDocumentUpdated({
  document: 'users/{userId}',
  secrets: [...EMAIL_SECRETS],
}, async (event) => {
  try {
    const before = event.data?.before?.data() as any;
    const after = event.data?.after?.data() as any;
    if (!after) return;
    const wasActive = !!before?.['active-practice-session'];
    const isActive = !!after?.['active-practice-session'];
    if (isActive === wasActive || !isActive) return; // only when flipping to true

    const starterId = event.params.userId as string;
    const db = getFirestore();
    const starterDoc = await db.collection('users').doc(starterId).get();
    const starter = starterDoc.exists ? (starterDoc.data() as any) : {};
    const starterName: string = starter?.name || 'Your friend';

    const friends: string[] = Array.isArray(starter?.friends) ? starter.friends : [];
    if (!friends.length) return;

    for (const friendId of friends.slice(0, 100)) {
      try {
        const friendDoc = await db.collection('users').doc(friendId).get();
        const friend = friendDoc.exists ? (friendDoc.data() as any) : {};
        const settings = (friend?.emailSettings as any) || {};
        if (settings.friendStartAlertsEnabled === false) continue; // default on

        // rate-limit: once per 60 minutes per pair
        const meta = (friend?.friendStartAlertMeta as any) || {};
        const lastByStarter: Record<string, number> = meta.lastByStarter || {};
        const lastMs = Number(lastByStarter[starterId] || 0);
        if (Date.now() - lastMs < 60 * 60 * 1000) continue;

        const authFriend = await getAuth().getUser(friendId);
        const toEmail = (authFriend.email || '').trim();
        if (!toEmail) continue;

        const tpl = friendProgressEmailTemplate({
          name: (friend?.name as string | undefined) || authFriend.displayName || null,
          starterName: starterName,
          starterUsername: starter?.username || null,
        });
        await Email.send({ to: toEmail, subject: tpl.subject, html: tpl.html, text: tpl.text });

        // update rate-limit marker
        try {
          await db.collection('users').doc(friendId).set({
            friendStartAlertMeta: { lastByStarter: { ...lastByStarter, [starterId]: Date.now() } },
          }, { merge: true });
        } catch {}
      } catch {}
    }
  } catch {}
});

// Aggregates student daily metrics to the school level in real-time
export const onStudentMetricUpdate = onDocumentUpdated({
  document: 'users/{userId}/metrics/daily/days/{dayId}',
  secrets: [...EMAIL_SECRETS], // (Secrets not strictly needed here but keeps config consistent)
}, async (event) => {
  try {
    const dayId = event.params.dayId;
    const userId = event.params.userId;
    const beforeData = event.data?.before.data() as any;
    const afterData = event.data?.after.data() as any;

    const oldSeconds = Number(beforeData?.secondsStudied || 0);
    const newSeconds = Number(afterData?.secondsStudied || 0);
    const delta = newSeconds - oldSeconds;

    // No change in study time?
    if (delta === 0) return;

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? (userDoc.data() as any) : {};
    const schoolId = userData?.schoolId;

    if (!schoolId) return;

    const schoolDayRef = db.collection('schools').doc(schoolId).collection('metrics').doc('daily').collection('days').doc(dayId);

    await db.runTransaction(async (txn) => {
      const schoolDaySnap = await txn.get(schoolDayRef);
      if (!schoolDaySnap.exists) {
        // Create if missing
        txn.set(schoolDayRef, {
          secondsStudied: newSeconds > 0 ? newSeconds : 0,
          uniqueStudentsCount: newSeconds > 0 ? 1 : 0,
        });
      } else {
        // Update
        const updates: any = {
          secondsStudied: (require('firebase-admin').firestore.FieldValue).increment(delta),
        };
        
        // Handle unique student count roughly
        // Precise unique count requires a subcollection or array. 
        // For now, we assume if a user goes from 0 -> >0, they are new active.
        // If they go >0 -> 0, they are no longer active.
        if (oldSeconds === 0 && newSeconds > 0) {
          updates.uniqueStudentsCount = (require('firebase-admin').firestore.FieldValue).increment(1);
        } else if (oldSeconds > 0 && newSeconds === 0) {
          updates.uniqueStudentsCount = (require('firebase-admin').firestore.FieldValue).increment(-1);
        }
        
        txn.set(schoolDayRef, updates, { merge: true });
      }
    });
  } catch (e) {
    console.error('Failed to aggregate metrics for user', event.params.userId, e);
  }
});

// Also handle creation (first study session of the day)
export const onStudentMetricCreate = onDocumentCreated({
  document: 'users/{userId}/metrics/daily/days/{dayId}',
}, async (event) => {
  try {
    const dayId = event.params.dayId;
    const userId = event.params.userId;
    const data = event.data?.data() as any;
    const seconds = Number(data?.secondsStudied || 0);

    if (seconds <= 0) return;

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const schoolId = (userDoc.data() as any)?.schoolId;

    if (!schoolId) return;

    const schoolDayRef = db.collection('schools').doc(schoolId).collection('metrics').doc('daily').collection('days').doc(dayId);
    
    await schoolDayRef.set({
      secondsStudied: (require('firebase-admin').firestore.FieldValue).increment(seconds),
      uniqueStudentsCount: (require('firebase-admin').firestore.FieldValue).increment(1)
    }, { merge: true });

  } catch (e) { console.error(e); }
});

// =====================================================================
// users_public mirror
// =====================================================================
// Whenever the private `users/{uid}` doc is written, copy a small set of
// safe fields into `users_public/{uid}`. The strict `users` Firestore rule
// only allows the owner (and admins) to read the private doc, so all
// cross-user reads (leaderboard, friends, forum author info, school admin)
// must read the mirror instead.
//
// Keep this list in sync with `PUBLIC_USER_FIELDS` in
// `src/lib/users-public.ts`.
const PUBLIC_USER_FIELDS = [
  'username',
  'name',
  'displayName',
  'firstName',
  'avatarIcon',
  'avatarColor',
  'avatar',
  'school',
  'schoolId',
  'schoolSlug',
  'country',
  'countryCode',
  'class',
  'referrerUsername',
  'friends',
  'lastLogin',
  'lastActive',
] as const;

function buildPublicMirror(data: Record<string, any> | undefined): Record<string, any> {
  if (!data) return {};
  const out: Record<string, any> = {};
  for (const f of PUBLIC_USER_FIELDS) {
    if (data[f] !== undefined) out[f] = data[f];
  }
  // Derived public competency stats so leaderboards can rank without exposing
  // the full adaptiveLearning object.
  const al = data.adaptiveLearning;
  if (al && typeof al === 'object') {
    if (typeof al.overallCompetency === 'number') {
      out.publicCompetency = Math.round(al.overallCompetency * 100) / 100;
    }
    if (typeof al.totalQuestionsAnswered === 'number') {
      out.publicQuestionsAnswered = al.totalQuestionsAnswered;
    }
    if (typeof al.lastQuestionUpdate !== 'undefined') {
      out.lastActive = al.lastQuestionUpdate;
    }
    if (Array.isArray(al.masteryHistory)) {
      // Trim to the last 60 entries to keep the mirror doc small. Friend
      // profiles only chart the last 7 days but admins might want a bit more.
      out.publicMasteryHistory = al.masteryHistory.slice(-60);
    }
  }
  return out;
}

export const mirrorUserPublicOnWrite = onDocumentWritten({
  document: 'users/{userId}',
}, async (event) => {
  const uid = event.params.userId as string;
  const after = event.data?.after?.data();
  const db = getFirestore();
  const publicRef = db.collection('users_public').doc(uid);
  if (!after) {
    // Document was deleted — clean up the mirror.
    try { await publicRef.delete(); } catch (e) { console.warn('mirror delete failed', e); }
    return;
  }
  const mirror = buildPublicMirror(after);
  try {
    await publicRef.set(mirror, { merge: false });
  } catch (e) {
    console.error('mirrorUserPublicOnWrite failed for', uid, e);
  }
});

// One-shot HTTP endpoint to backfill `users_public` from existing `users`
// docs. Admin-only. Useful right after deploying these rules so existing
// users get a public profile without each having to write to their doc.
//
//   curl -X POST 'https://<region>-<project>.cloudfunctions.net/backfillUsersPublic' \
//        -H 'Authorization: Bearer <admin id token>'
import { onRequest } from 'firebase-functions/v2/https';
export const backfillUsersPublic = onRequest({ cors: [/.*$/] }, async (req, res) => {
  try {
    const authHeader = req.get('Authorization') || '';
    const m = authHeader.match(/^Bearer (.+)$/);
    if (!m) { res.status(401).json({ error: 'Missing bearer token' }); return; }
    const decoded = await getAuth().verifyIdToken(m[1]);
    if ((decoded as any).admin !== true) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const db = getFirestore();
    const snap = await db.collection('users').get();
    let written = 0;
    let batch = db.batch();
    let pending = 0;
    for (const d of snap.docs) {
      const mirror = buildPublicMirror(d.data());
      batch.set(db.collection('users_public').doc(d.id), mirror, { merge: false });
      pending++;
      written++;
      if (pending >= 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
    if (pending > 0) await batch.commit();
    res.json({ ok: true, written });
  } catch (e: any) {
    console.error('backfillUsersPublic failed', e);
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});
