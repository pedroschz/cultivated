import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc,
  setDoc,
  getDocs, 
  collection, 
  writeBatch, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { app, auth } from '../firebaseClient';
import { AdaptiveLearningEngine } from './scoring-engine';
import { 
  AdaptiveLearningData, 
  SubdomainScore, 
  ScoreUpdate,
  QuestionSelectionCriteria,
  DomainScore,
} from '../types/adaptive-learning';
import { Question } from '../types/practice';
import { 
  getSkillMapping, 
  getSubdomainId, 
  getDomainForSkill, 
  getDomainName, 
  DOMAIN_RANGES,
  ALL_SKILLS,
  SkillService
} from './skill-mapping';
import { SCORING_CONSTANTS, DOMAIN_COMPETENCY, ALGORITHM_CONFIG, MASTERY_HISTORY } from './constants';
import { LEARNING_PROFILE_DEFAULTS } from './constants';
import { 
  AdaptiveLearningDatabaseError, 
  AdaptiveLearningDataError, 
  AdaptiveLearningValidationError,
  logAdaptiveLearningError,
  ERROR_CODES 
} from './errors';
import { 
  validateScoreUpdate, 
  validateQuestion, 
  validateUserId, 
  validateSessionLength 
} from './validation';

/**
 * Provides a high-level API for managing adaptive learning functionalities.
 * This service interacts with Firebase to fetch and store user data, uses the
 * AdaptiveLearningEngine to perform calculations, and handles the logic for
 * question selection and user progress tracking.
 */
export class AdaptiveLearningService {
  private engine: AdaptiveLearningEngine;

  constructor() {
    this.engine = new AdaptiveLearningEngine();
  }

