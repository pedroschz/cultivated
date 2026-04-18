import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Email, EMAIL_SECRETS, SendEmailInput } from './email.js';
import { customAdminEmailTemplate, assignmentEmailTemplate } from './templates.js';
import { getWebBaseUrl, getAppName } from './config.js';
export * from './triggers.js';
export * from './forumBots.js';
export * from './interestsChat.js';
export * from './chatTutor.js';
export * from './tutorContextApi.js';

// Re-export triggers to ensure CLI picks them up
import { onStudentMetricUpdate, onStudentMetricCreate } from './triggers.js';
export { onStudentMetricUpdate, onStudentMetricCreate };

if (!getApps().length) {
  initializeApp();
}

const EMAILS_DISABLED = false;

/**
 * Returns true when the verified token belongs to an admin.
 * Admin status is conferred via a Firebase Auth custom claim (`admin: true`).
 * Use the `setAdminClaim` callable below to grant it.
 */
function tokenIsAdmin(token: any): boolean {
  return Boolean(token && token.admin === true);
}

/**
 * Bootstrap admins are seeded from the `BOOTSTRAP_ADMIN_EMAILS` env var
 * (comma-separated, lowercased). They are the only callers allowed to invoke
 * `setAdminClaim` before any custom claims exist. Empty by default — set it on
 * the Functions runtime (e.g. via `firebase functions:config:set` or the
 * environment) for the initial admin grant, then remove.
 */
function getBootstrapAdminEmails(): string[] {
  return String(process.env.BOOTSTRAP_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * List users belonging to a school. Used by school-admin pages to show
 * staff/students with their (sensitive) email + role. Authorised by an
 * `admin` claim or by the caller having a matching `schoolId` claim.
 */
export const listSchoolUsers = onCall(async (request) => {
  const authToken = request.auth;
  if (!authToken) throw new HttpsError('unauthenticated', 'Missing authentication.');
  const claims = (authToken.token || {}) as any;
  const requestedSchoolId = String((request.data as any)?.schoolId || claims.schoolId || '');
  if (!requestedSchoolId) throw new HttpsError('invalid-argument', 'Missing schoolId');
  const callerSchool = String(claims.schoolId || '');
  if (!tokenIsAdmin(claims) && callerSchool !== requestedSchoolId) {
    throw new HttpsError('permission-denied', 'Forbidden');
  }
  const db = getFirestore();
  const snap = await db.collection('users').where('schoolId', '==', requestedSchoolId).get();
  const users = snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: data.name || data.displayName || null,
      username: data.username || null,
      email: data.email || null,
      role: data.role || null,
      class: data.class || null,
      schoolId: data.schoolId || null,
      schoolName: data.schoolName || null,
      lastLogin: data.lastLogin || null,
      referrerUsername: data.referrerUsername || null,
      avatarIcon: data.avatarIcon || null,
      avatarColor: data.avatarColor || null,
      // Surface a small subset of progress so dashboards can render.
      adaptiveLearning: data.adaptiveLearning ? {
        overallCompetency: data.adaptiveLearning.overallCompetency ?? null,
        totalQuestionsAnswered: data.adaptiveLearning.totalQuestionsAnswered ?? null,
        lastQuestionUpdate: data.adaptiveLearning.lastQuestionUpdate ?? null,
      } : null,
    };
  });
  return { users };
});

/**
 * Add a uid to both users' `friends` arrays. Used to accept a friend
 * request, reconcile a referrer relationship, or auto-friend on signup.
 * Only the caller, or an admin, may pass a `selfUid` other than their own.
 */
export const addMutualFriendship = onCall(async (request) => {
  const authToken = request.auth;
  if (!authToken) throw new HttpsError('unauthenticated', 'Missing authentication.');
  const callerUid = authToken.uid;
  const data = (request.data || {}) as any;
  const selfUid = String(data.selfUid || callerUid);
  const otherUid = String(data.otherUid || '');
  if (!otherUid) throw new HttpsError('invalid-argument', 'Missing otherUid');
  if (selfUid === otherUid) throw new HttpsError('invalid-argument', 'Cannot friend yourself');
  if (selfUid !== callerUid && !tokenIsAdmin(authToken.token)) {
    throw new HttpsError('permission-denied', 'Forbidden');
  }
  const db = getFirestore();
  const FieldValueLocal = (await import('firebase-admin/firestore')).FieldValue;
  const selfRef = db.collection('users').doc(selfUid);
  const otherRef = db.collection('users').doc(otherUid);
  // Sanity-check that the other user exists before mutating.
  const otherSnap = await otherRef.get();
  if (!otherSnap.exists) throw new HttpsError('not-found', 'Other user not found');
  await Promise.all([
    selfRef.set({ friends: FieldValueLocal.arrayUnion(otherUid) }, { merge: true }),
    otherRef.set({ friends: FieldValueLocal.arrayUnion(selfUid) }, { merge: true }),
  ]);
  return { ok: true };
});

