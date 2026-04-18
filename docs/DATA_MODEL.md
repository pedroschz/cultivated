# Firestore Data Model

All collections live under the default Firestore database of your Firebase project.

---

## `users/{uid}`

The primary user document. Written by the client and Cloud Function triggers.

```typescript
{
  uid: string;                    // same as document ID
  email: string;
  displayName?: string;
  username?: string;              // unique lowercase handle
  photoURL?: string;
  createdAt: Timestamp;
  schoolId?: string;              // ref to schools/{schoolId}
  schoolName?: string;
  country?: string;               // ISO-3166-1 alpha-2
  curriculum?: string;            // e.g. "US"
  role?: "teacher" | "schoolAdmin";
  isAdmin?: boolean;              // mirrored from Auth custom claim
  isUnlimitedReferrer?: boolean;  // opt-in for referral program
  friends?: string[];             // array of uids
  onboarded?: boolean;
  streak?: number;
  lastActiveDate?: string;        // YYYY-MM-DD local date
  settings?: {
    voiceEnabled?: boolean;
    timerVisible?: boolean;
    notifications?: boolean;
  };
  adaptiveLearning?: AdaptiveLearningState; // see below
}
```

### `users/{uid}/history/{answerId}`

One document per answered question. Used for mastery-history backfill.

```typescript
{
  questionId: string;
  subdomainId: string;
  isCorrect: boolean;
  timeSpent: number;      // seconds
  difficulty: 0 | 1 | 2;
  answeredAt: Timestamp;
  sessionId?: string;
}
```

---

## Adaptive learning shape (`adaptiveLearning` field on `users/{uid}`)

```typescript
{
  subdomainScores: {
    [subdomainId: string]: {   // subdomainId is "0"–"28" (see skill-mapping.ts)
      score: number;           // 0–100 competency score
      confidence: number;      // 0–100 confidence score
      questionsAttempted: number;
      questionsCorrect: number;
      lastAttempted: Timestamp;
      currentStreak: number;
      bestStreak: number;
      difficultyPerformance: {
        easy: { attempted: number; correct: number };
        medium: { attempted: number; correct: number };
        hard: { attempted: number; correct: number };
      };
      averageTime: number;     // seconds
    };
  };
  masteryHistory: {
    [date: string]: {          // key is "YYYY-MM-DD" local date
      overall: number;         // 0–100
      math: number;
      readingWriting: number;
      domainCompetency?: { [domainId: string]: number };
    };
  };
  questionQueue?: string[];    // pre-computed next question IDs
  lastUpdated?: Timestamp;
}
```

---

## `users_public/{uid}`

A safe read-only mirror of display fields. Maintained by the `mirrorUserPublicOnWrite` Cloud Function trigger. Never write to this from the client directly.

```typescript
{
  uid: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  schoolId?: string;
  schoolName?: string;
  friends?: string[];
  streak?: number;
  // Aggregated mastery for leaderboard display:
  overallMastery?: number;
  mathMastery?: number;
  readingWritingMastery?: number;
}
```

---

## `questions/{questionId}`

The question bank. All questions are publicly readable (per `firestore.rules`). Only admins may create/delete.

```typescript
{
  id: string;                            // same as document ID
  domain: number;                        // see domain IDs below
  domainName?: string;
  skill: string;                         // must match a skill in skill-mapping.ts
  difficulty: 0 | 1 | 2;               // 0=Easy 1=Medium 2=Hard
  question: string;                      // supports LaTeX via $...$ / $$...$$
  options: string[] | QuestionOption[];  // null for open-ended
  answer: number | string | (number|string)[];  // index for MC, value for open
  explanation?: string;
  image?: string;                        // Firebase Storage URL
  image_description?: string;
  passage?: string;                      // reading passage (Reading & Writing)
  reported?: boolean;                    // flagged by users
  contextNotes?: { culture: string; text: string }[];
}
```

### Domain IDs

| ID | Name | Section |
|---|---|---|
| 0 | Algebra | Math |
| 1 | Advanced Math | Math |
| 2 | Problem-Solving and Data Analysis | Math |
| 3 | Geometry and Trigonometry | Math |
| 4 | Information and Ideas | Reading & Writing |
| 5 | Craft and Structure | Reading & Writing |
| 6 | Expression of Ideas | Reading & Writing |
| 7 | Standard English Conventions | Reading & Writing |

---

## `schools/{schoolId}`

```typescript
{
  name: string;
  slug: string;           // URL-safe, unique
  adminEmail?: string;
  createdAt: Timestamp;
  active?: boolean;
}
```

## `schoolInvites/{code}`

Admin invite tokens for teacher/school-admin onboarding.

```typescript
{
  schoolId: string;
  role: "teacher" | "schoolAdmin";
  email?: string;
  name?: string;
  active: boolean;
  expiresAt?: number;    // ms timestamp
  createdBy: string;     // admin uid
  createdAt: number;
  usedAt?: number;
  usedBy?: string;
}
```

---

## `referrals/{referralId}`

```typescript
{
  referrerId: string;
  referredUserId: string;
  referrerUsername?: string;
  createdAt: Timestamp;
}
```

## `blog_posts/{postId}`

```typescript
{
  title: string;
  slug: string;
  excerpt?: string;
  content: string;         // HTML from Tiptap
  author?: string;
  status: "draft" | "published";
  publishedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  coverImage?: string;
  tags?: string[];
}
```

## `reports/{reportId}` / `forum_reports/{reportId}`

User-submitted bug/content reports. Readable by admins only.

---

## Firestore indexes

See `firestore.indexes.json` for the full set of composite indexes. The key ones are:

- `users` — `(schoolId, createdAt)` for school member queries
- `questions` — `(domain, difficulty)` for adaptive question selection
- `blog_posts` — `(status, publishedAt DESC)` for blog listing