  /**
   * Marks a skill as assessed without affecting competency or correctness.
   * This is used for cases like reported/skipped questions, to prevent "megaboost"
   * of completely unseen skills from repeatedly selecting the same skill.
   */
  async markSkillAssessed(userId: string, skill: string): Promise<boolean> {
    if (!app) return false;
    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', userId);

      const adaptiveLearningData = await this.getUserAdaptiveLearningData(userId);
      if (!adaptiveLearningData) return false;

      const mapping = getSkillMapping(skill);
      const subdomainId = mapping ? mapping.subdomainId : skill;

      const current = adaptiveLearningData.subdomainScores[subdomainId] || this.engine.initializeSubdomainScore();
      if (current.totalAttempts === 0) {
        const now = Date.now();
        // Increment attempts to indicate exposure, but do not change correctness or scores
        const updated = { ...current };
        updated.totalAttempts = 1;
        updated.lastPracticed = now;
        updated.lastScoreUpdate = now;
        adaptiveLearningData.subdomainScores[subdomainId] = updated;

        // Recompute summaries (competency unchanged, but keep metadata consistent)
        adaptiveLearningData.domainSummaries = this.recalculateDomainSummaries(adaptiveLearningData.subdomainScores);

        const batch = writeBatch(db);
        batch.update(userRef, { 
          [`adaptiveLearning.subdomainScores.${subdomainId}`]: updated,
          'adaptiveLearning.domainSummaries': adaptiveLearningData.domainSummaries,
          'adaptiveLearning.lastQuestionUpdate': serverTimestamp()
        });
        await batch.commit();
        return true;
      }
      return true;
    } catch (e) {
      console.error('Failed to mark skill assessed:', e);
      return false;
    }
  }

  /**
   * Retrieves a user's adaptive learning data from Firestore.
   * If the user document or the adaptive learning data does not exist,
   * it initializes it with default values.
   * @param userId - The ID of the user.
   * @returns A promise that resolves to the user's adaptive learning data, or null if an error occurs.
   */
  async getUserAdaptiveLearningData(userId: string): Promise<AdaptiveLearningData | null> {
    if (!app) return null;

    try {
      const firestore = getFirestore(app);
      const userRef = doc(firestore, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.log('User document not found, creating minimal user profile...');
        
        // This handles cases where user is authenticated but hasn't completed onboarding
        const newAdaptiveLearningData = this.createInitialAdaptiveLearningData();
        
        try {
          // Use setDoc to create the document (updateDoc requires document to exist)
          await setDoc(userRef, {
            adaptiveLearning: newAdaptiveLearningData,
            createdAt: new Date(),
            lastAccess: new Date()
          });
          
          console.log('Created minimal user profile for adaptive learning');
          return newAdaptiveLearningData;
        } catch (setError: any) {
          // Log the actual error to help debug Firebase rules issues
          console.error('Error creating user document (check Firebase rules):', {
            error: setError,
            code: setError?.code,
            message: setError?.message,
            userId
          });
          // If setDoc fails, the user likely needs to complete onboarding or there's a permissions issue
          console.log('User needs to complete onboarding - cannot create adaptive learning data');
          return null;
        }
      }

      const userData = userDoc.data();

      // Check if user has adaptive learning data
      if (userData.adaptiveLearning?.algorithmVersion) {
        const data = userData.adaptiveLearning as AdaptiveLearningData;
        // Ensure masteryHistory exists for older users and fill gaps up to today
        const dbDataChanged = await this.ensureSnapshotsUpToToday(userId, data);
        if (dbDataChanged) {
          // refetch to return persisted version
          const refreshedDoc = await getDoc(userRef);
          return refreshedDoc.data()?.adaptiveLearning as AdaptiveLearningData;
        }
        return data;
      }

      // If user document exists but no adaptive learning data, create it
      console.log('Creating new adaptive learning data for existing user...');
      const newAdaptiveLearningData = this.createInitialAdaptiveLearningData();
      
      await updateDoc(userRef, {
        adaptiveLearning: newAdaptiveLearningData
      });

      return newAdaptiveLearningData;
    } catch (error: any) {
      // Enhanced error logging to help debug Firebase rules issues
      console.error('Error getting adaptive learning data:', {
        error,
        code: error?.code,
        message: error?.message,
        userId,
        firebaseError: error?.code === 'permission-denied' ? 'Check Firebase security rules for users collection' : undefined
      });
      return null;
    }
  }

  /**
   * Updates a user's score based on their answer to a question.
   * It recalculates subdomain scores, domain summaries, and overall competency.
   * @param userId - The ID of the user.
   * @param questionId - The ID of the question answered.
   * @param question - The question object.
   * @param isCorrect - Whether the user's answer was correct.
   * @param timeSpent - The time in seconds spent on the question.
   * @returns A promise that resolves to true if the update was successful, false otherwise.
   */
  async updateUserScore(
    userId: string,
    questionId: string,
    question: Question,
    isCorrect: boolean,
    timeSpent: number
  ): Promise<boolean> {
    if (!app) return false;

    try {
      // Validate inputs first
      validateUserId(userId);
      if (!question.id) {
        throw new AdaptiveLearningValidationError('Question ID is required', 'questionId', question.id);
      }
      validateQuestion(question);
      
      const db = getFirestore(app);
      const userRef = doc(db, 'users', userId);
      
      const adaptiveLearningData = await this.getUserAdaptiveLearningData(userId);
      if (!adaptiveLearningData) {
        throw new AdaptiveLearningDataError(
          'No adaptive learning data found for user',
          userId,
          'adaptiveLearning'
        );
      }

      // Map question to skill-based subdomain ID
      let subdomainId: string;
      
      if (question.skill) {
        const skillMapping = getSkillMapping(question.skill);
        subdomainId = skillMapping ? skillMapping.subdomainId : question.skill;
      } else {
        // Fallback for older questions without a skill property
        const domainRange = DOMAIN_RANGES[question.domain.toString() as keyof typeof DOMAIN_RANGES];
        subdomainId = domainRange ? domainRange[0].toString() : '0';
      }

      const scoreUpdate: ScoreUpdate = {
        subdomainId,
        questionId,
        isCorrect,
        timeSpent,
        difficulty: question.difficulty,
        timestamp: Date.now()
      };
      
      // Validate the score update
      validateScoreUpdate(scoreUpdate);

      const currentSubdomainScore = adaptiveLearningData.subdomainScores[scoreUpdate.subdomainId] || 
        this.engine.initializeSubdomainScore();

      const updatedSubdomainScore = this.engine.updateSubdomainScore(currentSubdomainScore, scoreUpdate);
      
      adaptiveLearningData.subdomainScores[scoreUpdate.subdomainId] = updatedSubdomainScore;
      adaptiveLearningData.lastQuestionUpdate = Date.now();
      // We'll persist totalQuestionsAnswered via Firestore increment for atomicity
      adaptiveLearningData.totalTimeSpent += timeSpent;

      // Recalculate domain-specific scores and set overall as mean(Math, R&W)
      adaptiveLearningData.domainSummaries = this.recalculateDomainSummaries(adaptiveLearningData.subdomainScores);

      // Periodically update the user's learning profile (use next total since we persist increment below)
      const nextTotalQuestionsAnswered = (adaptiveLearningData.totalQuestionsAnswered || 0) + 1;
      if (nextTotalQuestionsAnswered % ALGORITHM_CONFIG.UPDATE_LEARNING_PROFILE_INTERVAL === 0) {
        adaptiveLearningData.learningProfile = this.updateLearningProfile(
          adaptiveLearningData.learningProfile,
          adaptiveLearningData.subdomainScores
        );
      }

      // Update daily mastery history snapshot for trend charts and per-subject study time
      const today = this.getIsoDateString(new Date());
      const summaries = adaptiveLearningData.domainSummaries;
      const mathDomains = DOMAIN_COMPETENCY.MATH_DOMAINS;
      const rwDomains = DOMAIN_COMPETENCY.READING_WRITING_DOMAINS;
      const mathValues = mathDomains
        .filter((id) => summaries[id])
        .map((id) => summaries[id].averageCompetency);
      const rwValues = rwDomains
        .filter((id) => summaries[id])
        .map((id) => summaries[id].averageCompetency);
      const mathAvg = mathValues.length > 0 ? mathValues.reduce((a,b)=>a+b,0) / mathValues.length : 0;
      const rwAvg = rwValues.length > 0 ? rwValues.reduce((a,b)=>a+b,0) / rwValues.length : 0;
      // Set overall competency explicitly as the mean of Math and R&W domain averages
      if (mathValues.length > 0 || rwValues.length > 0) {
        const parts = [] as number[];
        if (mathValues.length > 0) parts.push(mathAvg);
        if (rwValues.length > 0) parts.push(rwAvg);
        adaptiveLearningData.overallCompetency = parts.length > 0 ? (parts.reduce((a,b)=>a+b,0) / parts.length) : 0;
      }

      if (!adaptiveLearningData.masteryHistory) {
        adaptiveLearningData.masteryHistory = [];
      }
      const existingIdx = adaptiveLearningData.masteryHistory.findIndex((e) => e.date === today);
      const domainCompetency: { [domainId: string]: number } = {};
      Object.keys(summaries).forEach((k) => {
        domainCompetency[k] = summaries[k].averageCompetency;
      });
      // Determine subject domain for time attribution
      let domainNumber: number | null = null;
      if ((question as any).skill) {
        domainNumber = getDomainForSkill((question as any).skill);
      }
      if (domainNumber === null || typeof domainNumber !== 'number' || Number.isNaN(domainNumber)) {
        if (typeof (question as any).domain === 'number' && !Number.isNaN((question as any).domain)) {
          domainNumber = (question as any).domain as number;
        }
      }

      const isMath = typeof domainNumber === 'number' ? (domainNumber >= 0 && domainNumber <= 3) : false;

      const existingEntry = existingIdx >= 0 ? (adaptiveLearningData.masteryHistory as any)[existingIdx] : null;
      const prevMathSec = existingEntry?.secondsStudiedMath || 0;
      const prevRwSec = existingEntry?.secondsStudiedReadingWriting || 0;

      const snapshot = {
        date: today,
        overall: adaptiveLearningData.overallCompetency,
        math: mathAvg,
        readingWriting: rwAvg,
        domainCompetency,
        secondsStudiedMath: (isMath ? prevMathSec + timeSpent : prevMathSec),
        secondsStudiedReadingWriting: (!isMath ? prevRwSec + timeSpent : prevRwSec),
      };
      if (existingIdx >= 0) {
        adaptiveLearningData.masteryHistory[existingIdx] = snapshot;
      } else {
        adaptiveLearningData.masteryHistory.push(snapshot);
      }
      // Keep an all-time history up to a large cap to bound document size
      adaptiveLearningData.masteryHistory = this.keepLastNDays(
        adaptiveLearningData.masteryHistory,
        MASTERY_HISTORY.MAX_DAYS_TO_KEEP
      );

      // Use batch operations for efficient database writes
      const batch = writeBatch(db);
      
      // Update only the changed fields instead of the entire document
      batch.update(userRef, {
        lastPracticeAt: serverTimestamp(),
        [`adaptiveLearning.subdomainScores.${scoreUpdate.subdomainId}`]: updatedSubdomainScore,
        'adaptiveLearning.domainSummaries': adaptiveLearningData.domainSummaries,
        'adaptiveLearning.overallCompetency': adaptiveLearningData.overallCompetency,
        'adaptiveLearning.lastQuestionUpdate': serverTimestamp(),
        'adaptiveLearning.totalQuestionsAnswered': increment(1),
        'adaptiveLearning.totalTimeSpent': increment(timeSpent),
        'adaptiveLearning.masteryHistory': adaptiveLearningData.masteryHistory
      });
      
      // Include learning profile update if it was modified
      if (nextTotalQuestionsAnswered % ALGORITHM_CONFIG.UPDATE_LEARNING_PROFILE_INTERVAL === 0) {
        batch.update(userRef, {
          'adaptiveLearning.learningProfile': adaptiveLearningData.learningProfile
        });
      }
      
      await batch.commit();

      // Debug: Log attempts and updated priority for the subdomain just updated (only in development)
      if (process.env.NODE_ENV === 'development') {
        try {
          const decayed = this.engine.applyTimeDecay(updatedSubdomainScore);
          const basePriority = this.engine.calculateSubdomainPriority(decayed);
          console.log('[Adaptive] Updated subdomain:', {
            subdomainId: scoreUpdate.subdomainId,
            attempts: updatedSubdomainScore.totalAttempts,
            competency: Number(decayed?.competencyScore)?.toFixed?.(2),
            confidence: Number(decayed?.confidenceLevel)?.toFixed?.(2),
            basePriority: Number.isFinite(basePriority) ? Number(basePriority.toFixed(2)) : basePriority,
          });
        } catch (debugError) {
          logAdaptiveLearningError(debugError, 'debugLogging');
        }
      }

      console.log(`Updated adaptive learning score for user ${userId}, subdomain ${scoreUpdate.subdomainId}`);
      return true;

    } catch (error) {
      logAdaptiveLearningError(error, 'updateUserScore');
      
      if (error instanceof AdaptiveLearningValidationError || 
          error instanceof AdaptiveLearningDataError) {
        throw error; // Re-throw validation and data errors
      }
      
      // Wrap other errors as database errors
      const originalMessage = error instanceof Error ? error.message : String(error);
      throw new AdaptiveLearningDatabaseError(
        'Failed to update user score in database',
        'updateUserScore',
        userId,
        { questionId, isCorrect, timeSpent, originalError: originalMessage }
      );
    }
  }

  /**
   * Selects an optimized list of questions for a practice session.
   * It uses the adaptive learning engine to generate criteria based on the user's
   * current learning profile and then selects questions that match these criteria.
   * @param userId - The ID of the user.
   * @param sessionLength - The desired number of questions in the session.
   * @param availableQuestions - A list of all available questions.
   * @returns A promise that resolves to an array of selected questions.
   */
  async getOptimizedQuestionSelection(
    userId: string,
    sessionLength: number = 10,
    availableQuestions: Question[]
  ): Promise<Question[]> {
    // Validate inputs
    validateUserId(userId);
    validateSessionLength(sessionLength);
    
    if (!Array.isArray(availableQuestions) || availableQuestions.length === 0) {
      throw new AdaptiveLearningValidationError(
        'availableQuestions must be a non-empty array',
        'availableQuestions',
        availableQuestions,
        { code: ERROR_CODES.NO_QUESTIONS_AVAILABLE }
      );
    }
    
    try {
      const adaptiveLearningData = await this.getUserAdaptiveLearningData(userId);
      if (!adaptiveLearningData) {
        console.log('No adaptive learning data found, using random selection');
        return this.getRandomQuestions(availableQuestions, sessionLength);
      }

      const criteria = this.engine.generateQuestionSelectionCriteria(adaptiveLearningData, ALL_SKILLS.length);
      
      const selectedQuestions: Question[] = [];
      const usedQuestionIds = new Set<string>();

      // Subject-scoped allowed skills: include ALL skills for the subject(s) present in the pool
      const allowedDomains = new Set<number>();
      for (const q of availableQuestions) {
        // Safely extract domain without type casting
        if (typeof q.domain === 'number' && !Number.isNaN(q.domain)) {
          allowedDomains.add(q.domain);
        }
      }
      const allowedSkills = new Set<string>();
      for (const d of allowedDomains) {
        const skills = SkillService.getSkillsForDomain(d);
        for (const s of skills) allowedSkills.add(s.skill);
      }

      // Convert engine criteria to skill-based and restrict to allowed subject skills
      type SkillCriterion = { skill: string; difficulty: number; priority: number };
      const skillCriteria: SkillCriterion[] = criteria
        .map((c) => {
          const m = SkillService.getBySubdomainId(c.subdomainId);
          const skill = m ? m.skill : undefined;
          return skill ? { skill, difficulty: c.difficulty, priority: c.priority } : null;
        })
        .filter((v): v is SkillCriterion => !!v)
        .filter((c) => allowedSkills.has(c.skill));

      // Debug: Subject-wide effective priorities (before filtering to allowed skills)
      try {
        const effectiveAll = new Map<string, { skill: string; subdomainId: string | null; difficulty: number; priority: number }>();
        for (const c of criteria) {
          const m = SkillService.getBySubdomainId(c.subdomainId);
          const skill = m ? m.skill : undefined;
          if (!skill) continue;
          const prev = effectiveAll.get(skill);
          if (!prev || c.priority > prev.priority) {
            effectiveAll.set(skill, {
              skill,
              subdomainId: c.subdomainId,
              difficulty: c.difficulty,
              priority: c.priority,
            });
          }
        }
        const listAll = Array.from(effectiveAll.values()).sort((a, b) => b.priority - a.priority);
        console.log('[Adaptive] Full skill priorities (effective, subject-wide):', listAll.map((x) => ({
          skill: x.skill,
          subdomainId: x.subdomainId,
          difficulty: x.difficulty,
          priority: Number.isFinite(x.priority) ? Number(x.priority.toFixed(2)) : x.priority,
        })));
      } catch {}

      // Reorder criteria: at most one megaboosted (attempts=0) first, then the rest by priority
      const attemptsBySub = adaptiveLearningData.subdomainScores;
      const isUnassessed = (skill: string) => {
        const subId = getSkillMapping(skill)?.subdomainId;
        return subId ? ((attemptsBySub[subId]?.totalAttempts || 0) === 0) : false;
      };

      const firstMegaboost = skillCriteria.find((c) => isUnassessed(c.skill));
      const reordered: SkillCriterion[] = [];
      if (firstMegaboost) reordered.push(firstMegaboost);

      for (const c of skillCriteria) {
        if (!reordered.some((r) => r.skill === c.skill && r.difficulty === c.difficulty)) {
          reordered.push(c);
        }
      }

      // Ensure final iteration order follows descending priority (except megaboost, which stays first)
      const megaboost = reordered.length > 0 && isUnassessed(reordered[0].skill) ? reordered[0] : null;
      const tail = megaboost ? reordered.slice(1) : reordered;
      tail.sort((a, b) => b.priority - a.priority);
      const finalOrdered: SkillCriterion[] = megaboost ? [megaboost, ...tail] : tail;

      // Debug: Log effective priorities per skill (after reordering) scoped to allowed skills
      try {
        const effectiveBySkill = new Map<string, { skill: string; subdomainId: string | null; difficulty: number; priority: number }>();
        for (const c of reordered) {
          const mapping = SkillService.getBySkillName(c.skill);
          const subId = mapping ? mapping.subdomainId : null;
          const prev = effectiveBySkill.get(c.skill);
          if (!prev || c.priority > prev.priority) {
            effectiveBySkill.set(c.skill, { skill: c.skill, subdomainId: subId, difficulty: c.difficulty, priority: c.priority });
          }
        }
        const list = Array.from(effectiveBySkill.values()).sort((a, b) => b.priority - a.priority);
        console.log('[Adaptive] Skill priorities (effective) for current selection:', list.map((x) => ({
          skill: x.skill,
          subdomainId: x.subdomainId,
          difficulty: x.difficulty,
          priority: Number.isFinite(x.priority) ? Number(x.priority.toFixed(2)) : x.priority,
        })));
      } catch {}

      // Phase 2 optimization indexes
      const questionsBySkill = new Map<string, Question[]>();
      const questionsBySkillAndDifficulty = new Map<string, Question[]>(); // key: `${skill}|${difficulty}`
      for (const q of availableQuestions) {
        if (!q.skill || !allowedSkills.has(q.skill)) continue;
        const list = questionsBySkill.get(q.skill) || [];
        list.push(q);
        questionsBySkill.set(q.skill, list);
        const k = `${q.skill}|${q.difficulty}`;
        const list2 = questionsBySkillAndDifficulty.get(k) || [];
        list2.push(q);
        questionsBySkillAndDifficulty.set(k, list2);
      }

      const takeNextUnused = (arr: Question[] | undefined): Question | null => {
        if (!arr || arr.length === 0) return null;
        // Randomize among equal-condition candidates by selecting a random unused one
        const pool: Question[] = [];
        for (let i = 0; i < arr.length; i++) {
          const candidate = arr[i];
          if (!usedQuestionIds.has(candidate.id)) pool.push(candidate);
        }
        if (pool.length === 0) return null;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        usedQuestionIds.add(chosen.id);
        return chosen;
      };

      // Pass 1: exact match by skill + difficulty using indexes
      for (const c of finalOrdered) {
        if (selectedQuestions.length >= sessionLength) break;
        const key = `${c.skill}|${c.difficulty}`;
        const chosen = takeNextUnused(questionsBySkillAndDifficulty.get(key));
        if (chosen) selectedQuestions.push(chosen);
      }

      // Pass 2: Relax difficulty but do not allow easier than the target difficulty for that skill.
      // If no eligible question exists for a skill at difficulty >= target, try the next skill by priority.
      if (selectedQuestions.length < sessionLength) {
        for (const c of finalOrdered) {
          if (selectedQuestions.length >= sessionLength) break;
          const pool = (questionsBySkill.get(c.skill) || []).filter((q) => !usedQuestionIds.has(q.id) && q.difficulty >= c.difficulty);
          if (pool.length > 0) {
            const chosen = pool[Math.floor(Math.random() * pool.length)];
            selectedQuestions.push(chosen);
            usedQuestionIds.add(chosen.id);
          } else {
            // Try exact match of the next skill(s) by priority until we fill or exhaust
            continue;
          }
        }
        // After attempting all skills with relaxed constraint, try exact matches for remaining slots by scanning again
        if (selectedQuestions.length < sessionLength) {
          for (const c of finalOrdered) {
            if (selectedQuestions.length >= sessionLength) break;
            const key = `${c.skill}|${c.difficulty}`;
            const chosen = takeNextUnused(questionsBySkillAndDifficulty.get(key));
            if (chosen) selectedQuestions.push(chosen);
          }
        }
      }

      // Fill remaining slots from allowed skills (randomized order)
      if (selectedQuestions.length < sessionLength) {
        const remaining: Question[] = [];
        for (const list of questionsBySkill.values()) {
          for (const q of list) {
            if (!usedQuestionIds.has(q.id)) remaining.push(q);
          }
        }
        // Shuffle remaining randomly
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        for (const q of remaining) {
          if (selectedQuestions.length >= sessionLength) break;
          selectedQuestions.push(q);
          usedQuestionIds.add(q.id);
        }
      }

      // For debugging: print current allowed skills snapshot
      try {
        console.log('Allowed skills for subject scope:', Array.from(allowedSkills).sort());
      } catch {}

      console.log(`Selected ${selectedQuestions.length} optimized questions for user ${userId}`);
      return selectedQuestions;

    } catch (error: any) {
      // Enhanced error logging to help debug Firebase rules issues
      const errorDetails = {
        error,
        code: error?.code,
        message: error?.message,
        userId,
        sessionLength,
        availableQuestionsCount: availableQuestions.length,
        firebasePermissionError: error?.code === 'permission-denied' ? 'Check Firebase security rules for users collection' : undefined
      };
      
      console.error('[Adaptive Learning] Error in getOptimizedQuestionSelection:', errorDetails);
      logAdaptiveLearningError(error, 'getOptimizedQuestionSelection');
      
      if (error instanceof AdaptiveLearningValidationError) {
        throw error; // Re-throw validation errors
      }
      
      // Fallback to random selection for other errors
      console.log(`Falling back to random question selection for user ${userId}`);
      return this.getRandomQuestions(availableQuestions, sessionLength);
    }
  }

  /**
   * Provides insights into a user's learning progress, including their
   * strengths, weaknesses, and areas for improvement.
   * @param userId - The ID of the user.
   * @returns A promise that resolves to an object containing learning insights.
   */
  async getLearningInsights(userId: string): Promise<{
    strengths: Array<{ subdomainId: string; subdomainName: string; score: number }>;
    weaknesses: Array<{ subdomainId: string; subdomainName: string; score: number }>;
    improvementAreas: Array<{ subdomainId: string; subdomainName: string; reason: string }>;
  }> {
    const adaptiveLearningData = await this.getUserAdaptiveLearningData(userId);
    
    if (!adaptiveLearningData) {
      return { strengths: [], weaknesses: [], improvementAreas: [] };
    }

    const subdomainEntries = Object.entries(adaptiveLearningData.subdomainScores);
    
    const strengths = subdomainEntries
      .filter(([_, score]) => score.competencyScore > SCORING_CONSTANTS.PROFICIENT_MAX)
      .sort((a, b) => b[1].competencyScore - a[1].competencyScore)
      .slice(0, 5)
      .map(([subdomainId, score]) => ({
        subdomainId,
        subdomainName: this.getSubdomainName(subdomainId),
        score: score.competencyScore
      }));

    const weaknesses = subdomainEntries
      .filter(([_, score]) => score.competencyScore < SCORING_CONSTANTS.DEVELOPING_MAX)
      .sort((a, b) => a[1].competencyScore - b[1].competencyScore)
      .slice(0, 5)
      .map(([subdomainId, score]) => ({
        subdomainId,
        subdomainName: this.getSubdomainName(subdomainId),
        score: score.competencyScore
      }));

    const improvementAreas = subdomainEntries
      .filter(([_, score]) => 
        score.needsReinforcement || 
        score.recentStreak < SCORING_CONSTANTS.NEGATIVE_STREAK_THRESHOLD || 
        score.competencyScore < SCORING_CONSTANTS.INITIAL_COMPETENCY
      )
      .map(([subdomainId, score]) => ({
        subdomainId,
        subdomainName: this.getSubdomainName(subdomainId),
        reason: this.getImprovementReason(score)
      }))
      .slice(0, 5);

    return { strengths, weaknesses, improvementAreas };
  }

  /**
   * Creates the initial data structure for a user's adaptive learning profile.
   * This is used when a new user signs up or when an existing user's data is missing.
   * @returns The initial adaptive learning data object.
   */
  private createInitialAdaptiveLearningData(): AdaptiveLearningData {
    const subdomainScores: { [subdomainId: string]: SubdomainScore } = {};
    
    ALL_SKILLS.forEach(skill => {
      subdomainScores[skill.subdomainId] = this.engine.initializeSubdomainScore();
    });

    const domainSummaries = this.recalculateDomainSummaries(subdomainScores);

    const learningProfile = {
      learningVelocity: LEARNING_PROFILE_DEFAULTS.LEARNING_VELOCITY,
      retentionRate: LEARNING_PROFILE_DEFAULTS.RETENTION_RATE,
      consistencyScore: LEARNING_PROFILE_DEFAULTS.CONSISTENCY_SCORE,
      sessionOptimalLength: LEARNING_PROFILE_DEFAULTS.SESSION_OPTIMAL_LENGTH,
      averageSessionLength: LEARNING_PROFILE_DEFAULTS.AVERAGE_SESSION_LENGTH,
      preferredDifficultyProgression: LEARNING_PROFILE_DEFAULTS.PREFERRED_DIFFICULTY_PROGRESSION,
      prioritySubdomains: [],
      strongSubdomains: []
    };

    const adaptive: AdaptiveLearningData = {
      subdomainScores,
      domainSummaries,
      learningProfile,
      overallCompetency: SCORING_CONSTANTS.INITIAL_COMPETENCY,
      totalQuestionsAnswered: 0,
      totalTimeSpent: 0,
      algorithmVersion: ALGORITHM_CONFIG.VERSION,
      lastFullUpdate: Date.now(),
      lastQuestionUpdate: Date.now(),
      questionQueue: [],
      masteryHistory: []
    };

    // Seed today's snapshot so dashboard renders immediately
    const today = this.getIsoDateString(new Date());
    const mathDomains = DOMAIN_COMPETENCY.MATH_DOMAINS;
    const rwDomains = DOMAIN_COMPETENCY.READING_WRITING_DOMAINS;
    const mathValues = mathDomains
      .filter((id) => (domainSummaries as any)[id])
      .map((id) => (domainSummaries as any)[id].averageCompetency);
    const rwValues = rwDomains
      .filter((id) => (domainSummaries as any)[id])
      .map((id) => (domainSummaries as any)[id].averageCompetency);
      const mathAvg = mathValues.length > 0 ? mathValues.reduce((a,b)=>a+b,0) / mathValues.length : 0;
      const rwAvg = rwValues.length > 0 ? rwValues.reduce((a,b)=>a+b,0) / rwValues.length : 0;
      const overallFromDomains = (() => {
        const parts = [] as number[];
        if (mathValues.length > 0) parts.push(mathAvg);
        if (rwValues.length > 0) parts.push(rwAvg);
        return parts.length > 0 ? (parts.reduce((a,b)=>a+b,0) / parts.length) : adaptive.overallCompetency;
      })();
    const domainCompetency: { [domainId: string]: number } = {};
    Object.keys(domainSummaries).forEach((k) => {
      domainCompetency[k] = (domainSummaries as any)[k].averageCompetency;
    });
      adaptive.masteryHistory!.push({
      date: today,
        overall: Math.round(overallFromDomains),
      math: Math.round(mathAvg),
      readingWriting: Math.round(rwAvg),
      domainCompetency,
      secondsStudiedMath: 0,
      secondsStudiedReadingWriting: 0,
    });

    return adaptive;
  }

  /**
   * Selects a specified number of random questions from the available list.
   * @param availableQuestions - The list of questions to choose from.
   * @param count - The number of random questions to select.
   * @returns An array of randomly selected questions.
   */
  private getRandomQuestions(availableQuestions: Question[], count: number): Question[] {
    const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Recalculates the summary statistics for each domain based on the latest subdomain scores.
   * @param subdomainScores - The current scores for all subdomains.
   * @returns An object containing the recalculated domain summaries.
   */
  private recalculateDomainSummaries(subdomainScores: { [key: string]: SubdomainScore }): { [domainId: string]: DomainScore } {
    const domains: { [domainId: string]: DomainScore } = {};
    
    Object.entries(DOMAIN_RANGES).forEach(([domainId, range]) => {
      const [start, end] = range;
      let totalCompetency = 0;
      let count = 0;
      const relevantSubdomains: { [key: string]: SubdomainScore } = {};

      for (let i = start; i <= end; i++) {
        const subdomainId = i.toString();
        if (subdomainScores[subdomainId]) {
          relevantSubdomains[subdomainId] = subdomainScores[subdomainId];
          totalCompetency += subdomainScores[subdomainId].competencyScore;
          count++;
        }
      }

      domains[domainId] = {
        domainId: parseInt(domainId, 10),
        averageCompetency: count > 0 ? totalCompetency / count : 0,
        subdomainScores: relevantSubdomains,
        lastUpdated: Date.now()
      };
    });

    return domains;
  }

  /**
   * Updates the user's learning profile based on their performance.
   * @param currentProfile - The user's current learning profile.
   * @param subdomainScores - The current scores for all subdomains.
   * @returns The updated learning profile.
   */
  private updateLearningProfile(currentProfile: any, subdomainScores: { [key: string]: SubdomainScore }) {
    const scores = Object.values(subdomainScores);
    
    const avgImprovementRate = scores.reduce((sum, score) => sum + score.improvementRate, 0) / scores.length;
    currentProfile.learningVelocity = Math.max(1, Math.min(10, avgImprovementRate + 5));

    currentProfile.prioritySubdomains = Object.entries(subdomainScores)
      .filter(([_, score]) => score.competencyScore < SCORING_CONSTANTS.DEVELOPING_MAX)
      .sort((a, b) => a[1].competencyScore - b[1].competencyScore)
      .slice(0, 5)
      .map(([subdomainId]) => subdomainId);

    currentProfile.strongSubdomains = Object.entries(subdomainScores)
      .filter(([_, score]) => score.competencyScore > SCORING_CONSTANTS.PROFICIENT_MAX)
      .sort((a, b) => b[1].competencyScore - a[1].competencyScore)
      .slice(0, 5)
      .map(([subdomainId]) => subdomainId);

    return currentProfile;
  }

  /** Formats a Date as YYYY-MM-DD in local time. */
  private getIsoDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Returns only entries from the last N days, inclusive of today. */
  private keepLastNDays<T extends { date: string }>(entries: T[], nDays: number): T[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (nDays - 1));
    const cutoffStr = this.getIsoDateString(cutoff);
    return entries
      .filter((e) => e.date >= cutoffStr)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  /**
   * One-time backfill from the user's granular answer history to masteryHistory.
   * This computes a daily snapshot for each day since the first history entry
   * up to today. Days without practice still receive a snapshot by carrying
   * forward the last known values.
   */
  async backfillMasteryHistory(userId: string): Promise<boolean> {
    if (!app) return false;
    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) return false;

      const userData = userDoc.data();
      const adaptiveLearning: AdaptiveLearningData | undefined = userData.adaptiveLearning;
      if (!adaptiveLearning) return false;

      if (adaptiveLearning.masteryHistoryBackfilled) return true;

      // Prepare a fresh working copy of subdomain scores from a neutral baseline
      const subdomainScores: { [key: string]: SubdomainScore } = {};
      ALL_SKILLS.forEach((skill) => {
        subdomainScores[skill.subdomainId] = this.engine.initializeSubdomainScore();
      });

      // Build chronological map of answers by day
      const answers: Array<{ questionId: string; correct: boolean; timeSpent: number; answeredAt: string }>
        = (userData.history || []).map((h: any) => ({
          questionId: h.questionId,
          correct: !!h.correct,
          timeSpent: Number(h.timeSpent || 0),
          answeredAt: typeof h.answeredAt === 'string' ? h.answeredAt : (h.answeredAt?.toDate?.() ? h.answeredAt.toDate().toISOString() : new Date().toISOString())
        }));

      answers.sort((a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime());
      if (answers.length === 0) {
        // Nothing to backfill; just mark as backfilled
        await updateDoc(userRef, { 'adaptiveLearning.masteryHistoryBackfilled': true });
        return true;
      }

      const firstDate = new Date(answers[0].answeredAt);
      const today = new Date();
      const engine = this.engine;

      // Helper to compute metrics and push snapshot for a given date
      let daySecondsMath = 0;
      let daySecondsRw = 0;
      const pushSnapshot = () => {
        const { domainSummaries, overallCompetency } = engine.recalculateOverallMetrics(subdomainScores);
        const mathDomains = DOMAIN_COMPETENCY.MATH_DOMAINS;
        const rwDomains = DOMAIN_COMPETENCY.READING_WRITING_DOMAINS;
        const mathValues = mathDomains.filter((id) => domainSummaries[id]).map((id) => domainSummaries[id].averageCompetency);
        const rwValues = rwDomains.filter((id) => domainSummaries[id]).map((id) => domainSummaries[id].averageCompetency);
        const mathAvg = mathValues.length > 0 ? mathValues.reduce((a,b)=>a+b,0) / mathValues.length : 0;
        const rwAvg = rwValues.length > 0 ? rwValues.reduce((a,b)=>a+b,0) / rwValues.length : 0;
        const overallFromDomains = (() => {
          const parts = [] as number[];
          if (mathValues.length > 0) parts.push(mathAvg);
          if (rwValues.length > 0) parts.push(rwAvg);
          return parts.length > 0 ? (parts.reduce((a,b)=>a+b,0) / parts.length) : overallCompetency;
        })();

        const dateIso = this.getIsoDateString(currentDate);
        const existingIdx = (adaptiveLearning.masteryHistory || []).findIndex((e) => e.date === dateIso);
        const domainCompetency: { [domainId: string]: number } = {};
        Object.keys(domainSummaries).forEach((k) => {
          domainCompetency[k] = domainSummaries[k].averageCompetency;
        });
        const snapshot = {
          date: dateIso,
          overall: overallFromDomains,
          math: mathAvg,
          readingWriting: rwAvg,
          domainCompetency,
          secondsStudiedMath: daySecondsMath,
          secondsStudiedReadingWriting: daySecondsRw,
        };
        if (!adaptiveLearning.masteryHistory) adaptiveLearning.masteryHistory = [];
        if (existingIdx >= 0) adaptiveLearning.masteryHistory[existingIdx] = snapshot; else adaptiveLearning.masteryHistory.push(snapshot);
      };

      let currentDate = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());

      // Index answers by day for efficient processing
      const byDay: Record<string, Array<typeof answers[number]>> = {};
      answers.forEach((a) => {
        const d = new Date(a.answeredAt);
        const iso = this.getIsoDateString(d);
        if (!byDay[iso]) byDay[iso] = [];
        byDay[iso].push(a);
      });

      // Fetch questions once to resolve subdomain and difficulty
      const firestore2 = getFirestore(app);
      const questionsSnap = await getDocs(collection(firestore2, 'questions'));
      const questionMap = new Map<string, Question>();
      questionsSnap.docs.forEach((d) => {
        const q = { id: d.id, ...(d.data() as any) } as Question;
        questionMap.set(q.id, q);
      });

      // Walk day-by-day; on days with answers, apply them; otherwise just carry forward values
      while (currentDate <= today) {
        const iso = this.getIsoDateString(currentDate);
        const todaysAnswers = byDay[iso] || [];
        daySecondsMath = 0;
        daySecondsRw = 0;
        if (todaysAnswers.length > 0) {
          for (const ans of todaysAnswers) {
            const question = questionMap.get(ans.questionId);
            if (!question) continue;
            let subdomainId: string;
            if ((question as any).skill) {
              const mapping = getSkillMapping((question as any).skill);
              subdomainId = mapping ? mapping.subdomainId : (question as any).skill;
            } else {
              const domainRange = DOMAIN_RANGES[(question as any).domain?.toString() as keyof typeof DOMAIN_RANGES];
              subdomainId = domainRange ? domainRange[0].toString() : '0';
            }

            const currentScore = subdomainScores[subdomainId] || this.engine.initializeSubdomainScore();
            const update = {
              questionId: ans.questionId,
              subdomainId,
              isCorrect: ans.correct,
              timeSpent: ans.timeSpent,
              difficulty: (question as any).difficulty,
              timestamp: new Date(iso).getTime() + 12 * 60 * 60 * 1000 // midday of the day
            } as any;
            subdomainScores[subdomainId] = this.engine.updateSubdomainScore(currentScore, update);

            // Attribute time to subject bucket
            let dNum: number | null = null;
            if ((question as any).skill) {
              dNum = getDomainForSkill((question as any).skill);
            }
            if (dNum === null || typeof dNum !== 'number' || Number.isNaN(dNum)) {
              if (typeof (question as any).domain === 'number' && !Number.isNaN((question as any).domain)) {
                dNum = (question as any).domain as number;
              }
            }
            const isMathDay = typeof dNum === 'number' ? (dNum >= 0 && dNum <= 3) : false;
            if (isMathDay) daySecondsMath += Number(ans.timeSpent || 0); else daySecondsRw += Number(ans.timeSpent || 0);
          }
        }
        // Regardless of activity, record the snapshot for this day
        pushSnapshot();
        currentDate.setDate(currentDate.getDate() - 0 + 1);
      }

      // Trim and mark backfilled
      adaptiveLearning.masteryHistory = this.keepLastNDays(
        adaptiveLearning.masteryHistory || [], 
        MASTERY_HISTORY.MAX_DAYS_TO_KEEP
      );
      adaptiveLearning.masteryHistoryBackfilled = true;
      await updateDoc(userRef, { adaptiveLearning });
      return true;
    } catch (e) {
      console.error('Error backfilling mastery history:', e);
      return false;
    }
  }

  /** Ensures masteryHistory has an entry for each day up to today by carrying forward last values. */
  private async ensureSnapshotsUpToToday(userId: string, data: AdaptiveLearningData): Promise<boolean> {
    let changed = false;
    if (!data.masteryHistory) {
      data.masteryHistory = [];
      changed = true;
    }
    const todayIso = this.getIsoDateString(new Date());
      if (data.masteryHistory.length === 0) {
      // Seed today from current summaries
      const summaries = data.domainSummaries;
      const mathDomains = DOMAIN_COMPETENCY.MATH_DOMAINS;
      const rwDomains = DOMAIN_COMPETENCY.READING_WRITING_DOMAINS;
      const mathValues = mathDomains.filter((id) => (summaries as any)[id]).map((id) => (summaries as any)[id].averageCompetency);
      const rwValues = rwDomains.filter((id) => (summaries as any)[id]).map((id) => (summaries as any)[id].averageCompetency);
      const mathAvg = mathValues.length > 0 ? mathValues.reduce((a,b)=>a+b,0) / mathValues.length : 0;
      const rwAvg = rwValues.length > 0 ? rwValues.reduce((a,b)=>a+b,0) / rwValues.length : 0;
      const domainCompetency: { [domainId: string]: number } = {};
      Object.keys(summaries).forEach((k) => {
        domainCompetency[k] = (summaries as any)[k].averageCompetency;
      });
        data.masteryHistory.push({
        date: todayIso,
        overall: Math.round(data.overallCompetency),
        math: Math.round(mathAvg),
        readingWriting: Math.round(rwAvg),
          domainCompetency,
          secondsStudiedMath: 0,
          secondsStudiedReadingWriting: 0,
      });
      changed = true;
    } else {
      const last = data.masteryHistory[data.masteryHistory.length - 1];
      let cursor = new Date(last.date);
      const lastIso = this.getIsoDateString(cursor);

      // Fill missing days up to yesterday by carrying forward last known values
      if (lastIso < todayIso) {
        while (true) {
          const next = new Date(cursor);
          next.setDate(cursor.getDate() + 1);
          const nextIso = this.getIsoDateString(next);
          if (nextIso >= todayIso) break;
          data.masteryHistory.push({
            date: nextIso,
            overall: last.overall,
            math: last.math,
            readingWriting: last.readingWriting,
            domainCompetency: last.domainCompetency ? { ...last.domainCompetency } : undefined,
            secondsStudiedMath: 0,
            secondsStudiedReadingWriting: 0,
          });
          cursor = next;
          changed = true;
        }
      }

      // For today, always compute from current data (overwrite if exists)
      const summaries = data.domainSummaries;
      const mathDomains = DOMAIN_COMPETENCY.MATH_DOMAINS;
      const rwDomains = DOMAIN_COMPETENCY.READING_WRITING_DOMAINS;
      const mathValues = mathDomains.filter((id) => (summaries as any)[id]).map((id) => (summaries as any)[id].averageCompetency);
      const rwValues = rwDomains.filter((id) => (summaries as any)[id]).map((id) => (summaries as any)[id].averageCompetency);
      const mathAvg = mathValues.length > 0 ? mathValues.reduce((a,b)=>a+b,0) / mathValues.length : data.overallCompetency;
      const rwAvg = rwValues.length > 0 ? rwValues.reduce((a,b)=>a+b,0) / rwValues.length : data.overallCompetency;
      const domainCompetency: { [domainId: string]: number } = {};
      Object.keys(summaries).forEach((k) => {
        domainCompetency[k] = (summaries as any)[k].averageCompetency;
      });
      const todayIdx = data.masteryHistory.findIndex((e) => e.date === todayIso);
      const overallFromDomains = (() => {
        const parts = [] as number[];
        if (mathValues.length > 0) parts.push(mathAvg);
        if (rwValues.length > 0) parts.push(rwAvg);
        return parts.length > 0 ? (parts.reduce((a,b)=>a+b,0) / parts.length) : data.overallCompetency;
      })();
      const existingToday = data.masteryHistory.find((e) => e.date === todayIso);
      const todaysSnapshot = {
        date: todayIso,
        overall: overallFromDomains,
        math: mathAvg,
        readingWriting: rwAvg,
        domainCompetency,
        secondsStudiedMath: existingToday?.secondsStudiedMath || 0,
        secondsStudiedReadingWriting: existingToday?.secondsStudiedReadingWriting || 0,
      };
      if (todayIdx >= 0) {
        data.masteryHistory[todayIdx] = todaysSnapshot;
      } else {
        data.masteryHistory.push(todaysSnapshot);
      }
      changed = true;

      data.masteryHistory = this.keepLastNDays(data.masteryHistory, MASTERY_HISTORY.MAX_DAYS_TO_KEEP);
    }
    if (changed) {
      const db = getFirestore(app!);
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { adaptiveLearning: data });
    }
    return changed;
  }

  /**
   * Retrieves the name of a subdomain given its ID.
   * @param subdomainId - The ID of the subdomain.
   * @returns The name of the subdomain, or a default name if not found.
   */
  private getSubdomainName(subdomainId: string): string {
    const skillMapping = ALL_SKILLS.find(skill => skill.subdomainId === subdomainId);
    if (skillMapping) {
      return skillMapping.skill;
    }
    
    return `Skill ${subdomainId}`;
  }

  /**
   * Determines the reason why a subdomain is considered an area for improvement.
   * @param score - The subdomain score object.
   * @returns A string explaining the reason for improvement.
   */
  private getImprovementReason(score: SubdomainScore): string {
    if (score.needsReinforcement) return 'Needs reinforcement due to time decay';
    if (score.recentStreak < SCORING_CONSTANTS.NEGATIVE_STREAK_THRESHOLD) return 'Recent incorrect streak';
    if (score.competencyScore < SCORING_CONSTANTS.INITIAL_COMPETENCY) return 'Low competency score';
    return 'General improvement needed';
  }
}

// Singleton instance of the service
export const adaptiveLearningService = new AdaptiveLearningService();