/**
 * School-admin mutations on a student/staff `users` doc. Restricted to the
 * fields a teacher legitimately needs to change. Authorised either by an
 * `admin` custom claim or by a `schoolAdminOf` claim that matches the
 * target's `schoolId`.
 */
const SCHOOL_ADMIN_ALLOWED_FIELDS = new Set(['class', 'role', 'schoolId', 'schoolName']);
export const schoolAdminUpdateUser = onCall(async (request) => {
  const authToken = request.auth;
  if (!authToken) throw new HttpsError('unauthenticated', 'Missing authentication.');
  const claims = (authToken.token || {}) as any;
  const targetUid = String((request.data as any)?.uid || '');
  const updates = ((request.data as any)?.updates || {}) as Record<string, any>;
  if (!targetUid) throw new HttpsError('invalid-argument', 'Missing uid');
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (SCHOOL_ADMIN_ALLOWED_FIELDS.has(k)) filtered[k] = v;
  }
  if (Object.keys(filtered).length === 0) {
    throw new HttpsError('invalid-argument', 'No allowed fields to update');
  }
  const db = getFirestore();
  const targetRef = db.collection('users').doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new HttpsError('not-found', 'Target user not found');
  const targetSchool = String((targetSnap.data() as any)?.schoolId || '');
  const callerSchool = String(claims.schoolId || '');
  const callerIsSchoolAdmin = (
    claims.role === 'schoolAdmin' || claims.role === 'teacher'
  ) && callerSchool && callerSchool === targetSchool;
  if (!tokenIsAdmin(claims) && !callerIsSchoolAdmin) {
    throw new HttpsError('permission-denied', 'Forbidden');
  }
  // Also allow setting a school-admin's `schoolId` to null (i.e. removing
  // them from the school) only by an admin or someone removing themselves.
  if ('schoolId' in filtered && filtered.schoolId === null) {
    if (!tokenIsAdmin(claims) && callerSchool !== targetSchool) {
      throw new HttpsError('permission-denied', 'Forbidden');
    }
  }
  await targetRef.set(filtered, { merge: true });
  return { ok: true };
});

/**
 * Grants or revokes the `admin` custom claim on a target user.
 * Must be called by an existing admin OR (for first-run bootstrapping) by an
 * email listed in BOOTSTRAP_ADMIN_EMAILS.
 *
 * After running this the target user must sign out and back in (or call
 * `getIdToken(true)`) for the new claim to appear in their token.
 */
export const setAdminClaim = onCall(async (request) => {
  const authToken = request.auth;
  if (!authToken || !authToken.token) {
    throw new HttpsError('unauthenticated', 'Missing authentication.');
  }
  const callerEmail = String((authToken.token as any).email || '').toLowerCase();
  const bootstrapAdmins = getBootstrapAdminEmails();
  const callerIsAdmin = tokenIsAdmin(authToken.token) || bootstrapAdmins.includes(callerEmail);
  if (!callerIsAdmin) {
    throw new HttpsError('permission-denied', 'Forbidden');
  }
  const targetUid = String((request.data as any)?.uid || '');
  const grant = (request.data as any)?.admin !== false; // default to grant
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'Missing uid');
  }
  const auth = getAuth();
  const target = await auth.getUser(targetUid);
  const existingClaims = target.customClaims || {};
  const nextClaims = { ...existingClaims, admin: !!grant };
  await auth.setCustomUserClaims(targetUid, nextClaims);
  return { ok: true, uid: targetUid, admin: !!grant };
});

export const adminDeleteUser = onCall(async (request) => {
  const authToken = request.auth;
  if (!authToken || !authToken.token) {
    throw new HttpsError('unauthenticated', 'Missing authentication.');
  }
  if (!tokenIsAdmin(authToken.token)) {
    throw new HttpsError('permission-denied', 'Forbidden');
  }

  const uid: string = String((request.data as any)?.uid || '');
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Missing uid');
  }

  const db = getFirestore();
  // Delete subcollections and user doc
  const userDocRef = db.collection('users').doc(uid);
  const subcollections = await userDocRef.listCollections();
  for (const col of subcollections) {
    const snap = await col.get();
    const batchLimit = 400;
    let batch = db.batch();
    let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      count++;
      if (count % batchLimit === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
  }
  await userDocRef.delete();

  // Delete auth user
  await getAuth().deleteUser(uid);

  return { ok: true };
});

