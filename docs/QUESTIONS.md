# Question Bank Guide

This document explains the question format, how to author questions, and how to import a question bank into Firestore.

---

## Copyright notice

Do **not** copy real SAT® questions from College Board materials into the public question bank. SAT® questions are copyrighted by the College Board. Use original, College Board-style practice questions that you have authored or licensed.

---

## Question schema

Each question is a JSON object. The full TypeScript type is in `src/lib/types/practice.ts`.

```jsonc
{
  "id": "q_algebra_001",           // Unique string ID (auto-generated if omitted during import)

  // --- Classification ---
  "domain": 0,                     // Integer domain ID (see table below)
  "domainName": "Algebra",         // Human-readable domain name (optional, derived from domain if omitted)
  "skill": "Linear equations in one variable",  // Must match a skill name in skill-mapping.ts

  "difficulty": 1,                 // 0 = Easy | 1 = Medium | 2 = Hard

  // --- Content ---
  "question": "If $3x + 5 = 14$, what is the value of $x$?",
  // Supports LaTeX: inline $...$ and block $$...$$

  "options": ["2", "3", "4", "5"],
  // Multiple-choice: array of strings (or QuestionOption objects with text/imageURL/alt)
  // Open-ended (grid-in): set to null

  "answer": 1,
  // Multiple-choice: 0-based index into options array
  // Open-ended: the string value, e.g. "3"
  // Multiple correct answers: array, e.g. [0, 2]

  "explanation": "Subtract 5 from both sides: $3x = 9$, so $x = 3$.",

  // --- Optional fields ---
  "passage": "Read the following excerpt...",  // Reading & Writing questions only
  "image": "https://storage.googleapis.com/.../question-image.png",
  "image_description": "A bar chart showing..."
}
```

### Domain IDs

| `domain` | Name | Section |
|---|---|---|
| 0 | Algebra | Math |
| 1 | Advanced Math | Math |
| 2 | Problem-Solving and Data Analysis | Math |
| 3 | Geometry and Trigonometry | Math |
| 4 | Information and Ideas | Reading & Writing |
| 5 | Craft and Structure | Reading & Writing |
| 6 | Expression of Ideas | Reading & Writing |
| 7 | Standard English Conventions | Reading & Writing |

### Skill names

Skills must match exactly one of the strings in `src/lib/adaptive-learning/skill-mapping.ts`. Example skills:

- `"Linear equations in one variable"` (domain 0)
- `"Nonlinear functions"` (domain 1)
- `"Probability and conditional probability"` (domain 2)
- `"Right triangles and trigonometry"` (domain 3)
- `"Central Ideas and Details"` (domain 4)
- `"Words in Context"` (domain 5)
- `"Rhetorical Synthesis"` (domain 6)
- `"Boundaries"` (domain 7)

---

## Example questions file

A full example with one Math and one Reading & Writing question:

```json
[
  {
    "id": "q_algebra_example_001",
    "domain": 0,
    "skill": "Linear equations in one variable",
    "difficulty": 0,
    "question": "If $2x - 4 = 10$, what is the value of $x$?",
    "options": ["3", "5", "7", "9"],
    "answer": 2,
    "explanation": "Add 4 to both sides: $2x = 14$, then divide by 2: $x = 7$."
  },
  {
    "id": "q_rw_example_001",
    "domain": 7,
    "skill": "Boundaries",
    "difficulty": 1,
    "question": "Which choice most effectively combines the two sentences at the underlined portion?\n\nThe experiment was a success. The results confirmed the hypothesis.",
    "passage": "In 2023, researchers at a local university conducted an experiment on plant growth under artificial light. ______ The team published their findings in a peer-reviewed journal.",
    "options": [
      "a success, and the results confirmed the hypothesis,",
      "a success; the results confirmed the hypothesis,",
      "a success, the results confirmed the hypothesis,",
      "a success and the results confirmed the hypothesis"
    ],
    "answer": 1,
    "explanation": "A semicolon correctly joins two independent clauses. Option A creates a comma splice when combined with the next clause. Option C is a comma splice. Option D creates a run-on."
  }
]
```

A sample file with 10 questions is provided at [`scripts/data/questions.example.json`](../scripts/data/questions.example.json).

---

## Importing questions

### 1. Prepare your JSON file

Create a JSON file (array of question objects) following the schema above. Place it anywhere accessible (e.g. `scripts/data/my-questions.json`).

### 2. Run the import script

```bash
npm run import:questions -- --file=scripts/data/my-questions.json
```

Options:

| Flag | Default | Description |
|---|---|---|
| `--file` | *(required)* | Path to the JSON file |
| `--dry-run` | false | Validate and print, don't write to Firestore |
| `--overwrite` | false | Overwrite existing documents with the same ID |
| `--batch-size` | 400 | Firestore writes per batch (max 500) |

### 3. Verify

After import, open the Firebase console → Firestore → `questions` collection to verify.

---

## Authoring tips

- **LaTeX** is rendered via KaTeX. Use `$...$` for inline and `$$...$$` for display math.
- **Images** — upload to Firebase Storage (e.g. `gs://your-project.appspot.com/question-images/`) and paste the download URL. Use a descriptive `image_description` for accessibility.
- **Passages** — put the full passage text in `passage`. It's displayed above the question in a scrollable panel.
- **Open-ended questions** — set `options: null` and `answer` to the expected string (case-insensitive comparison is used during answer checking). Support multiple valid forms with an array: `"answer": ["3", "3.0", "3/1"]`.
- **Difficulty balance** — aim for roughly 30% easy / 50% medium / 20% hard per skill.
