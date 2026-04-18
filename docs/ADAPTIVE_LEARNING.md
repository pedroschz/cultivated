# Adaptive Learning System

CultivatED uses a custom adaptive learning engine to personalize question selection and track mastery. This document explains the algorithm in detail.

---

## Overview

Every user has a **competency score** (0–100) for each of the 29 subdomains (skills) in the question bank. These scores drive:

1. **Question selection** — prefer skills where the student needs practice.
2. **Difficulty selection** — target questions slightly above current comfort level.
3. **Dashboard analytics** — surface strengths, weaknesses, and improvement trends.

---

## Competency score mechanics

### Base delta on correct/incorrect

```
Correct answer:
  base_delta = 8 + (difficulty * 4)    →  Easy: +8, Medium: +12, Hard: +16

Incorrect answer:
  base_delta = -(6 + (difficulty * 3)) →  Easy: -6, Medium: -9, Hard: -12
```

### Time modifier

Each question has an `averageTime` (derived from historical data, defaults 90s).

```
ratio = timeSpent / averageTime

If correct:
  ratio < 0.6  → speed bonus: +2
  ratio > 1.4  → slow penalty: -1

If incorrect:
  ratio < 0.6  → no extra penalty (fast wrong is still learning)
  ratio > 1.4  → extra penalty: -1
```

### Streak modifier

```
If correct and currentStreak >= 3:  delta *= 1.30  (30% bonus)
If incorrect and wrongStreak >= 3:  delta *= 1.20  (20% extra penalty)
```

### Clamping

The score is clamped to `[0, 100]` after each update. A score of 0 doesn't go negative; 100 can't exceed.

### Confidence score

A parallel `confidence` score (0–100) tracks certainty:
- Increases more slowly than competency on correct answers.
- Decreases faster on incorrect answers after a high streak.
- Used to identify "lucky streaks" vs. genuine mastery.

---

## Time decay

If a subdomain hasn't been practiced recently, its score decays to simulate forgetting:

```
days_since = (now - lastAttempted) / 86400000
decay_factor = 0.005 * (1 - score / 200)   // higher scores decay slower
score -= decay_factor * days_since
```

Decay only applies during question selection, not on every page load.

---

## Question selection

`adaptive-service.ts` → `getNextQuestion(userId, subject?)`:

1. Fetch the user's current `subdomainScores`.
2. Filter the question bank to the requested subject (Math or R&W).
3. For each candidate question, compute a **priority score**:
   ```
   priority = (100 - subdomainScore) * 0.6       // focus on weak areas
             + recencyPenalty * 0.3               // avoid repeating recent questions
             + difficultyFit * 0.1               // prefer questions near current level
   ```
4. Return the question with the highest priority score.

The **difficulty fit** term rewards questions where the expected difficulty matches `score`:
- score < 40 → prefer Easy
- score 40–70 → prefer Medium
- score > 70 → prefer Hard

---

## Domain summaries

The `dashboard/page.tsx` computes domain-level mastery by averaging subdomain scores within each domain, weighted by `questionsAttempted`.

The three top-level metrics displayed are:

| Metric | Calculation |
|---|---|
| **Overall** | Weighted average of all 29 subdomain scores |
| **Math** | Weighted average of subdomains 0–18 (domains 0–3) |
| **Reading & Writing** | Weighted average of subdomains 19–28 (domains 4–7) |

---

## Mastery history

On every answer submission, the app writes/updates a daily snapshot to `users/{uid}.adaptiveLearning.masteryHistory["YYYY-MM-DD"]`. This powers the 7-day historical mastery chart on the dashboard.

If a day is missing (user was inactive), the last known values are carried forward when the dashboard loads.

---

## Scoring engine source

`src/lib/adaptive-learning/scoring-engine.ts` — `ScoringEngine.calculateDelta()`.

`src/lib/adaptive-learning/adaptive-service.ts` — `scoreAnswer()`, `getNextQuestion()`.

`src/lib/adaptive-learning/skill-mapping.ts` — full skill → subdomainId → domain mapping.
