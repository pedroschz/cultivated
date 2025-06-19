import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { app, auth } from '../firebaseClient';
import { AdaptiveLearningEngine } from './scoring-engine';
import { 
  AdaptiveLearningData, 
  SubdomainScore, 
  ScoreUpdate,
  QuestionSelectionCriteria 
} from '../types/adaptive-learning';
import { Question } from '../types/practice';

export class AdaptiveLearningService {
  private engine: AdaptiveLearningEngine;

  constructor() {
    this.engine = new AdaptiveLearningEngine();
  }

  /**
   * Get adaptive learning data for a user, creating it if it doesn't exist
   */
  async getUserAdaptiveLearningData(userId: string): Promise<AdaptiveLearningData | null> {
    if (!app) return null;

    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.error('User document not found');
        return null;
      }

      const userData = userDoc.data();

      // Check if user has adaptive learning data
      if (userData.adaptiveLearning?.algorithmVersion) {
        return userData.adaptiveLearning as AdaptiveLearningData;
      }

      // If not, create new adaptive learning data
      console.log('Creating new adaptive learning data for user...');
      const newAdaptiveLearningData = this.createInitialAdaptiveLearningData();
      
      await updateDoc(userRef, {
        adaptiveLearning: newAdaptiveLearningData
      });

      return newAdaptiveLearningData;
    } catch (error) {
      console.error('Error getting adaptive learning data:', error);
      return null;
    }
  }

  /**
   * Update user's adaptive learning data based on a question answer
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
      const db = getFirestore(app);
      const userRef = doc(db, 'users', userId);
      
      // Get current adaptive learning data
      const adaptiveLearningData = await this.getUserAdaptiveLearningData(userId);
      if (!adaptiveLearningData) {
        console.error('No adaptive learning data found for user');
        return false;
      }

      // FIXED: Map question to actual subdomain ID
      // Questions have 'field' which represents the actual subdomain ID (0-46)
      // If field exists, use it; otherwise map domain to a representative subdomain
      let subdomainId: string;
      
      if (question.field !== undefined) {
        // Use the field as the actual subdomain ID
        subdomainId = question.field.toString();
      } else {
        // Fallback: map domain to first subdomain in that domain's range
        const domainToSubdomainMap: { [key: number]: number } = {
          0: 0,   // Algebra -> subdomain 0
          1: 8,   // Problem Solving -> subdomain 8
          2: 18,  // Advanced Math -> subdomain 18
          3: 31,  // Geometry -> subdomain 31
          4: 37,  // Information and Ideas -> subdomain 37
          5: 40,  // Craft and Structure -> subdomain 40
          6: 43,  // Expression of Ideas -> subdomain 43
          7: 45,  // Standard English -> subdomain 45
        };
        subdomainId = (domainToSubdomainMap[question.domain] || 0).toString();
      }

      // Create score update
      const scoreUpdate: ScoreUpdate = {
        subdomainId, // FIXED: Now uses the correct subdomain ID
        questionId,
        isCorrect,
        timeSpent,
        difficulty: question.difficulty,
        timestamp: Date.now()
      };

      // Update subdomain score
      const currentSubdomainScore = adaptiveLearningData.subdomainScores[scoreUpdate.subdomainId] || 
        this.engine.initializeSubdomainScore();

      const updatedSubdomainScore = this.engine.updateSubdomainScore(currentSubdomainScore, scoreUpdate);
      
      // Update the adaptive learning data
      adaptiveLearningData.subdomainScores[scoreUpdate.subdomainId] = updatedSubdomainScore;
      adaptiveLearningData.lastQuestionUpdate = Date.now();
      adaptiveLearningData.totalQuestionsAnswered++;
      adaptiveLearningData.totalTimeSpent += timeSpent;

      // Recalculate overall competency
      const allScores = Object.values(adaptiveLearningData.subdomainScores);
      adaptiveLearningData.overallCompetency = allScores.reduce((sum, score) => 
        sum + score.competencyScore, 0) / allScores.length;

      // Update domain summaries
      adaptiveLearningData.domainSummaries = this.recalculateDomainSummaries(adaptiveLearningData.subdomainScores);

      // Update learning profile periodically
      if (adaptiveLearningData.totalQuestionsAnswered % 10 === 0) {
        adaptiveLearningData.learningProfile = this.updateLearningProfile(
          adaptiveLearningData.learningProfile,
          adaptiveLearningData.subdomainScores
        );
      }

      // Save to database
      await updateDoc(userRef, {
        adaptiveLearning: adaptiveLearningData
      });

      console.log(`Updated adaptive learning score for user ${userId}, subdomain ${scoreUpdate.subdomainId}`);
      return true;

    } catch (error) {
      console.error('Error updating user score:', error);
      return false;
    }
  }

  /**
   * Get optimized question selection for a practice session
   */
  async getOptimizedQuestionSelection(
    userId: string,
    sessionLength: number = 10,
    availableQuestions: Question[]
  ): Promise<Question[]> {
    try {
      // Get user's adaptive learning data
      const adaptiveLearningData = await this.getUserAdaptiveLearningData(userId);
      if (!adaptiveLearningData) {
        console.log('No adaptive learning data found, using random selection');
        return this.getRandomQuestions(availableQuestions, sessionLength);
      }

      // Generate selection criteria
      const criteria = this.engine.generateQuestionSelectionCriteria(adaptiveLearningData, sessionLength);
      
      // Select questions based on criteria
      const selectedQuestions: Question[] = [];
      const usedQuestionIds = new Set<string>();

      for (const criterion of criteria) {
        if (selectedQuestions.length >= sessionLength) break;

        // FIXED: Find matching questions using field (subdomain) instead of domain
        const matchingQuestions = availableQuestions.filter(q => {
          // Map question to subdomain ID using the same logic as updateUserScore
          let questionSubdomainId: string;
          
          if (q.field !== undefined) {
            questionSubdomainId = q.field.toString();
          } else {
            const domainToSubdomainMap: { [key: number]: number } = {
              0: 0, 1: 8, 2: 18, 3: 31, 4: 37, 5: 40, 6: 43, 7: 45
            };
            questionSubdomainId = (domainToSubdomainMap[q.domain] || 0).toString();
          }
          
          return questionSubdomainId === criterion.subdomainId &&
                 q.difficulty === criterion.difficulty &&
                 !usedQuestionIds.has(q.id);
        });

        if (matchingQuestions.length > 0) {
          // Select random question from matching ones
          const selectedQuestion = matchingQuestions[Math.floor(Math.random() * matchingQuestions.length)];
          selectedQuestions.push(selectedQuestion);
          usedQuestionIds.add(selectedQuestion.id);
        }
      }

      // Fill remaining slots with random questions if needed
      while (selectedQuestions.length < sessionLength) {
        const remainingQuestions = availableQuestions.filter(q => !usedQuestionIds.has(q.id));
        if (remainingQuestions.length === 0) break;

        const randomQuestion = remainingQuestions[Math.floor(Math.random() * remainingQuestions.length)];
        selectedQuestions.push(randomQuestion);
        usedQuestionIds.add(randomQuestion.id);
      }

      console.log(`Selected ${selectedQuestions.length} optimized questions for user ${userId}`);
      return selectedQuestions;

    } catch (error) {
      console.error('Error getting optimized question selection:', error);
      return this.getRandomQuestions(availableQuestions, sessionLength);
    }
  }

  /**
   * Get learning insights for a user
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
    
    // Calculate strengths (high competency scores)
    const strengths = subdomainEntries
      .filter(([_, score]) => score.competencyScore > 75)
      .sort((a, b) => b[1].competencyScore - a[1].competencyScore)
      .slice(0, 5)
      .map(([subdomainId, score]) => ({
        subdomainId,
        subdomainName: this.getSubdomainName(subdomainId),
        score: score.competencyScore
      }));

    // Calculate weaknesses (low competency scores)
    const weaknesses = subdomainEntries
      .filter(([_, score]) => score.competencyScore < 60)
      .sort((a, b) => a[1].competencyScore - b[1].competencyScore)
      .slice(0, 5)
      .map(([subdomainId, score]) => ({
        subdomainId,
        subdomainName: this.getSubdomainName(subdomainId),
        score: score.competencyScore
      }));

    // Calculate improvement areas (various factors)
    const improvementAreas = subdomainEntries
      .filter(([_, score]) => 
        score.needsReinforcement || 
        score.recentStreak < -2 || 
        score.competencyScore < 50
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
   * Create initial adaptive learning data for a new user
   */
  private createInitialAdaptiveLearningData(): AdaptiveLearningData {
    const subdomainScores: { [subdomainId: string]: SubdomainScore } = {};
    
    // Initialize all 47 subdomains
    for (let i = 0; i <= 46; i++) {
      const subdomainId = i.toString();
      subdomainScores[subdomainId] = this.engine.initializeSubdomainScore();
    }

    // Calculate domain summaries
    const domainSummaries = this.recalculateDomainSummaries(subdomainScores);

    // Create initial learning profile
    const learningProfile = {
      learningVelocity: 5,
      retentionRate: 7,
      consistencyScore: 6,
      sessionOptimalLength: 15,
      averageSessionLength: 12,
      preferredDifficultyProgression: 1.2,
      prioritySubdomains: [],
      strongSubdomains: []
    };

    return {
      subdomainScores,
      domainSummaries,
      learningProfile,
      overallCompetency: 50, // Start at neutral
      totalQuestionsAnswered: 0,
      totalTimeSpent: 0,
      algorithmVersion: '1.0.0',
      lastFullUpdate: Date.now(),
      lastQuestionUpdate: Date.now(),
      questionQueue: []
    };
  }

  // Private helper methods

  private getRandomQuestions(availableQuestions: Question[], count: number): Question[] {
    const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private recalculateDomainSummaries(subdomainScores: { [key: string]: SubdomainScore }) {
    const domains: { [domainId: string]: any } = {};
    
    // Domain ranges mapping
    const domainRanges = {
      '0': [0, 7],   // Algebra: 0-7
      '1': [8, 17],  // Problem Solving: 8-17
      '2': [18, 30], // Advanced Math: 18-30
      '3': [31, 36], // Geometry: 31-36
      '4': [37, 39], // Information and Ideas: 37-39
      '5': [40, 42], // Craft and Structure: 40-42
      '6': [43, 44], // Expression of Ideas: 43-44
      '7': [45, 46], // Standard English: 45-46
    };

    Object.entries(domainRanges).forEach(([domainId, range]) => {
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
        domainId: parseInt(domainId),
        averageCompetency: count > 0 ? totalCompetency / count : 0,
        subdomainScores: relevantSubdomains,
        lastUpdated: Date.now()
      };
    });

    return domains;
  }

  private updateLearningProfile(currentProfile: any, subdomainScores: { [key: string]: SubdomainScore }) {
    const scores = Object.values(subdomainScores);
    
    // Recalculate learning velocity
    const avgImprovementRate = scores.reduce((sum, score) => sum + score.improvementRate, 0) / scores.length;
    currentProfile.learningVelocity = Math.max(1, Math.min(10, avgImprovementRate + 5));

    // Update priority and strong subdomains
    currentProfile.prioritySubdomains = Object.entries(subdomainScores)
      .filter(([_, score]) => score.competencyScore < 60)
      .sort((a, b) => a[1].competencyScore - b[1].competencyScore)
      .slice(0, 5)
      .map(([subdomainId]) => subdomainId);

    currentProfile.strongSubdomains = Object.entries(subdomainScores)
      .filter(([_, score]) => score.competencyScore > 75)
      .sort((a, b) => b[1].competencyScore - a[1].competencyScore)
      .slice(0, 5)
      .map(([subdomainId]) => subdomainId);

    return currentProfile;
  }

  private getSubdomainName(subdomainId: string): string {
    // This would import from constants, but for now we'll use a simple mapping
    const subdomainNames: { [key: string]: string } = {
      '0': 'Solving linear equations and inequalities',
      '1': 'Linear equation word problems',
      // ... rest of subdomain names
    };
    
    return subdomainNames[subdomainId] || `Subdomain ${subdomainId}`;
  }

  private getImprovementReason(score: SubdomainScore): string {
    if (score.needsReinforcement) return 'Needs reinforcement due to time decay';
    if (score.recentStreak < -2) return 'Recent incorrect streak';
    if (score.competencyScore < 50) return 'Low competency score';
    return 'General improvement needed';
  }
}

// Create singleton instance
export const adaptiveLearningService = new AdaptiveLearningService(); 