/**
 * Releases the 'active-practice-session' flag for the authenticated user.
 * Clients should call this via navigator.sendBeacon or fetch with keepalive on tab close.
 */
export const releasePracticeSession = onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const idToken = (req.body && (req.body as any).idToken) || (req.query && (req.query as any).idToken);
    if (!idToken || typeof idToken !== 'string') {
      res.status(401).json({ error: 'Missing idToken' });
      return;
    }
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = getFirestore();
    await db.collection('users').doc(uid).set({ ['active-practice-session']: false }, { merge: true });
    res.json({ ok: true });
  } catch (e: any) {
    try {
      res.status(500).json({ error: (e && e.message) || 'Internal error' });
    } catch {}
  }
});

/**
 * Minimal HTTPS endpoint for testing email delivery.
 * POST with JSON: { to, subject, text?, html? }
 */
export const sendTestEmail = onRequest({
  secrets: [...EMAIL_SECRETS],
  cors: [/.*$/],
}, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const body = (req.body || {}) as Partial<SendEmailInput>;
    if (!body.to || !body.subject) {
      res.status(400).json({ error: 'Missing to or subject' });
      return;
    }

    if (EMAILS_DISABLED) {
      res.json({ ok: true, disabled: true });
      return;
    }

    const result = await Email.send({
      to: body.to,
      subject: String(body.subject),
      text: body.text,
      html: body.html,
      cc: body.cc,
      bcc: body.bcc,
      replyTo: body.replyTo,
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

// Admin-only endpoint to broadcast a custom email
export const sendAdminEmail = onRequest({
  secrets: [...EMAIL_SECRETS],
  cors: [/.*$/],
}, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const { idToken, subject, html, text, toUserIds, everyone } = (req.body || {}) as any;
    if (!idToken) {
      res.status(401).json({ error: 'Missing idToken' });
      return;
    }
    const decoded = await getAuth().verifyIdToken(String(idToken));
    if (!tokenIsAdmin(decoded)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (!subject || !html) {
      res.status(400).json({ error: 'Missing subject or html' });
      return;
    }
    const db = getFirestore();
    let recipientUids: string[] = [];
    if (everyone) {
      const snap = await db.collection('users').limit(1000).get();
      recipientUids = snap.docs.map((d) => d.id);
    } else if (Array.isArray(toUserIds)) {
      recipientUids = toUserIds.map((x: any) => String(x)).filter(Boolean).slice(0, 500);
    } else {
      res.status(400).json({ error: 'Missing recipients' });
      return;
    }

    if (EMAILS_DISABLED) {
      res.json({ ok: true, sent: 0, disabled: true });
      return;
    }

    const mails: Array<Promise<any>> = [];
    for (const uid of recipientUids) {
      try {
        const u = await getAuth().getUser(uid);
        const to = (u.email || '').trim();
        if (!to) continue;
        const tpl = customAdminEmailTemplate({ subject, bodyHtml: html, text });
        mails.push(Email.send({ to, subject: tpl.subject, html: tpl.html, text: tpl.text }));
      } catch {}
    }
    await Promise.allSettled(mails);
    res.json({ ok: true, sent: mails.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

// Superadmin-only callable to create a school and an admin invite code
export const createSchoolCallable = onCall(async (request) => {
  const authToken = request.auth;
  if (!authToken || !authToken.token) {
    throw new HttpsError('unauthenticated', 'Missing authentication.');
  }
  if (!tokenIsAdmin(authToken.token)) {
    throw new HttpsError('permission-denied', 'Forbidden');
  }
  const { name, slug, country, curriculum, domainAllowlist } = (request.data || {}) as any;
  if (!name || !slug) {
    throw new HttpsError('invalid-argument', 'Missing name or slug');
  }
  const db = getFirestore();
  const ref = db.collection('schools').doc();
  await ref.set({
    name: String(name),
    slug: String(slug),
    country: String(country || 'US'),
    language: 'en',
    curriculum: String(curriculum || 'US'),
    createdAt: Date.now(),
    createdBy: authToken.uid,
    adminUids: [],
    teacherUids: [],
    studentCount: 0,
    domainAllowlist: Array.isArray(domainAllowlist) ? domainAllowlist.map((d: any) => String(d).toLowerCase()).slice(0, 20) : [],
    settings: { onboardingSkip: true, defaultPracticeGoal: { minutesPerWeek: 150 } },
  });
  // Generate a unique 6-char admin invite code
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 7; i++) {
    let c = '';
    for (let j = 0; j < 6; j++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
    const exists = await db.collection('schoolInvites').doc(c).get();
    if (!exists.exists) { code = c; break; }
  }
  if (!code) throw new HttpsError('internal', 'Failed to allocate code');
  await db.collection('schoolInvites').doc(code).set({
    code,
    schoolId: ref.id,
    role: 'schoolAdmin',
    maxUses: 200,
    uses: 0,
    expiresAt: null,
    createdAt: Date.now(),
    createdBy: authToken.uid,
    active: true,
  });
  return { ok: true, schoolId: ref.id, adminInviteCode: code };
});

// Redeem a school invite code (callable) - sets user's schoolId/role and updates counters
export const redeemSchoolInviteCallable = onCall(async (request) => {
  const authToken = request.auth;
  if (!authToken || !authToken.token || !(authToken.token as any).email) {
    throw new HttpsError('unauthenticated', 'Missing authentication.');
  }
  const { code } = (request.data || {}) as any;
  if (!code) throw new HttpsError('invalid-argument', 'Missing code');
  const db = getFirestore();
  const uid = authToken.uid;
  const inviteRef = db.collection('schoolInvites').doc(String(code).trim().toUpperCase());
  try {
    await db.runTransaction(async (txn) => {
      const inviteSnap = await txn.get(inviteRef);
      if (!inviteSnap.exists) throw new Error('Invalid code');
      const inv = inviteSnap.data() as any;
      if (inv.active === false) throw new Error('Code inactive');
      if (inv.expiresAt && Date.now() > Number(inv.expiresAt)) throw new Error('Code expired');
      const uses = Number(inv.uses || 0);
      const max = Number(inv.maxUses || 0) || 1;
      if (uses >= max) throw new Error('Code exhausted');
      const userRef = db.collection('users').doc(uid);
      const userSnap = await txn.get(userRef);
      const user = userSnap.exists ? (userSnap.data() as any) : {};
      const existingSchoolId = String(user.schoolId || '');
      if (existingSchoolId && existingSchoolId !== String(inv.schoolId)) throw new Error('User already belongs to a different school');
      const schoolRef = db.collection('schools').doc(String(inv.schoolId));
      const schoolSnap = await txn.get(schoolRef);
      if (!schoolSnap.exists) throw new Error('School not found');
      const school = schoolSnap.data() as any;
      const userUpdate: any = { schoolId: String(inv.schoolId), role: String(inv.role || 'schoolAdmin') };
      if (!user.schoolName && school && school.name) userUpdate.schoolName = String(school.name);
      if (!user.school && school && school.name) userUpdate.school = school?.name || null;
      if (!user.country) userUpdate.country = 'US';
      if (!user.language) userUpdate.language = 'English';
      if (!user.curriculum) userUpdate.curriculum = 'US';
      userUpdate.referrerUsername = typeof school?.slug === 'string' ? String(school.slug) : (user.referrerUsername || null);
      userUpdate.referrerId = String(inv.schoolId);
      txn.set(userRef, userUpdate, { merge: true });
      txn.update(inviteRef, { uses: uses + 1 });
      if (!existingSchoolId) {
        if (String(inv.role || 'student') === 'student') txn.update(schoolRef, { studentCount: (require('firebase-admin').firestore.FieldValue).increment(1) });
        else if (String(inv.role || '') === 'teacher') txn.update(schoolRef, { teacherUids: (require('firebase-admin').firestore.FieldValue).arrayUnion(uid) });
        else if (String(inv.role || '') === 'schoolAdmin') txn.update(schoolRef, { adminUids: (require('firebase-admin').firestore.FieldValue).arrayUnion(uid) });
      }
    });
    // Apply custom claims
    const authUser = await getAuth().getUser(uid);
    const existingClaims = (authUser.customClaims || {}) as any;
    const inv = (await db.collection('schoolInvites').doc(String(code).trim().toUpperCase()).get()).data() as any;
    const newClaims = { ...existingClaims } as any;
    newClaims.schoolId = String(inv.schoolId);
    const currentRole = String(existingClaims.role || '');
    const incoming = String(inv.role || 'schoolAdmin');
    const rank = (r: string) => (r === 'schoolAdmin' ? 3 : r === 'teacher' ? 2 : r === 'student' ? 1 : 0);
    newClaims.role = rank(incoming) >= rank(currentRole) ? incoming : currentRole;
    await getAuth().setCustomUserClaims(uid, newClaims);
    return { ok: true, schoolId: String(newClaims.schoolId), role: String(newClaims.role) };
  } catch (e: any) {
    throw new HttpsError('failed-precondition', e?.message || 'Redeem failed');
  }
});

// Callable to check a referral username or uid and whether it's allowed
export const checkReferralCallable = onCall({ cors: true }, async (request) => {
  const { ref } = (request.data || {}) as any;
  if (!ref || typeof ref !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing ref');
  }
  try {
    const db = getFirestore();
    // Try username
    const usersByUsername = await db.collection('users').where('username', '==', String(ref)).limit(1).get();
    let refDoc = null;
    if (!usersByUsername.empty) {
      refDoc = usersByUsername.docs[0];
    } else {
      const userSnap = await db.collection('users').doc(String(ref)).get();
      if (userSnap.exists) refDoc = userSnap;
    }
    if (!refDoc) return { ok: true, found: false, allowed: false };
    const refData = refDoc.data() as any;
    const referrerId = refDoc.id;
    const refUsername = String(refData?.username || '').toLowerCase();
    const isUnlimited = refUsername === 'pedro' || refData?.isUnlimitedReferrer === true;
    if (isUnlimited) return { ok: true, found: true, allowed: true, referrerId, referrerName: refData?.name || refData?.email || null };
    const refsSnap = await db.collection('referrals').where('referrerId', '==', referrerId).get();
    const referredCount = refsSnap.size;
    return { ok: true, found: true, allowed: referredCount < 3, referredCount, referrerId, referrerName: refData?.name || refData?.email || null };
  } catch (e: any) {
    throw new HttpsError('internal', e?.message || 'Failed to check referral');
  }
});

// Invite a teacher by email; send activation link (disabled). If no email is provided, just generate a link.
export const inviteTeacherCallable = onCall({ secrets: [...EMAIL_SECRETS] }, async (request) => {
  const authToken = request.auth;
  if (!authToken || !authToken.token || !(authToken.token as any).email) {
    throw new HttpsError('unauthenticated', 'Missing authentication.');
  }
  const claims: any = authToken.token || {};
  const schoolId = String((claims.schoolId || ''));
  const role = String((claims.role || ''));
  if (!schoolId || role !== 'schoolAdmin') {
    throw new HttpsError('permission-denied', 'Forbidden');
  }
  const { email, name } = (request.data || {}) as any;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
    throw new HttpsError('invalid-argument', 'Invalid email');
  }
  const db = getFirestore();
  const token = Math.random().toString(36).slice(2, 12);
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  await db.collection('teacherInvites').doc(token).set({
    token,
    schoolId,
    email: email ? String(email).toLowerCase() : null,
    name: name ? String(name) : null,
    createdAt: Date.now(),
    expiresAt,
    createdBy: authToken.uid,
  });

  // If emails are disabled or no email was provided, return a link for manual sharing
  const baseUrl = getWebBaseUrl();
  const appName = getAppName();
  const signupLink = `${baseUrl}/signup?teacherToken=${token}`;
  if (EMAILS_DISABLED || !email) {
    return { ok: true, link: signupLink, emailed: false, disabled: true };
  }

  try {
    await Email.send({ to: String(email).toLowerCase(), subject: `You're invited to ${appName} as a teacher`, html: `<p>Hello${name ? ' ' + String(name) : ''},</p><p>You have been invited to join your school on ${appName} as a teacher.</p><p><a href="${signupLink}">Click here to activate your account</a> and set a password.</p>`, text: `You're invited to ${appName} as a teacher\n${signupLink}` });
  } catch {}
  return { ok: true, link: signupLink, emailed: true };
});

export const acceptTeacherInviteCallable = onCall(async (request) => {
  const authToken = request.auth;
  if (!authToken || !authToken.token || !(authToken.token as any).email) {
    throw new HttpsError('unauthenticated', 'Missing authentication.');
  }
  const uid = authToken.uid;
  const { token } = (request.data || {}) as any;
  if (!token) throw new HttpsError('invalid-argument', 'Missing token');

  const db = getFirestore();
  const inviteRef = db.collection('teacherInvites').doc(String(token));
  
  let schoolId = '';

  try {
    schoolId = await db.runTransaction(async (txn) => {
      const inviteSnap = await txn.get(inviteRef);
      if (!inviteSnap.exists) throw new Error('Invalid or expired invite');
      const inv = inviteSnap.data() as any;
      
      if (inv.expiresAt && Date.now() > Number(inv.expiresAt)) throw new Error('Invite expired');
      
      // If the invite was created with a specific email, only that email can claim it
      if (inv.email && String(inv.email).toLowerCase() !== String((authToken.token as any).email).toLowerCase()) {
        throw new Error('This invite is for a different email address');
      }

      const schoolRef = db.collection('schools').doc(String(inv.schoolId));
      const schoolSnap = await txn.get(schoolRef);
      if (!schoolSnap.exists) throw new Error('School not found');
      const school = schoolSnap.data() as any;

      const userRef = db.collection('users').doc(uid);
      const userSnap = await txn.get(userRef);
      const user = userSnap.exists ? (userSnap.data() as any) : {};

      if (user.schoolId && user.schoolId !== inv.schoolId) {
         if (user.schoolId !== inv.schoolId) throw new Error('User already belongs to a different school');
      }

      const userUpdate: any = { 
        schoolId: String(inv.schoolId), 
        role: 'teacher',
        schoolName: String(school.name || '')
      };
      
      if (!user.country) userUpdate.country = 'US';
      if (!user.language) userUpdate.language = 'English';
      if (!user.referrerId) userUpdate.referrerId = String(inv.schoolId);

      txn.set(userRef, userUpdate, { merge: true });
      txn.update(schoolRef, { teacherUids: (require('firebase-admin').firestore.FieldValue).arrayUnion(uid) });
      
      // Delete the invite so it cannot be reused
      txn.delete(inviteRef);
      
      return String(inv.schoolId);
    });

    // Update custom claims
    const authUser = await getAuth().getUser(uid);
    const existingClaims = (authUser.customClaims || {}) as any;
    const newClaims = { ...existingClaims };
    newClaims.schoolId = schoolId;
    newClaims.role = 'teacher';
    
    await getAuth().setCustomUserClaims(uid, newClaims);

    return { ok: true, schoolId, role: 'teacher' };

  } catch (e: any) {
    throw new HttpsError('failed-precondition', e?.message || 'Accept failed');
  }
});

// HTTPS endpoint to create assignments and notify students
export const createAssignment = onRequest({
  secrets: [...EMAIL_SECRETS],
  cors: [/.*$/],
}, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    const { idToken, schoolId, assignment } = (req.body || {}) as any;
    if (!idToken || !schoolId || !assignment) {
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }

    // Verify Auth
    const decoded = await getAuth().verifyIdToken(String(idToken));
    const uid = decoded.uid;
    const claims = decoded as any;
    
    // Check permissions (must be schoolAdmin or teacher of that school)
    if (claims.schoolId !== schoolId || !['schoolAdmin', 'teacher'].includes(claims.role)) {
       // Double check DB in case claims are stale
       const db = getFirestore();
       const userDoc = await db.collection('users').doc(uid).get();
       const userData = userDoc.data() as any;
       if (userData.schoolId !== schoolId || !['schoolAdmin', 'teacher'].includes(userData.role)) {
         res.status(403).json({ error: 'Forbidden' });
         return;
       }
    }

    const db = getFirestore();
    const batch = db.batch();
    const assignRef = db.collection('schools').doc(schoolId).collection('assignments').doc();
    
    const newAssignment = {
      ...assignment,
      createdAt: Date.now(),
      createdBy: uid,
      status: 'active',
      id: assignRef.id
    };
    
    batch.set(assignRef, newAssignment);
    await batch.commit();

    // EMAIL LOGIC
    let studentIds: string[] = [];
    const scope = assignment.assignedScope || { type: 'all' };
    
    if (scope.type === 'subset' && Array.isArray(assignment.studentIds)) {
      studentIds = assignment.studentIds;
    } else if (scope.type === 'classes' && Array.isArray(scope.classes)) {
       const classes = scope.classes as string[];
       const chunks = [];
       // Batch 'in' queries (max 10)
       for (let i = 0; i < classes.length; i += 10) {
         chunks.push(classes.slice(i, i + 10));
       }
       for (const chunk of chunks) {
         const snap = await db.collection('users')
           .where('schoolId', '==', schoolId)
           .where('class', 'in', chunk)
           .get();
         snap.docs.forEach(d => studentIds.push(d.id));
       }
    } else {
       // 'all' - fetch all students in school
       // Limit to 500 for safety in this iteration
       const snap = await db.collection('users')
         .where('schoolId', '==', schoolId)
         .where('role', '==', 'student')
         .limit(500)
         .get();
       studentIds = snap.docs.map(d => d.id);
    }

    // Filter and send emails
    const uniqueIds = Array.from(new Set(studentIds));
    const emails: string[] = [];
    
    // Fetch emails from Auth in chunks of 100
    for (let i = 0; i < uniqueIds.length; i += 100) {
      const chunk = uniqueIds.slice(i, i + 100);
      try {
        if (chunk.length > 0) {
          const result = await getAuth().getUsers(chunk.map(uid => ({ uid })));
          result.users.forEach(u => {
            if (u.email) emails.push(u.email);
          });
        }
      } catch (e) {
        console.error('Error fetching users:', e);
      }
    }

    if (emails.length > 0) {
        const dueDate = assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : undefined;
        const tpl = assignmentEmailTemplate({ title: assignment.title, dueDate });
        
        // Send individually
        const sendPromises = emails.map(email => 
            Email.send({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
                .catch(e => console.error(`Failed to send assignment email to ${email}`, e))
        );
        
        await Promise.allSettled(sendPromises);
    }

    res.json({ ok: true, id: assignRef.id, recipients: emails.length });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

/**
 * Allows an existing user to join a school via slug (public invite link logic).
 */
export const joinSchoolCallable = onCall(async (request) => {
  const authToken = request.auth;
  if (!authToken || !authToken.token || !(authToken.token as any).email) {
    throw new HttpsError('unauthenticated', 'Missing authentication.');
  }
  const uid = authToken.uid;
  const { slug } = (request.data || {}) as any;
  if (!slug) throw new HttpsError('invalid-argument', 'Missing slug');

  const db = getFirestore();
  
  // Find school by slug
  const schoolsQ = await db.collection('schools').where('slug', '==', String(slug)).limit(1).get();
  if (schoolsQ.empty) throw new HttpsError('not-found', 'School not found');
  const schoolDoc = schoolsQ.docs[0];
  const schoolData = schoolDoc.data();
  const schoolId = schoolDoc.id;

  try {
    await db.runTransaction(async (txn) => {
      const userRef = db.collection('users').doc(uid);
      const userSnap = await txn.get(userRef);
      if (!userSnap.exists) throw new Error('User not found');
      const user = userSnap.data() as any;

      if (user.schoolId) {
        if (user.schoolId === schoolId) return; // Already joined
        throw new Error('User already belongs to a different school');
      }

      const userUpdate: any = {
        schoolId: schoolId,
        schoolName: String(schoolData.name || ''),
        role: 'student', // Default to student when joining via slug
        referrerUsername: slug,
        referrerId: schoolId
      };
      
      // Update user
      txn.set(userRef, userUpdate, { merge: true });
      
      // Update school counters
      const schoolRef = db.collection('schools').doc(schoolId);
      txn.update(schoolRef, { studentCount: FieldValue.increment(1) });
    });

    // Update custom claims
    const authUser = await getAuth().getUser(uid);
    const existingClaims = (authUser.customClaims || {}) as any;
    const newClaims = { ...existingClaims, schoolId: schoolId, role: 'student' };
    await getAuth().setCustomUserClaims(uid, newClaims);

    return { ok: true, schoolId, schoolName: schoolData.name };
  } catch (e: any) {
    throw new HttpsError('failed-precondition', e?.message || 'Join failed');
  }
});

/**
 * Allows a student to leave a school, or a school admin to remove a student.
 */
export const leaveSchoolCallable = onCall({ secrets: [...EMAIL_SECRETS] }, async (request) => {
  const authToken = request.auth;
  if (!authToken || !authToken.token || !(authToken.token as any).email) {
    throw new HttpsError('unauthenticated', 'Missing authentication.');
  }
  
  const callerUid = authToken.uid;
  const callerClaims = (authToken.token || {}) as any;
  
  // Target user: default to caller, but admin can specify another uid
  let targetUid = callerUid;
  const { studentId } = (request.data || {}) as any;
  
  if (studentId && studentId !== callerUid) {
    // Check if caller is school admin
    if (callerClaims.role !== 'schoolAdmin') {
      throw new HttpsError('permission-denied', 'Only school admins can remove other students');
    }
    targetUid = studentId;
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(targetUid);
  
  let schoolId = '';
  let schoolName = '';
  let studentName = '';
  let studentEmail = '';
  let isSelfLeave = (targetUid === callerUid);

  try {
    await db.runTransaction(async (txn) => {
      const userSnap = await txn.get(userRef);
      if (!userSnap.exists) throw new Error('User not found');
      const user = userSnap.data() as any;
      
      if (!user.schoolId) return; // Already not in a school
      
      schoolId = user.schoolId;
      schoolName = user.schoolName || 'School';
      studentName = user.name || 'Student';
      studentEmail = user.email || '';

      // If admin is removing, verify they belong to the same school
      if (!isSelfLeave) {
        if (callerClaims.schoolId !== schoolId) {
          throw new Error('You can only remove students from your own school');
        }
      }

      // Update user
      txn.update(userRef, {
        schoolId: null,
        schoolName: FieldValue.delete(),
        school: FieldValue.delete(),
        referrerId: FieldValue.delete(),
        referrerUsername: FieldValue.delete()
        // We keep role as 'student' or change to 'user'? 
        // Keeping 'student' is safer for now as 'user' might not be a valid role in some logic.
        // But maybe we should remove role if it's strictly tied to school?
        // Let's leave role as is or default to 'student' (which is the base role).
      });

      // Update school counters
      const schoolRef = db.collection('schools').doc(schoolId);
      txn.update(schoolRef, { studentCount: FieldValue.increment(-1) });
    });

    // Update custom claims for the target user
    const authUser = await getAuth().getUser(targetUid);
    const existingClaims = (authUser.customClaims || {}) as any;
    const newClaims = { ...existingClaims };
    delete newClaims.schoolId;
    // user retains role 'student' usually
    await getAuth().setCustomUserClaims(targetUid, newClaims);

    // Send email notification if student left by themselves
    if (isSelfLeave && schoolId && !EMAILS_DISABLED) {
      // Find school admins
      const schoolDoc = await db.collection('schools').doc(schoolId).get();
      const sData = schoolDoc.data() as any;
      const adminUids: string[] = Array.isArray(sData?.adminUids) ? sData.adminUids : [];
      
      if (adminUids.length > 0) {
        // Fetch admin emails
        const adminUsers = await Promise.all(adminUids.map(uid => getAuth().getUser(uid).catch(() => null)));
        const adminEmails = adminUsers.filter(u => u && u.email).map(u => u!.email!);
        
        if (adminEmails.length > 0) {
          const subject = `Student Left: ${studentName}`;
          const html = `<p>The student <strong>${studentName}</strong> (${studentEmail}) has voluntarily disaffiliated from <strong>${schoolName}</strong>.</p>`;
          const text = `Student ${studentName} (${studentEmail}) has left ${schoolName}.`;
          
          await Promise.all(adminEmails.map(to => 
            Email.send({ to, subject, html, text }).catch(e => console.error('Failed to email admin', e))
          ));
        }
      }
    }

    return { ok: true };
  } catch (e: any) {
    throw new HttpsError('failed-precondition', e?.message || 'Leave failed');
  }
});
export * from './stats/aggregation.js';

// ---------------------------------------------------------------------------
// Voice session reservation & usage tracking
// ---------------------------------------------------------------------------
import { assertWithinLimits, recordVoiceCall, recordTokenCost } from './lib/aiUsage.js';

export const reserveVoiceSession = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = request.auth.uid;
  const aiState = await assertWithinLimits(uid);
  await recordVoiceCall(uid);
  return { ok: true, byok: !!aiState.geminiApiKey };
});

export const recordVoiceUsage = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const { inputTokens, outputTokens, model } = (request.data || {}) as {
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
  };
  const uid = request.auth.uid;
  const m = model || 'gemini-2.5-flash-native-audio-preview-12-2025';
  await recordTokenCost(uid, m, {
    promptTokenCount: inputTokens ?? 0,
    candidatesTokenCount: outputTokens ?? 0,
  });
  return { ok: true };
});

export const recordCanvasUsage = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const { inputChars, outputChars, model } = (request.data || {}) as {
    inputChars?: number;
    outputChars?: number;
    model?: string;
  };
  const uid = request.auth.uid;
  const m = model || 'gemini-2.5-flash-lite';
  const approxInputTokens = Math.ceil((inputChars ?? 0) / 4);
  const approxOutputTokens = Math.ceil((outputChars ?? 0) / 4);
  await recordTokenCost(uid, m, {
    promptTokenCount: approxInputTokens,
    candidatesTokenCount: approxOutputTokens,
  });
  return { ok: true };
});
