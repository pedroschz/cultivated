/**
 * @file This file implements the multi-step onboarding process for new users.
 * It guides users through a series of steps to collect essential information
 * for personalizing their learning experience, such as personal details,
 * academic background, and confidence levels. This data is used to initialize
 * their adaptive learning profile in Firestore.
 */
"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { WEB_BASE_URL, getAllowedSchools } from "@/lib/config";
import { useRouter, useSearchParams } from "next/navigation";
import { User, onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, app } from "@/lib/firebaseClient";
import { getFunctions, httpsCallable } from "firebase/functions";
import { AdaptiveLearningEngine } from "@/lib/adaptive-learning/scoring-engine";
import { satScoreToMasteryPercent, capSectionPairProportionally } from "../../lib/utils/satToMastery";
import { adaptiveLearningService } from "@/lib/adaptive-learning/adaptive-service";
import { ALL_SKILLS, DOMAIN_RANGES } from "@/lib/adaptive-learning/skill-mapping";
import { countries } from 'countries-list';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, ArrowRight, User as UserIcon, Calendar, Globe, GraduationCap, Target, TrendingUp, Palette, AlertTriangle, Bot, CheckCircle, Clock, FileText, MessageCircle, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/ui/loading";
import { AvatarCustomizer } from "@/components/ui/avatar-customizer";
import { DEFAULT_AVATAR } from "@/lib/constants/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { SelectionCard } from "@/components/onboarding/SelectionCard";
import { ScoreUploadModal } from "@/components/onboarding/ScoreUploadModal";
import type { ExtractedSatData } from "@/lib/pdf-scraper";
import { toast } from "sonner";

/**
 * Converts a country code (e.g., "US") into its corresponding flag emoji.
 * @param countryCode The two-letter country code.
 * @returns A string containing the flag emoji.
 */
const getFlagEmoji = (countryCode: string) => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Processes the raw countries list into a sorted array of objects for easier use in the UI.
const countryList = Object.entries(countries)
  .map(([code, country]) => ({
    code,
    name: country.name,
    flag: getFlagEmoji(code)
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const TOTAL_STEPS = 12;

// Defines the structure for the data collected during the onboarding process.
interface OnboardingData {
  name: string;
  username: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | '';
  country: string;
  language: string;
  curriculum: string;
  customCurriculum?: string;
  school: string;
  schoolName?: string;
  avatarIcon: string;
  avatarColor: string;
  hasTakenSAT: 'yes' | 'psat' | 'no' | '';
  satMathScore?: number;
  satRWScore?: number;
  satMonth?: string;
  satYear?: number;
  psatMathScore?: number;
  psatRWScore?: number;
  psatMonth?: string;
  psatYear?: number;
  satFamiliarity?: string;
  practiceHoursApprox?: number; // new: capture approx hours practiced
  practiceMathScore?: number;
  practiceRWScore?: number;
  practiceMonth?: string;
  practiceYear?: number;
  mathConfidence: number;
  rwConfidence: number;
  tutorName?: string;
  tutorVoice?: string;
  // Commitment step
  goalScore?: number; // 400-1600
  goalDate?: string; // YYYY-MM-DD
  practiceDays: boolean[]; // length 7, Sunday=0 ... Saturday=6
  practiceTimes: string[]; // length 7, HH:mm per weekday
  officialPdfData?: ExtractedSatData | null;
  interests: { role: 'user' | 'model', text: string }[];
  interestsQuestion?: string;
  interestsAnswer?: string;
  cheerLines?: string[];
}

/**
 * The main component for the onboarding page. It manages the state and logic
 * for the multi-step form.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loading /></div>}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize currentStep from URL if available, otherwise default to 1
  const initialStep = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const step = parseInt(params.get('step') || '1');
      return (!isNaN(step) && step >= 1 && step <= TOTAL_STEPS) ? step : 1;
    }
    return 1;
  }, []);
  
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [commitmentStage, setCommitmentStage] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const lastSyncedStepRef = useRef<number>(initialStep);

  const [data, setData] = useState<OnboardingData>({
    name: '',
    username: '',
    dateOfBirth: '',
    gender: '',
    country: '',
    language: 'English',
    curriculum: '',
    school: '',
    avatarIcon: DEFAULT_AVATAR.icon,
    avatarColor: DEFAULT_AVATAR.color,
    hasTakenSAT: '',
    mathConfidence: 2,
    rwConfidence: 2,
    practiceHoursApprox: undefined,
    tutorName: '',
    tutorVoice: 'Kore',
    // Commitment defaults
    goalScore: undefined,
    goalDate: undefined,
    practiceDays: [false, false, false, false, false, false, false],
    practiceTimes: Array(7).fill('20:00'),
    officialPdfData: null,
    interests: [],
    interestsQuestion: '', // Store the generated follow-up question
    interestsAnswer: '',   // Store the user's answer to the follow-up
  });

  const [interestInput, setInterestInput] = useState('');

  // 1. Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('onboarding_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse onboarding data", e);
      }
    }
    setIsSynced(true);
  }, []);

  // 2. Sync URL step to State (handling reload and back/forward)
  useEffect(() => {
    if (!isSynced) return;
    const urlStep = parseInt(searchParams.get('step') || '1');
    const validStep = (!isNaN(urlStep) && urlStep >= 1 && urlStep <= TOTAL_STEPS) ? urlStep : 1;
    
    // Only update state if URL step is different from what we last synced to URL
    // This prevents loops: if we just synced state->URL, don't sync URL->state
    if (validStep !== lastSyncedStepRef.current) {
      lastSyncedStepRef.current = validStep;
      setCurrentStep(validStep);
    }
  }, [searchParams, isSynced]); // Removed currentStep to break circular dependency

  // 3. Sync State step to URL (handling next/prev buttons)
  useEffect(() => {
    if (!isSynced) return;
    const urlStep = parseInt(searchParams.get('step') || '1');
    
    // Only update URL if state changed (user clicked next/prev) and URL doesn't match
    // Update the ref to track that we synced this step to URL
    if (currentStep !== urlStep) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('step', String(currentStep));
      lastSyncedStepRef.current = currentStep;
      router.replace(`?${params.toString()}`);
    } else {
      // URL already matches state, update ref to reflect this
      lastSyncedStepRef.current = currentStep;
    }
  }, [currentStep, isSynced, router, searchParams]);

  // 4. Save data to localStorage on change
  useEffect(() => {
    if (isSynced) {
      localStorage.setItem('onboarding_data', JSON.stringify(data));
    }
  }, [data, isSynced]);
  const [isInterestLoading, setIsInterestLoading] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [prefilledSchool, setPrefilledSchool] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [showFollowUp, currentStep]);


  const handleInterestInitialSubmit = async () => {
    if (!interestInput.trim() || isInterestLoading) return;

    setIsInterestLoading(true);
    // Save initial interest immediately
    updateData('interests', [{ role: 'user', text: interestInput }]);

    try {
      console.log('DEBUG: Calling generateInterestsChat function...', { interestInput });
      const functions = getFunctions(app, 'us-central1');
      const generateInterestsChat = httpsCallable(functions, 'generateInterestsChat');
      
      const result: any = await generateInterestsChat({
        history: [], 
        message: interestInput,
        mode: 'generate_question'
      });
      console.log('DEBUG: generateInterestsChat result:', result);
      
      const response = result.data.response;
      if (!response) {
        console.error('DEBUG: Invalid response structure:', result);
        throw new Error('Invalid response');
      }
      
      updateData('interestsQuestion', response);
      setShowFollowUp(true);
    } catch (e: any) {
      console.error('Interest Initial Submit Error:', e);
      console.error('DEBUG: Error details:', {
        message: e.message,
        code: e.code,
        details: e.details,
        stack: e.stack
      });
      // Fallback if API fails
      updateData('interestsQuestion', "What do you enjoy most about that?");
      setShowFollowUp(true);
    } finally {
      setIsInterestLoading(false);
    }
  };

// ...

// ... existing code ...

  // Helper function to extract JSON from markdown code blocks or plain text
  const extractJSON = (text: string): string => {
    if (!text) return '[]';
    
    try {
      // Remove markdown code blocks (```json ... ``` or ``` ... ```)
      let cleaned = text.trim();
      
      // Match markdown code blocks
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
      const match = cleaned.match(codeBlockRegex);
      if (match && match[1]) {
        cleaned = match[1].trim();
      }
      
      // Remove any leading/trailing whitespace or newlines
      cleaned = cleaned.trim();
      
      // If it starts with [ or {, it's likely JSON
      if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
        return cleaned;
      }
      
      // Try to find JSON array or object in the text
      const jsonArrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonArrayMatch) {
        return jsonArrayMatch[0];
      }
      
      const jsonObjectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        return jsonObjectMatch[0];
      }
      
      return cleaned;
    } catch (e) {
      console.warn('Error extracting JSON:', e);
      return '[]';
    }
  };

  const handleFollowUpSubmit = async () => {
// ... existing code ...
     if (!data.interestsAnswer?.trim()) return;
     if (isInterestLoading) return; // Prevent double submission
     setIsInterestLoading(true);
     
     // Save follow-up interaction
     const newInterests = [
       ...data.interests,
       { role: 'model', text: data.interestsQuestion || '' },
       { role: 'user', text: data.interestsAnswer || '' }
     ];
     updateData('interests', newInterests as { role: 'user' | 'model', text: string }[]);

     // Kick off cheer-line generation in the background so the user can
     // immediately advance to the next step. The result is written straight to
     // Firestore when it resolves (and mirrored into local state), so it still
     // lands on the user doc even if they finish onboarding first.
     const cheersInput = `${interestInput} ${data.interestsAnswer}`;
     const currentUser = auth?.currentUser;

     (async () => {
       try {
         console.time('generateCheers');
         console.log('DEBUG: Calling generateInterestsChat for cheers (background)...', { input: cheersInput });
         const functions = getFunctions(app, 'us-central1');
         const generateInterestsChat = httpsCallable(functions, 'generateInterestsChat');

         const result: any = await generateInterestsChat({
           message: cheersInput,
           mode: 'generate_cheers',
         });

         console.timeEnd('generateCheers');
         const response = result?.data?.response;
         let cheers: any = [];
         try {
           if (typeof response === 'string') {
             const jsonString = extractJSON(response);
             cheers = JSON.parse(jsonString);
           } else {
             console.warn('DEBUG: Cheers response is not a string:', response);
           }
         } catch (parseError: any) {
           console.error('Failed to parse cheers JSON', parseError);
         }

         if (Array.isArray(cheers) && cheers.length > 0) {
           updateData('cheerLines', cheers);
           try {
             if (db && currentUser?.uid) {
               await setDoc(
                 doc(db, "users", currentUser.uid),
                 { cheerLines: cheers },
                 { merge: true },
               );
             }
           } catch (writeErr) {
             console.warn('Failed to persist cheer lines to Firestore:', writeErr);
           }
         }
       } catch (e: any) {
         console.error('Background cheer generation failed', e);
       }
     })();

     setIsInterestLoading(false);
   };

  // Prefetch dashboard (guaranteed destination after onboarding completion)
  useEffect(() => {
    router.prefetch('/dashboard');
  }, [router]);

  // Effect to monitor authentication state and redirect if the user is not logged in or has completed onboarding.
  useEffect(() => {
    if (!auth) return;
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        router.push('/login');
        return;
      }
      
      // Check if user has completed onboarding and redirect to dashboard
      if (db) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            if (userData?.onboardingCompleted) {
              window.location.href = '/dashboard';
              return;
            }

            // Pre-fill name/username that were already captured during the
            // mini "quick" onboarding, and skip past those steps if both are
            // present so we don't re-ask the user for them.
            const prefilledName = typeof userData?.name === 'string' ? userData.name : '';
            const prefilledUsername = typeof userData?.username === 'string' ? String(userData.username).toLowerCase() : '';
            if (prefilledName || prefilledUsername) {
              setData(prev => ({
                ...prev,
                name: prefilledName || prev.name,
                username: prefilledUsername || prev.username,
              }));
              const resumeFromQuick = searchParams?.get('resume') === '1';
              if (prefilledName && prefilledUsername && resumeFromQuick && currentStep < 3) {
                setCurrentStep(3);
              }
            }
            
            // Pre-fill school data if present (e.g. from invite link)
            if (userData?.schoolId) {
              const schoolName = userData.schoolName || '';
              const schools = getAllowedSchools();
              
              setData(prev => ({
                 ...prev,
                 country: userData.country || 'US', // Default to US for invites
                 curriculum: userData.curriculum || 'US',
                 school: schools.includes(schoolName) ? schoolName : 'Other',
                 schoolName: schools.includes(schoolName) ? undefined : schoolName,
              }));
              setPrefilledSchool(true);
            }
          }
        } catch (error) {
          console.error('Error checking onboarding status:', error);
        }
      }
    });

    return () => unsubscribe();
  }, [router, db]);

  /**
   * Handles the file selection from the ScoreUploadModal.
   * @param file The uploaded PDF file.
   */
  const handleScoreFileUpload = async (file: File) => {
    try {
      toast.loading("Analyzing score report...", { id: "pdf-scrape" });
      
      // Dynamic import to avoid SSR issues with pdfjs-dist
      // Use standard alias import
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const pdfScraper = await import("@/lib/pdf-scraper");
      const { extractTextFromPdf, parseSatScoreReport } = pdfScraper;
      
      const text = await extractTextFromPdf(file);
      // Temporary: Log full text to console as requested
      // console.log("--- RAW PDF TEXT START ---");
      // console.log(text);
      // console.log("--- RAW PDF TEXT END ---");
      
      const parsedData = parseSatScoreReport(text);
      console.log("--- RAW PDF TEXT ---", text);
      console.log("--- PARSED DATA ---", parsedData);
      
      if (parsedData.candidateName || parsedData.totalScore) {
        toast.success(`Found report for ${parsedData.candidateName || 'Candidate'}: ${parsedData.totalScore || 'Score not found'}`, { id: "pdf-scrape" });
        
        // Save the full parsed data to state so it can be sent to backend later
        updateData('officialPdfData', parsedData);

        // Auto-populate form if we found data
        if (parsedData.totalScore) {
          // We don't have total score field in 'yes' path, we have math and RW
          if (parsedData.sectionScores?.math) updateData('satMathScore', parsedData.sectionScores.math);
          if (parsedData.sectionScores?.readingWriting) updateData('satRWScore', parsedData.sectionScores.readingWriting);
        }

        // Auto-populate date if found
        if (parsedData.testDate) {
          // Expected format from scraper: "March 11, 2023"
          // We need to extract Month and Year
          const parts = parsedData.testDate.split(' '); // ["March", "11,", "2023"]
          if (parts.length >= 3) {
            const month = parts[0];
            const year = parseInt(parts[2]);
            
            // Validate month is one of our expected months
            const validMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            if (validMonths.includes(month)) {
              updateData('satMonth', month);
            }
            
            if (!isNaN(year) && year > 2000 && year <= new Date().getFullYear()) {
              updateData('satYear', year);
            }
          }
        }
      } else {
        toast.warning("Could not automatically extract scores. Please check the console for raw text.", { id: "pdf-scrape" });
      }
    } catch (error) {
      console.error("PDF Scraping Error:", error);
      toast.error("Failed to read PDF file.", { id: "pdf-scrape" });
    }
  };

  /**
   * Validates a username based on specific criteria.
   * @param username The username string to validate.
   * @returns True if the username is valid, false otherwise.
   */
  const validateUsername = (username: string): boolean => {
    if (!/[a-z]/.test(username)) return false;
    if (!/^[a-z0-9.-]+$/.test(username)) return false;
    if (/^[-.]|[-.]$/.test(username)) return false;
    return true;
  };

  /**
   * Checks if a username is already taken by querying the Firestore database.
   * @param username The username to check.
   * @returns True if the username is available, false otherwise.
   */
  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    if (!db) return false;
    try {
      const usersRef = collection(db, "users_public");
      const q = query(usersRef, where("username", "==", username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty;
    } catch (err) {
      console.error("Error checking username:", err);
      return false;
    }
  };

  // Filters the country list based on user search input.
  const filteredCountries = countryList.filter(country => 
    country.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Effect to handle clicks outside the country dropdown to close it.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setShowCountryList(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /**
   * Updates a specific field in the onboarding data state.
   * @param field The key of the data to update.
   * @param value The new value for the field.
   */
  const updateData = (field: keyof OnboardingData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  // Compute current SAT total based on inputs (mirrors submit logic)
  const computeCurrentSatTotal = (): number => {
    // Confidence to base mapping
    const confidenceToBase = (conf: number) => {
      switch (Number(conf)) {
        case 1: return 470;
        case 2: return 490;
        case 3: return 520;
        case 4: return 550;
        default: return 490;
      }
    };
    let m = 0;
    let r = 0;
    if (data.hasTakenSAT === 'yes') {
      m = Math.max(200, Math.min(800, Number(data.satMathScore || 0)));
      r = Math.max(200, Math.min(800, Number(data.satRWScore || 0)));
    } else if (data.hasTakenSAT === 'psat') {
      // Convert PSAT (160-760 per section) to SAT scale by adding 40 per section
      const pm = Math.max(160, Math.min(760, Number(data.psatMathScore || 0)));
      const pr = Math.max(160, Math.min(760, Number(data.psatRWScore || 0)));
      m = Math.max(200, Math.min(800, pm + 40));
      r = Math.max(200, Math.min(800, pr + 40));
    } else {
      if (data.satFamiliarity === "haven't practiced") {
        m = confidenceToBase(data.mathConfidence);
        r = confidenceToBase(data.rwConfidence);
      } else if (data.satFamiliarity === 'have started practicing') {
        m = confidenceToBase(data.mathConfidence);
        r = confidenceToBase(data.rwConfidence);
        const hours = Math.max(0, Number(data.practiceHoursApprox || 0));
        const bonus = 3 * hours;
        m += bonus;
        r += bonus;
      } else if (data.satFamiliarity === 'have taken a practice test') {
        m = Math.max(200, Math.min(800, Number(data.practiceMathScore || 0)));
        r = Math.max(200, Math.min(800, Number(data.practiceRWScore || 0)));
        const adjust = (conf: number) => (conf === 1 ? -20 : conf === 2 ? 0 : conf === 3 ? 20 : 40);
        m += adjust(data.mathConfidence);
        r += adjust(data.rwConfidence);
      }
    }
    // Cap combined at 1450 proportionally
    const total = Math.max(0, m + r);
    if (total > 1450 && total > 0) {
      const factor = 1450 / total;
      m = Math.round(m * factor);
      r = Math.round(r * factor);
    }
    m = Math.round(Math.max(200, Math.min(800, m)));
    r = Math.round(Math.max(200, Math.min(800, r)));
    return m + r;
  };

  const computeHoursNeeded = (currentTotal: number, goalScore?: number): number => {
    if (!goalScore || !Number.isFinite(goalScore)) return 0;
    // Use needed improvement (goal - current). Ensure a minimum of 100 before dividing into hours.
    const needed = (goalScore - currentTotal);
    const base = Math.max(needed, 10);
    return base / 5;
  };

  const countAvailableDays = (startIso: string, endIso: string, selectedDays: boolean[]): number => {
    try {
      const start = new Date(startIso);
      const end = new Date(endIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
      if (end < start) return 0;
      let count = 0;
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cursor <= endDate) {
        const dow = cursor.getDay(); // 0=Sun..6=Sat
        if (selectedDays[dow]) count++;
        cursor.setDate(cursor.getDate() + 1);
      }
      return count;
    } catch {
      return 0;
    }
  };

  const formatMinutes = (totalMinutes: number): string => {
    const minutes = Math.max(0, Math.round(totalMinutes || 0));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      const h = `${hours} hr${hours !== 1 ? 's' : ''}`;
      const m = mins > 0 ? ` ${mins} min${mins !== 1 ? 's' : ''}` : '';
      return `${h}${m}`;
    }
    return `${mins} min${mins !== 1 ? 's' : ''}`;
  };

  const toIcsDateTimeLocal = (date: Date, timeHHmm: string): string => {
    const [hh, mm] = (timeHHmm || '20:00').split(':').map((s) => parseInt(s, 10));
    const local = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh || 0, mm || 0, 0);
    const YYYY = local.getFullYear().toString().padStart(4, '0');
    const MM = (local.getMonth() + 1).toString().padStart(2, '0');
    const DD = local.getDate().toString().padStart(2, '0');
    const HH = local.getHours().toString().padStart(2, '0');
    const Min = local.getMinutes().toString().padStart(2, '0');
    const SS = '00';
    return `${YYYY}${MM}${DD}T${HH}${Min}${SS}`; // floating local time
  };

  const toIcsTimestampUtc = (d: Date): string => {
    const YYYY = d.getUTCFullYear().toString().padStart(4, '0');
    const MM = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const DD = d.getUTCDate().toString().padStart(2, '0');
    const HH = d.getUTCHours().toString().padStart(2, '0');
    const Min = d.getUTCMinutes().toString().padStart(2, '0');
    const SS = d.getUTCSeconds().toString().padStart(2, '0');
    return `${YYYY}${MM}${DD}T${HH}${Min}${SS}Z`;
  };

  const generateCalendarIcs = (
    practiceDays: boolean[],
    practiceTimes: string[],
    minutesPerDay: number,
    startIso: string,
    endIso: string,
  ): string => {
    const title = 'SAT practice';
    const nowStamp = toIcsTimestampUtc(new Date());
    const start = new Date(startIso);
    const end = new Date(endIso);
    const dashboardUrl = `${WEB_BASE_URL}/practice`;

    let ics = '';
    ics += 'BEGIN:VCALENDAR\r\n';
    ics += 'VERSION:2.0\r\n';
    ics += 'PRODID:-//CultivatED//Onboarding//EN\r\n';
    ics += 'CALSCALE:GREGORIAN\r\n';
    ics += `X-WR-CALNAME:${title}\r\n`;

    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= endDate) {
      const dow = cursor.getDay(); // 0..6
      if (practiceDays[dow]) {
        const dtstart = toIcsDateTimeLocal(cursor, practiceTimes[dow] || '20:00');
        const duration = `PT${Math.max(0, Math.round(minutesPerDay))}M`;
        const uid = `${dtstart}-${Math.random().toString(36).slice(2)}@cultivated`;
        ics += 'BEGIN:VEVENT\r\n';
        ics += `UID:${uid}\r\n`;
        ics += `DTSTAMP:${nowStamp}\r\n`;
        ics += `DTSTART:${dtstart}\r\n`;
        ics += `DURATION:${duration}\r\n`;
        ics += `SUMMARY:${title}\r\n`;
        ics += `URL:${dashboardUrl}\r\n`;
        ics += 'END:VEVENT\r\n';
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    ics += 'END:VCALENDAR\r\n';
    return ics;
  };

  const downloadIcs = (filename: string, ics: string) => {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Play a short TTS preview for the selected voice
  const playVoicePreview = async (voiceName: string) => {
    try {
      const slug = voiceName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const url = `/tts-previews/${slug}.wav`;
      const audio = new Audio(url);
      await audio.play();
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Preview audio failed to play', e);
      }
    }
  };

  const handleSelectVoice = async (voiceName: string) => {
    updateData('tutorVoice', voiceName);
    await playVoicePreview(voiceName);
  };

  /**
   * Validates the data for the current step of the onboarding process.
   * @returns A promise that resolves to true if the step is valid, false otherwise.
   */
  const validateStep = async (): Promise<boolean> => {
    setError(null);

    switch (currentStep) {
      case 1:
        if (!data.name.trim()) {
          setError("Please enter your name");
          return false;
        }
        return true;

      case 2:
        if (!data.username.trim()) {
          setError("Please enter a username");
          return false;
        }
        if (!validateUsername(data.username)) {
          setError("Username must be lowercase, contain at least one letter, and can only include letters, numbers, dots, and dashes. It cannot start or end with a dash or dot.");
          return false;
        }
        const isAvailable = await checkUsernameAvailability(data.username);
        if (!isAvailable) {
          setError("This username is already taken. Please choose a different one.");
          return false;
        }
        return true;

      case 3:
        if (!data.dateOfBirth) {
          setError("Please enter your date of birth");
          return false;
        }
        if (!data.gender) {
          setError("Please select your gender");
          return false;
        }
        return true;

      case 4:
        if (!data.country) {
          setError("Please select your country");
          return false;
        }
        if (!data.curriculum) {
          setError("Please select your curriculum");
          return false;
        }
        if (data.curriculum === 'Other' && !data.customCurriculum?.trim()) {
          setError("Please specify your curriculum");
          return false;
        }
        return true;

      case 5:
        if (!data.school.trim()) {
          setError("Please enter your school name");
          return false;
        }
        if (data.country === 'US' && data.school === 'Other') {
          if (!data.schoolName || !data.schoolName.trim()) {
            setError("Please enter your school name");
            return false;
          }
        }
        return true;

      case 6:
        // Avatar step is always valid due to default values.
        return true;

      case 7:
        if (!data.hasTakenSAT) {
          setError("Please select SAT or PSAT experience");
          return false;
        }
        if (data.hasTakenSAT === 'yes') {
          if (!data.satMathScore || !data.satRWScore || !data.satMonth || !data.satYear) {
            setError("Please fill in all SAT score details");
            return false;
          }
          if (data.satMathScore < 200 || data.satMathScore > 800) {
            setError("Math score must be between 200 and 800");
            return false;
          }
          if (data.satRWScore < 200 || data.satRWScore > 800) {
            setError("Reading & Writing score must be between 200 and 800");
            return false;
          }
        } else if (data.hasTakenSAT === 'psat') {
          if (!data.psatMathScore || !data.psatRWScore || !data.psatMonth || !data.psatYear) {
            setError("Please fill in all PSAT score details");
            return false;
          }
          if (data.psatMathScore < 160 || data.psatMathScore > 760) {
            setError("PSAT Math must be between 160 and 760");
            return false;
          }
          if (data.psatRWScore < 160 || data.psatRWScore > 760) {
            setError("PSAT R&W must be between 160 and 760");
            return false;
          }
        } else {
          if (!data.satFamiliarity) {
            setError("Please select your SAT familiarity level");
            return false;
          }
          if (data.satFamiliarity === 'have taken a practice test') {
            if (!data.practiceMathScore || !data.practiceRWScore || !data.practiceMonth || !data.practiceYear) {
              setError("Please fill in all practice test details");
              return false;
            }
          }
          if (data.satFamiliarity === 'have started practicing') {
            if (data.practiceHoursApprox === undefined || data.practiceHoursApprox === null || Number.isNaN(Number(data.practiceHoursApprox))) {
              setError("Please enter approximately how many hours you've practiced");
              return false;
            }
          }
        }
        return true;

      case 8:
        return true;

      case 9:
        // Commitment step validation
        if (!data.goalScore || isNaN(Number(data.goalScore))) {
          setError('Please enter your goal SAT score');
          return false;
        }
        if (data.goalScore < 400 || data.goalScore > 1600) {
          setError('Goal score must be between 400 and 1600');
          return false;
        }
        if (!data.goalDate) {
          setError('Please select your goal date');
          return false;
        }
        if (!data.practiceDays.some(Boolean)) {
          setError('Please select at least one day you can practice');
          return false;
        }
        return true;

      case 10:
        if (!data.tutorName || !data.tutorName.trim()) {
          setError("Please choose a name for your AI tutor");
          return false;
        }
        return true;

      case 11:
        return true;

      case 12:
        return true;

      default:
        return true;
    }
  };

  /**
   * Proceeds to the next step or submits the form if on the last step.
   */
  const nextStep = async () => {
    // Handle multi-stage commitment step
    if (currentStep === 9) {
      // Stage-specific validation
      if (commitmentStage === 1) {
        // Prefill goalScore from current total if empty
        if (!data.goalScore || isNaN(Number(data.goalScore))) {
          const autoGoal = computeCurrentSatTotal();
          setData(prev => ({ ...prev, goalScore: autoGoal }));
        }
        if (!data.goalDate) {
          setError('Please select your goal date');
          return;
        }
        if (!data.goalScore || isNaN(Number(data.goalScore))) {
          setError('Please enter your goal SAT score');
          return;
        }
        setError(null);
        setCommitmentStage(2);
        return;
      } else if (commitmentStage === 2) {
        if (!data.practiceDays.some(Boolean)) {
          setError('Please select at least one day you can practice');
          return;
        }
        setError(null);
        setCommitmentStage(3);
        return;
      }
      // Stage 3 proceeds to next overall step
    }

    // Handle Interests step (11)
    if (currentStep === 11) {
      if (!showFollowUp) {
        if (!interestInput.trim()) {
          setError("Please tell us what you do for fun");
          return;
        }
        await handleInterestInitialSubmit();
        return;
      } else {
        if (!data.interestsAnswer?.trim()) {
          setError("Please answer the follow-up question");
          return;
        }
        await handleFollowUpSubmit();
      }
    }

    const isValid = await validateStep();
    if (!isValid) return;

    if (currentStep < TOTAL_STEPS) {
      let next = currentStep + 1;
      // Skip school step (5) if prefilled
      if (currentStep === 4 && prefilledSchool) {
        next = 6;
      }
      
      setCurrentStep(next);
      if (next !== 9) setCommitmentStage(1);
    } else {
      submitOnboarding();
    }
  };

  /**
   * Returns to the previous step.
   */
  const prevStep = () => {
    if (currentStep > 1) {
      if (currentStep === 9 && commitmentStage > 1) {
        setCommitmentStage((s) => (s === 3 ? 2 : 1));
        setError(null);
        return;
      }
      
      let prev = currentStep - 1;
      // Skip back over school step (5) if prefilled
      if (currentStep === 6 && prefilledSchool) {
        prev = 4;
      }

      setCurrentStep(prev);
      setError(null);
    }
  };

  /**
   * Submits the completed onboarding data to Firestore, creating a new user profile
   * and initializing their adaptive learning data.
   */
  const submitOnboarding = async () => {
    if (!user || !db) return;

    const isFinalStepValid = await validateStep();
    if (!isFinalStepValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Update the user's display name in Firebase Authentication.
      await updateProfile(user, { displayName: data.name });

      // Initialize the adaptive learning data structure for the new user.
      const adaptiveLearningData: any = {
        subdomainScores: {},
        domainSummaries: {},
        learningProfile: {
          learningVelocity: 5,
          retentionRate: 7,
          consistencyScore: 6,
          sessionOptimalLength: 15,
          averageSessionLength: 12,
          preferredDifficultyProgression: 1.2,
          prioritySubdomains: [],
          strongSubdomains: []
        },
        overallCompetency: 50,
        totalQuestionsAnswered: 0,
        totalTimeSpent: 0,
        algorithmVersion: '2.0.0',
        lastFullUpdate: new Date(),
        lastQuestionUpdate: new Date(),
        questionQueue: []
      };

      // Initialize scores for all skills.
      const engine = new AdaptiveLearningEngine();
      ALL_SKILLS.forEach((skill: any) => {
        adaptiveLearningData.subdomainScores[skill.subdomainId] = engine.initializeSubdomainScore();
      });

      // Compute initial SAT-like section estimates and map to mastery
      const confidenceToBase = (conf: number) => {
        switch (Number(conf)) {
          case 1: return 470;
          case 2: return 490;
          case 3: return 520;
          case 4: return 550;
          default: return 490;
        }
      };

      let initMathScore = 0;
      let initRwScore = 0;
      if (data.hasTakenSAT === 'yes') {
        initMathScore = Math.max(200, Math.min(800, Number(data.satMathScore || 0)));
        initRwScore = Math.max(200, Math.min(800, Number(data.satRWScore || 0)));
      } else if (data.hasTakenSAT === 'psat') {
        // Convert PSAT section scores by adding 40 points to each section
        const pm = Math.max(160, Math.min(760, Number(data.psatMathScore || 0)));
        const pr = Math.max(160, Math.min(760, Number(data.psatRWScore || 0)));
        initMathScore = Math.max(200, Math.min(800, pm + 40));
        initRwScore = Math.max(200, Math.min(800, pr + 40));
      } else {
        if (data.satFamiliarity === "haven't practiced") {
          initMathScore = confidenceToBase(data.mathConfidence);
          initRwScore = confidenceToBase(data.rwConfidence);
        } else if (data.satFamiliarity === 'have started practicing') {
          initMathScore = confidenceToBase(data.mathConfidence);
          initRwScore = confidenceToBase(data.rwConfidence);
          const hours = Math.max(0, Number(data.practiceHoursApprox || 0));
          const bonus = 3 * hours;
          initMathScore += bonus;
          initRwScore += bonus;
        } else if (data.satFamiliarity === 'have taken a practice test') {
          initMathScore = Math.max(200, Math.min(800, Number(data.practiceMathScore || 0)));
          initRwScore = Math.max(200, Math.min(800, Number(data.practiceRWScore || 0)));
          const adjust = (conf: number) => (conf === 1 ? -20 : conf === 2 ? 0 : conf === 3 ? 20 : 40);
          initMathScore += adjust(data.mathConfidence);
          initRwScore += adjust(data.rwConfidence);
        }
      }

      // Cap combined at 1450 proportionally
      const capped = capSectionPairProportionally(initMathScore, initRwScore, 1450);
      initMathScore = Math.round(Math.max(200, Math.min(800, capped.math)));
      initRwScore = Math.round(Math.max(200, Math.min(800, capped.rw)));

      // Convert to mastery percentages via adjusted CDF
      const mathMasteryPct = satScoreToMasteryPercent(initMathScore);
      const rwMasteryPct = satScoreToMasteryPercent(initRwScore);
      const overallPct = Math.round((mathMasteryPct + rwMasteryPct) / 2);

      // Seed subdomain scores with initial mastery per domain
      const applyInitialToDomain = (domainId: number, percent: number) => {
        const [start, end] = DOMAIN_RANGES[domainId.toString() as keyof typeof DOMAIN_RANGES];
        for (let i = start; i <= end; i++) {
          const subId = i.toString();
          if (adaptiveLearningData.subdomainScores[subId]) {
            adaptiveLearningData.subdomainScores[subId].competencyScore = percent;
            adaptiveLearningData.subdomainScores[subId].lastScoreUpdate = Date.now();
          }
        }
      };

      // Advanced Skill Tuning from PDF Data
      if (data.officialPdfData?.subscores && Object.keys(data.officialPdfData.subscores).length > 0) {
        const domainMap: Record<string, number> = {
          "Algebra": 0,
          "Advanced Math": 1,
          "Problem-Solving and Data Analysis": 2,
          "Geometry and Trigonometry": 3,
          "Information and Ideas": 4,
          "Craft and Structure": 5,
          "Expression of Ideas": 6,
          "Standard English Conventions": 7
        };

        const calculateDomainMastery = (scoreRange: string): number => {
          try {
            const [min, max] = scoreRange.split('-').map(Number);
            if (isNaN(min) || isNaN(max)) return 0;
            const midpoint = (min + max) / 2;
            return satScoreToMasteryPercent(midpoint);
          } catch {
            return 0;
          }
        };

        // Calculate raw masteries from extracted ranges
        const domainMasteries: Record<number, number> = {};
        Object.entries(data.officialPdfData.subscores).forEach(([name, range]) => {
          const id = domainMap[name];
          if (id !== undefined) {
            domainMasteries[id] = calculateDomainMastery(range);
          }
        });

        // Normalize Math (Domains 0-3) to match the overall section score
        const mathIds = [0, 1, 2, 3];
        // Calculate the average of the raw domain masteries we found. 
        // If a domain is missing from PDF (unlikely but possible), assume it aligns with the overall section mastery.
        const rawMathAvg = mathIds.reduce((sum, id) => sum + (domainMasteries[id] !== undefined ? domainMasteries[id] : mathMasteryPct), 0) / 4;
        
        // Calculate the offset needed to make the average match the actual section score's mastery
        const mathDiff = mathMasteryPct - rawMathAvg;
        
        mathIds.forEach(id => {
          // Apply the base mastery (specific or general) plus the normalization offset
          let adjusted = (domainMasteries[id] !== undefined ? domainMasteries[id] : mathMasteryPct) + mathDiff;
          // Clamp to valid range [0, 100]
          adjusted = Math.max(0, Math.min(100, Math.round(adjusted)));
          applyInitialToDomain(id, adjusted);
        });

        // Normalize R&W (Domains 4-7)
        const rwIds = [4, 5, 6, 7];
        const rawRwAvg = rwIds.reduce((sum, id) => sum + (domainMasteries[id] !== undefined ? domainMasteries[id] : rwMasteryPct), 0) / 4;
        const rwDiff = rwMasteryPct - rawRwAvg;

        rwIds.forEach(id => {
          let adjusted = (domainMasteries[id] !== undefined ? domainMasteries[id] : rwMasteryPct) + rwDiff;
          adjusted = Math.max(0, Math.min(100, Math.round(adjusted)));
          applyInitialToDomain(id, adjusted);
        });

      } else {
        // Fallback to flat distribution if no subscore data is available
        [0,1,2,3].forEach(d => applyInitialToDomain(d, mathMasteryPct));
        [4,5,6,7].forEach(d => applyInitialToDomain(d, rwMasteryPct));
      }

      // Calculate initial domain summaries.
      Object.entries(DOMAIN_RANGES).forEach(([domainId, range]) => {
        const [start, end] = range;
        let totalCompetency = 0;
        let count = 0;
        for (let i = start; i <= end; i++) {
          const subdomainId = i.toString();
          if (adaptiveLearningData.subdomainScores[subdomainId]) {
            totalCompetency += adaptiveLearningData.subdomainScores[subdomainId].competencyScore;
            count++;
          }
        }
        adaptiveLearningData.domainSummaries[domainId] = {
          domainId: parseInt(domainId),
          averageCompetency: count > 0 ? totalCompetency / count : 0,
          lastUpdated: new Date()
        };
      });

      // Set overall as the average of math and R&W domain averages
      const mathDomains = [0,1,2,3].map(d => adaptiveLearningData.domainSummaries[d.toString()]?.averageCompetency || 0);
      const rwDomains = [4,5,6,7].map(d => adaptiveLearningData.domainSummaries[d.toString()]?.averageCompetency || 0);
      const mathAvg = mathDomains.reduce((a,b)=>a+b,0) / (mathDomains.length || 1);
      const rwAvg = rwDomains.reduce((a,b)=>a+b,0) / (rwDomains.length || 1);
      adaptiveLearningData.overallCompetency = Math.round((mathAvg + rwAvg) / 2);

      const curriculumMap: { [key: string]: string } = {
        US: 'American',
        NG: 'Nigerian',
        GB: 'British',
      };
      const selectedCurriculum = data.curriculum;
      const isStandardCurriculum = ['US', 'NG', 'GB'].includes(selectedCurriculum);

      // Assemble the final user data object to be saved.
      // Commitment computations
      const todayIso = new Date().toISOString().split('T')[0];
      const currentSatTotal = initMathScore + initRwScore;
      const hoursNeeded = computeHoursNeeded(currentSatTotal, data.goalScore);
      const totalMinutesNeeded = Math.max(0, Math.round(hoursNeeded * 60));
      const goalDateIso = data.goalDate || todayIso;
      const availableDays = countAvailableDays(todayIso, goalDateIso, data.practiceDays || Array(7).fill(false));
      const minutesPerSelectedDay = availableDays > 0 ? Math.ceil(totalMinutesNeeded / availableDays) : 0;

      const userData = {
        uid: user.uid,
        email: user.email,
        name: data.name,
        username: data.username.toLowerCase(),
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        country: data.country,
        language: data.language,
        culture: isStandardCurriculum ? selectedCurriculum : data.country,
        curriculum: isStandardCurriculum 
          ? curriculumMap[selectedCurriculum as keyof typeof curriculumMap] 
          : (selectedCurriculum === 'Other' ? data.customCurriculum : selectedCurriculum),
        school: data.country === 'US' && data.school === 'Other' ? (data.schoolName || '') : data.school,
        avatarIcon: data.avatarIcon,
        avatarColor: data.avatarColor,
        hasTakenSAT: data.hasTakenSAT,
        satScores: data.hasTakenSAT === 'yes' ? {
          math: data.satMathScore,
          readingAndWriting: data.satRWScore,
          month: data.satMonth,
          year: data.satYear
        } : (data.hasTakenSAT === 'psat' ? {
          psat: true,
          math: data.psatMathScore,
          readingAndWriting: data.psatRWScore,
          month: data.psatMonth,
          year: data.psatYear
        } : null),
        satFamiliarity: data.hasTakenSAT === 'no' ? data.satFamiliarity : null,
        practiceScores: data.hasTakenSAT === 'no' && data.satFamiliarity === 'have taken a practice test' ? {
          math: data.practiceMathScore,
          readingAndWriting: data.practiceRWScore,
          month: data.practiceMonth,
          year: data.practiceYear
        } : null,
        practiceHoursApprox: data.hasTakenSAT === 'no' && data.satFamiliarity === 'have started practicing' ? Number(data.practiceHoursApprox || 0) : null,
        confidence: {
          math: data.mathConfidence,
          readingWriting: data.rwConfidence,
        },
        // Store the tutor name using requested key with hyphen
        ['tutor-name']: (data.tutorName || 'Tutor').trim(),
        ['tutor-voice']: (data.tutorVoice || 'Kore').trim(),
        interests: data.interests || [],
        cheerLines: data.cheerLines || [],
        studyCommitment: {
          goalScore: data.goalScore || null,
          goalDate: goalDateIso,
          practiceDays: data.practiceDays,
          practiceTimes: data.practiceTimes,
          currentSatTotal,
          hoursNeeded,
          totalMinutesNeeded,
          availableDays,
          minutesPerSelectedDay,
        },
        adaptiveLearning: adaptiveLearningData,
        onboardingCompleted: true,
        createdAt: new Date(),
        lastLogin: new Date(),
      };

      console.log("Attempting to save user data:", JSON.stringify(userData, null, 2));

      // Save the user data to Firestore.
      await setDoc(doc(db, "users", user.uid), userData, { merge: true });

      // If we have an official PDF score, add it to the 'scores' collection/field for visualization
      if (data.officialPdfData && data.officialPdfData.totalScore) {
        try {
          const newScore = {
            math: data.officialPdfData.sectionScores?.math || 0,
            readingAndWriting: data.officialPdfData.sectionScores?.readingWriting || 0,
            testDate: data.officialPdfData.testDate || new Date().toISOString().split('T')[0],
            testType: 'official', // Official SAT from uploaded PDF
            notes: 'Imported from official score report PDF during onboarding',
            createdAt: new Date(),
            verified: true,
            pdfData: data.officialPdfData // Store the full scraped object for reference
          };
          
          // Use the same arrayUnion method as the scores page
          const { arrayUnion, updateDoc } = await import("firebase/firestore");
          await updateDoc(doc(db, "users", user.uid), {
            scores: arrayUnion(newScore),
            ['official-score-pdf']: data.officialPdfData // Also save to root as requested
          });
          console.log("Saved official PDF score to user profile");
        } catch (scoreErr) {
          console.error("Error saving official score from PDF:", scoreErr);
          // Don't block the main onboarding flow if this fails
        }
      }

      // Clear local storage
      localStorage.removeItem('onboarding_data');

      // Redirect to the dashboard with a flag to show the welcome experience.
      window.location.href = "/dashboard?new_user=true";

    } catch (err: any) {
      console.error("Error completing onboarding:", err);
      let detailedError = "An unknown error occurred.";
      if (err.code) {
        detailedError = `Error: ${err.message} (Code: ${err.code})`;
      } else if (err.message) {
        detailedError = err.message;
      }
      setError(`Failed to complete onboarding. Please try again. Details: ${detailedError}`);
      setIsSubmitting(false);
    }
  };

  /**
   * Renders the UI for the current step of the onboarding process.
   * @returns A React component for the current step.
   */
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600 dark:text-green-400"
              >
                <UserIcon className="w-8 h-8" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">Hi there! 👋</h2>
              <p className="text-lg text-muted-foreground">Let's get to know you. What should we call you?</p>
            </div>
            <div className="max-w-md mx-auto">
              <Input
                id="name"
                autoFocus
                type="text"
                placeholder="Your Name"
                value={data.name}
                onChange={(e) => updateData('name', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && nextStep()}
                className="text-2xl py-6 px-6 text-center shadow-sm border-2 focus-visible:ring-green-500 transition-all"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600 dark:text-green-400"
              >
                <UserIcon className="w-8 h-8" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">Nice to meet you, {data.name.split(' ')[0]}!</h2>
              <p className="text-lg text-muted-foreground">Now, pick a unique username for your profile.</p>
            </div>
            <div className="max-w-md mx-auto space-y-4">
              <Input
                id="username"
                autoFocus
                type="text"
                placeholder="username"
                value={data.username}
                onChange={(e) => updateData('username', e.target.value.toLowerCase())}
                onKeyDown={(e) => e.key === 'Enter' && nextStep()}
                className="text-2xl py-6 px-6 text-center shadow-sm border-2 focus-visible:ring-green-500 transition-all font-mono"
              />
              <p className="text-sm text-center text-muted-foreground">
                Lowercase letters, numbers, dots, and dashes only.
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400"
              >
                <Calendar className="w-8 h-8" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">A few details about you</h2>
              <p className="text-lg text-muted-foreground">When is your birthday?</p>
            </div>
            
            <div className="max-w-md mx-auto space-y-8">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth" className="text-base text-center block">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={data.dateOfBirth}
                  onChange={(e) => updateData('dateOfBirth', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="text-lg py-3 text-center"
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base text-center block">Gender</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <SelectionCard
                    title="Male"
                    selected={data.gender === 'male'}
                    onClick={() => updateData('gender', 'male')}
                  />
                  <SelectionCard
                    title="Female"
                    selected={data.gender === 'female'}
                    onClick={() => updateData('gender', 'female')}
                  />
                  <SelectionCard
                    title="Other"
                    selected={data.gender === 'other'}
                    onClick={() => updateData('gender', 'other')}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400"
              >
                <Globe className="w-8 h-8" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">Where are you learning from?</h2>
              <p className="text-lg text-muted-foreground">Help us customize your experience</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="space-y-2">
                <Label htmlFor="country" className="text-base font-medium">Country</Label>
                <div className="relative" ref={countryDropdownRef}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl">
                       {data.country ? filteredCountries.find(c => c.code === data.country)?.flag || '🌍' : '🌍'}
                    </span>
                    <Input
                      id="country"
                      type="text"
                      value={countrySearch}
                      onChange={(e) => {
                        setCountrySearch(e.target.value);
                        setShowCountryList(true);
                      }}
                      onFocus={() => setShowCountryList(true)}
                      placeholder="Search for your country..."
                      className="text-lg py-6 pl-12 shadow-sm"
                    />
                  </div>
                  {showCountryList && (
                    <div className="absolute z-50 w-full mt-2 bg-popover text-popover-foreground rounded-xl shadow-xl max-h-60 overflow-auto border border-border animate-in fade-in zoom-in-95 duration-200">
                      {filteredCountries.length > 0 ? (
                        filteredCountries.map(({ code, name, flag }) => (
                          <div
                            key={code}
                            onClick={() => {
                              updateData('country', code);
                              setCountrySearch(name);
                              setShowCountryList(false);
                            }}
                            className="flex items-center px-4 py-3 hover:bg-accent cursor-pointer transition-colors"
                          >
                            <span className="mr-3 text-2xl">{flag}</span>
                            <span className="font-medium">{name}</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-muted-foreground">No countries found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium block">Curriculum</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SelectionCard
                    title="American"
                    icon={<span className="text-2xl">🇺🇸</span>}
                    selected={data.curriculum === 'US'}
                    onClick={() => updateData('curriculum', 'US')}
                    className="min-h-[120px]"
                  />
                  <SelectionCard
                    title="Nigerian"
                    icon={<span className="text-2xl">🇳🇬</span>}
                    selected={data.curriculum === 'NG'}
                    onClick={() => updateData('curriculum', 'NG')}
                    className="min-h-[120px]"
                  />
                  <SelectionCard
                    title="British"
                    icon={<span className="text-2xl">🇬🇧</span>}
                    selected={data.curriculum === 'GB'}
                    onClick={() => updateData('curriculum', 'GB')}
                    className="min-h-[120px]"
                  />
                  <SelectionCard
                    title="Other"
                    icon={<span className="text-2xl">🌐</span>}
                    selected={data.curriculum === 'Other'}
                    onClick={() => updateData('curriculum', 'Other')}
                    className="min-h-[120px]"
                  />
                </div>
              </div>

              {data.curriculum === 'Other' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2 pt-2"
                >
                  <Label htmlFor="customCurriculum">Please specify your curriculum</Label>
                  <Input
                    id="customCurriculum"
                    value={data.customCurriculum}
                    onChange={(e) => updateData('customCurriculum', e.target.value)}
                    placeholder="e.g., IB, Canadian, Indian..."
                    className="py-6"
                  />
                </motion.div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto text-yellow-600 dark:text-yellow-400"
              >
                <GraduationCap className="w-8 h-8" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">What school do you attend?</h2>
              <p className="text-lg text-muted-foreground">We'll connect you with your classmates.</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-6">
              {data.country === 'US' ? (
                <div className="space-y-3">
                   {[...getAllowedSchools(), "Other"].map((schoolName) => (
                     <div 
                       key={schoolName}
                       className={cn(
                         "flex items-center p-4 border rounded-xl cursor-pointer transition-all hover:bg-accent",
                         data.school === schoolName ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                       )}
                       onClick={() => updateData('school', schoolName)}
                     >
                       <div className={cn(
                         "w-5 h-5 rounded-full border flex items-center justify-center mr-4",
                         data.school === schoolName ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                       )}>
                         {data.school === schoolName && <div className="w-2 h-2 rounded-full bg-white" />}
                       </div>
                       <span className="text-lg font-medium">{schoolName}</span>
                     </div>
                   ))}

                    {data.school === 'Other' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="pt-2 pl-2"
                      >
                        <Input
                          id="schoolName"
                          value={data.schoolName || ''}
                          onChange={(e) => updateData('schoolName', e.target.value)}
                          placeholder="Type your school name..."
                          className="py-6 text-lg"
                        />
                      </motion.div>
                    )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    id="school"
                    value={data.school}
                    onChange={(e) => updateData('school', e.target.value)}
                    placeholder="Enter your school name"
                    className="py-6 text-lg"
                  />
                  <p className="text-sm text-muted-foreground text-center">
                    If you are not currently enrolled, you can enter "Homeschooled" or "Self-studying".
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto text-purple-600 dark:text-purple-400"
              >
                <Palette className="w-8 h-8" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">Express yourself!</h2>
              <p className="text-lg text-muted-foreground">Customize your profile avatar.</p>
            </div>
            <AvatarCustomizer
              currentIcon={data.avatarIcon}
              currentColor={data.avatarColor}
              onIconChange={(icon) => updateData('avatarIcon', icon)}
              onColorChange={(color) => updateData('avatarColor', color)}
              showPreview={true}
            />
          </div>
        );

      case 7:
        return (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto text-orange-600 dark:text-orange-400"
              >
                <Target className="w-8 h-8" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">Your SAT Journey</h2>
              <p className="text-lg text-muted-foreground">Have you taken the test before?</p>
            </div>
            
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectionCard
                  title="Yes, the SAT"
                  description="I have an official score"
                  selected={data.hasTakenSAT === 'yes'}
                  onClick={() => updateData('hasTakenSAT', 'yes')}
                  className="min-h-[140px]"
                />
                <SelectionCard
                  title="Yes, the PSAT"
                  description="I have a PSAT score"
                  selected={data.hasTakenSAT === 'psat'}
                  onClick={() => updateData('hasTakenSAT', 'psat')}
                  className="min-h-[140px]"
                />
                <SelectionCard
                  title="Not yet"
                  description="This is my first time"
                  selected={data.hasTakenSAT === 'no'}
                  onClick={() => updateData('hasTakenSAT', 'no')}
                  className="min-h-[140px]"
                />
              </div>

              {/* Conditional Forms */}
              <AnimatePresence mode="wait">
                {data.hasTakenSAT === 'yes' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6 p-6 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50"
                  >
                    <h3 className="text-xl font-semibold text-center">Enter your most recent SAT scores</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="satMathScore">Math Score (200-800)</Label>
                        <Input
                          id="satMathScore"
                          type="number"
                          min="200"
                          max="800"
                          value={data.satMathScore || ''}
                          onChange={(e) => updateData('satMathScore', parseInt(e.target.value))}
                          placeholder="e.g., 650"
                          className="py-6 text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="satRWScore">Reading & Writing Score (200-800)</Label>
                        <Input
                          id="satRWScore"
                          type="number"
                          min="200"
                          max="800"
                          value={data.satRWScore || ''}
                          onChange={(e) => updateData('satRWScore', parseInt(e.target.value))}
                          placeholder="e.g., 680"
                          className="py-6 text-lg"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="satMonth">Month taken</Label>
                        <Select value={data.satMonth} onValueChange={(value) => updateData('satMonth', value)}>
                          <SelectTrigger className="py-6 text-lg">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                              <SelectItem key={month} value={month}>{month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="satYear">Year taken</Label>
                        <Select value={data.satYear?.toString()} onValueChange={(value) => updateData('satYear', parseInt(value))}>
                          <SelectTrigger className="py-6 text-lg">
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(year => (
                              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-blue-50/50 dark:bg-blue-950/20 px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="w-full border-dashed py-6 text-base"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Upload from CollegeBoard scores PDF
                    </Button>
                  </motion.div>
                )}

                {data.hasTakenSAT === 'psat' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6 p-6 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50"
                  >
                    <h3 className="text-xl font-semibold text-center">Enter your most recent PSAT scores</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="psatMathScore">Math Score (160-760)</Label>
                        <Input
                          id="psatMathScore"
                          type="number"
                          min="160"
                          max="760"
                          value={data.psatMathScore || ''}
                          onChange={(e) => updateData('psatMathScore', parseInt(e.target.value))}
                          placeholder="e.g., 520"
                          className="py-6 text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="psatRWScore">Reading & Writing Score (160-760)</Label>
                        <Input
                          id="psatRWScore"
                          type="number"
                          min="160"
                          max="760"
                          value={data.psatRWScore || ''}
                          onChange={(e) => updateData('psatRWScore', parseInt(e.target.value))}
                          placeholder="e.g., 540"
                          className="py-6 text-lg"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="psatMonth">Month taken</Label>
                        <Select value={data.psatMonth} onValueChange={(value) => updateData('psatMonth', value)}>
                          <SelectTrigger className="py-6 text-lg">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                              <SelectItem key={month} value={month}>{month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="psatYear">Year taken</Label>
                        <Select value={data.psatYear?.toString()} onValueChange={(value) => updateData('psatYear', parseInt(value))}>
                          <SelectTrigger className="py-6 text-lg">
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(year => (
                              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {data.hasTakenSAT === 'no' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-4">
                      <Label className="text-lg text-center block">How familiar are you with the SAT?</Label>
                      <div className="grid grid-cols-1 gap-3">
                        <div 
                           className={cn(
                             "flex items-center p-4 border rounded-xl cursor-pointer transition-all hover:bg-accent",
                             data.satFamiliarity === "haven't practiced" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                           )}
                           onClick={() => updateData('satFamiliarity', "haven't practiced")}
                        >
                           <div className="w-5 h-5 rounded-full border flex items-center justify-center mr-4 shrink-0">
                             {data.satFamiliarity === "haven't practiced" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                           </div>
                           <span>I haven't practiced for the SAT before</span>
                        </div>

                        <div 
                           className={cn(
                             "flex items-center p-4 border rounded-xl cursor-pointer transition-all hover:bg-accent",
                             data.satFamiliarity === "have started practicing" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                           )}
                           onClick={() => updateData('satFamiliarity', "have started practicing")}
                        >
                           <div className="w-5 h-5 rounded-full border flex items-center justify-center mr-4 shrink-0">
                             {data.satFamiliarity === "have started practicing" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                           </div>
                           <span>I have started practicing</span>
                        </div>

                        <div 
                           className={cn(
                             "flex items-center p-4 border rounded-xl cursor-pointer transition-all hover:bg-accent",
                             data.satFamiliarity === "have taken a practice test" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                           )}
                           onClick={() => updateData('satFamiliarity', "have taken a practice test")}
                        >
                           <div className="w-5 h-5 rounded-full border flex items-center justify-center mr-4 shrink-0">
                             {data.satFamiliarity === "have taken a practice test" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                           </div>
                           <span>I have taken a practice test</span>
                        </div>
                      </div>
                    </div>

                    {data.satFamiliarity === 'have taken a practice test' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-6 pt-4 border-t"
                      >
                        <h4 className="font-semibold text-center">Your practice test scores</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="practiceMathScore">Math Score (200-800)</Label>
                            <Input
                              id="practiceMathScore"
                              type="number"
                              min="200"
                              max="800"
                              value={data.practiceMathScore || ''}
                              onChange={(e) => updateData('practiceMathScore', parseInt(e.target.value))}
                              placeholder="e.g., 600"
                              className="py-6 text-lg"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="practiceRWScore">Reading & Writing Score (200-800)</Label>
                            <Input
                              id="practiceRWScore"
                              type="number"
                              min="200"
                              max="800"
                              value={data.practiceRWScore || ''}
                              onChange={(e) => updateData('practiceRWScore', parseInt(e.target.value))}
                              placeholder="e.g., 620"
                              className="py-6 text-lg"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="practiceMonth">Month taken</Label>
                            <Select value={data.practiceMonth} onValueChange={(value) => updateData('practiceMonth', value)}>
                              <SelectTrigger className="py-6 text-lg">
                                <SelectValue placeholder="Select month" />
                              </SelectTrigger>
                              <SelectContent>
                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                                  <SelectItem key={month} value={month}>{month}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="practiceYear">Year taken</Label>
                            <Select value={data.practiceYear?.toString()} onValueChange={(value) => updateData('practiceYear', parseInt(value))}>
                              <SelectTrigger className="py-6 text-lg">
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {data.satFamiliarity === 'have started practicing' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2 pt-4 border-t"
                      >
                        <Label htmlFor="practiceHours">About how many hours have you practiced?</Label>
                        <Input
                          id="practiceHours"
                          type="number"
                          min="0"
                          value={data.practiceHoursApprox ?? ''}
                          onChange={(e) => updateData('practiceHoursApprox', Math.max(0, parseInt(e.target.value || '0')))}
                          placeholder="e.g., 15"
                          className="py-6 text-lg"
                        />
                        <p className="text-xs text-muted-foreground">We'll use this to slightly boost your starting estimate.</p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400"
              >
                <TrendingUp className="w-8 h-8" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">Self-Assessment</h2>
              <p className="text-lg text-muted-foreground">How confident do you feel right now?</p>
            </div>
            
            <div className="max-w-3xl mx-auto space-y-10">
              <div className="space-y-4">
                <Label className="text-xl font-semibold flex items-center gap-2">
                   <span className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-md">📐</span> Math Section
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((level) => (
                    <SelectionCard
                      key={level}
                      title={level.toString()}
                      description={
                        level === 1 ? "Not confident" :
                        level === 2 ? "Somewhat confident" :
                        level === 3 ? "Confident" : "Very confident"
                      }
                      selected={data.mathConfidence === level}
                      onClick={() => updateData('mathConfidence', level)}
                      className="min-h-[100px]"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-xl font-semibold flex items-center gap-2">
                   <span className="p-2 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 rounded-md">✍️</span> Reading & Writing
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((level) => (
                    <SelectionCard
                      key={level}
                      title={level.toString()}
                      description={
                        level === 1 ? "Not confident" :
                        level === 2 ? "Somewhat confident" :
                        level === 3 ? "Confident" : "Very confident"
                      }
                      selected={data.rwConfidence === level}
                      onClick={() => updateData('rwConfidence', level)}
                      className="min-h-[100px]"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 9:
        // Your Commitment step (3 sub-stages)
        {
          const todayIso = new Date().toISOString().split('T')[0];
          const currentTotal = computeCurrentSatTotal();
          const hoursNeeded = computeHoursNeeded(currentTotal, data.goalScore);
          const minutesNeeded = Math.max(0, Math.round(hoursNeeded * 60));
          const available = countAvailableDays(todayIso, data.goalDate || todayIso, data.practiceDays);
          const perDayMinutes = available > 0 ? Math.ceil(minutesNeeded / available) : 0;
          const dayInitials = ['S','M','T','W','T','F','S'];

          return (
            <div className="space-y-8 py-4">
              <div className="text-center space-y-4">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto text-teal-600 dark:text-teal-400"
                >
                  <Target className="w-8 h-8" />
                </motion.div>
                <h2 className="text-3xl font-bold tracking-tight">Your Commitment</h2>
                <p className="text-lg text-muted-foreground">
                  {commitmentStage === 1 && "Set your goal score and target test date."}
                  {commitmentStage === 2 && "When can you practice?"}
                  {commitmentStage === 3 && "Here’s your personalized plan."}
                </p>
              </div>

              <AnimatePresence mode="wait">
                {commitmentStage === 1 && (
                  <motion.div 
                    key="stage1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="space-y-4 p-8 border-2 border-teal-500/30 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl">
                      <Label htmlFor="goalScore" className="text-2xl font-semibold text-center block text-teal-800 dark:text-teal-200">I want to score...</Label>
                      <Input
                        id="goalScore"
                        type="number"
                        step={10}
                        value={(data.goalScore ?? computeCurrentSatTotal())}
                        onChange={(e) => updateData('goalScore', Number(e.target.value || computeCurrentSatTotal()))}
                        placeholder="e.g., 1400"
                        className="text-5xl md:text-6xl h-24 px-4 text-center leading-none font-bold border-none shadow-none bg-transparent focus-visible:ring-0 text-teal-600"
                      />
                      <p className="text-center text-muted-foreground">Current estimate: {computeCurrentSatTotal()}</p>
                    </div>
                    <div className="space-y-4 p-6 border rounded-2xl bg-muted/30">
                      <Label htmlFor="goalDate" className="text-xl font-semibold text-center block">By when?</Label>
                      <Input
                        id="goalDate"
                        type="date"
                        value={data.goalDate || ''}
                        min={todayIso}
                        onChange={(e) => updateData('goalDate', e.target.value)}
                        className="text-2xl h-16 px-4 text-center leading-none"
                      />
                    </div>
                  </motion.div>
                )}

                {commitmentStage === 2 && (
                  <motion.div 
                    key="stage2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="space-y-4">
                      <Label className="text-xl text-center block">Which days can you practice?</Label>
                      <div className="flex flex-wrap justify-center gap-3">
                        {dayInitials.map((d, idx) => (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            key={idx}
                            type="button"
                            className={cn(
                              'w-14 h-14 rounded-full border-2 text-lg font-bold flex items-center justify-center transition-all',
                              data.practiceDays[idx] 
                                ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-500/30' 
                                : 'bg-background hover:bg-muted border-muted-foreground/30'
                            )}
                            onClick={() => {
                              const next = [...data.practiceDays];
                              next[idx] = !next[idx];
                              updateData('practiceDays', next);
                            }}
                          >
                            {d}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {data.practiceDays.some(Boolean) && (
                       <motion.div 
                         initial={{ opacity: 0, height: 0 }}
                         animate={{ opacity: 1, height: 'auto' }}
                         className="space-y-4 border-t pt-6"
                       >
                        <Label className="text-lg text-center block mb-4">Preferred practice time</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {dayInitials.map((d, idx) => (
                            data.practiceDays[idx] ? (
                              <div key={`time-${idx}`} className="flex items-center justify-between gap-3 p-3 border rounded-xl bg-card">
                                <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 flex items-center justify-center text-sm font-bold shrink-0">{d}</div>
                                <Input
                                  type="time"
                                  value={data.practiceTimes[idx] || '20:00'}
                                  onChange={(e) => {
                                    const next = [...data.practiceTimes];
                                    next[idx] = e.target.value || '20:00';
                                    updateData('practiceTimes', next);
                                  }}
                                  className="flex-1 h-9 text-base border-none shadow-none focus-visible:ring-0 text-right"
                                />
                              </div>
                            ) : null
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {commitmentStage === 3 && (
                  <motion.div 
                    key="stage3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="p-6 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 rounded-2xl text-center space-y-2">
                       <Clock className="w-8 h-8 mx-auto text-teal-600 mb-2" />
                       <div className="text-3xl font-bold text-teal-900 dark:text-teal-100">{hoursNeeded.toFixed(1)} hours</div>
                       <p className="text-teal-700 dark:text-teal-300">Total practice time needed</p>
                    </div>

                    <div className="p-6 border rounded-2xl space-y-4">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
                           <Calendar className="w-6 h-6 text-blue-600" />
                         </div>
                         <div>
                            <div className="font-semibold text-lg">{available} Days</div>
                            <div className="text-sm text-muted-foreground">Available until your goal date</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center shrink-0">
                           <Clock className="w-6 h-6 text-purple-600" />
                         </div>
                         <div>
                            <div className="font-semibold text-lg">{formatMinutes(perDayMinutes)} / day</div>
                            <div className="text-sm text-muted-foreground">Recommended daily practice</div>
                         </div>
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full py-6 text-lg border-2 hover:bg-muted"
                      onClick={() => {
                        const todayIso = new Date().toISOString().split('T')[0];
                        const ics = generateCalendarIcs(
                          data.practiceDays,
                          data.practiceTimes,
                          perDayMinutes,
                          todayIso,
                          data.goalDate || todayIso
                        );
                        downloadIcs('sat-practice.ics', ics);
                      }}
                    >
                      📅 Add to Calendar
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }

      case 10:
        return (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto text-cyan-600 dark:text-cyan-400"
              >
                <Bot className="w-8 h-8" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">Meet your AI Tutor</h2>
              <p className="text-lg text-muted-foreground">Give your personal study companion a name.</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="space-y-2">
                <Input
                  id="tutorName"
                  type="text"
                  placeholder="Name your tutor (e.g. Jarvis)"
                  value={data.tutorName || ''}
                  onChange={(e) => updateData('tutorName', e.target.value)}
                  className="text-2xl py-6 px-6 text-center shadow-sm border-2 focus-visible:ring-cyan-500 transition-all"
                  maxLength={40}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-lg font-semibold text-center block">Choose a voice</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Puck','Charon','Kore','Fenrir', 'Aoede','Leda','Orus','Zephyr'].map((voice) => (
                    <div 
                       key={voice}
                       className={cn(
                         "relative group cursor-pointer border-2 rounded-xl p-3 text-center transition-all hover:border-cyan-400/50 hover:bg-accent",
                         data.tutorVoice === voice ? "border-cyan-600 bg-cyan-50/50 dark:bg-cyan-900/20 shadow-md ring-1 ring-cyan-600" : "border-muted"
                       )}
                       onClick={() => handleSelectVoice(voice)}
                    >
                      <div className="mb-2 w-10 h-10 mx-auto rounded-full bg-muted flex items-center justify-center text-lg">
                        {['Aoede','Leda','Orus','Zephyr'].includes(voice) ? '♀️' : '♂️'}
                      </div>
                      <div className="font-semibold text-sm mb-1">{voice}</div>
                      <div className="text-xs text-muted-foreground group-hover:text-cyan-600">
                        {data.tutorVoice === voice ? 'Selected' : 'Click to preview'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 11:
        return (
          <div className="space-y-8 py-4 h-full flex flex-col">
            <div className="text-center space-y-4 shrink-0">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center mx-auto text-pink-600 dark:text-pink-400"
              >
                <MessageCircle className="w-8 h-8" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">Let's get to know you!</h2>
              <p className="text-lg text-muted-foreground">Tell your tutor about your hobbies and interests.</p>
            </div>
            
            <div className="max-w-2xl mx-auto w-full space-y-6">
              <div className="space-y-2">
                <Label className="text-lg font-medium">What do you like to do for fun?</Label>
                <Input 
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !showFollowUp && nextStep()}
                  placeholder="I like playing soccer, reading sci-fi, watching movies..."
                  className="py-6 text-lg"
                  autoFocus
                  disabled={showFollowUp || isInterestLoading}
                />
              </div>

              <AnimatePresence>
                {showFollowUp && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 pt-2"
                  >
                    <Label className="text-lg font-medium">{data.interestsQuestion}</Label>
                    <Input 
                      value={data.interestsAnswer || ''}
                      onChange={(e) => updateData('interestsAnswer', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && nextStep()}
                      placeholder="Type your answer..."
                      className="py-6 text-lg"
                      autoFocus
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          </div>
        );

      case 12:
        return (
          <div className="space-y-8 py-10">
            <div className="text-center space-y-6 max-w-lg mx-auto">
              <motion.div 
                initial={{ rotate: -10, scale: 0.9 }}
                animate={{ rotate: 0, scale: 1 }}
                className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto text-yellow-600 dark:text-yellow-400"
              >
                <AlertTriangle className="w-10 h-10" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight">One last thing...</h2>
              <div className="space-y-4 text-lg text-muted-foreground bg-muted/30 p-6 rounded-2xl border">
                <p>
                  <strong className="text-foreground">CultivatED is in Beta.</strong>
                </p>
                <p>
                  You might see some bugs or rough edges. We're working hard to fix them!
                </p>
                <p>
                  If you spot anything, please let us know using the feedback button.
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {isSubmitting ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full"
          >
            <Card className="w-full overflow-hidden">
              <CardContent className="p-6 sm:p-10">
                <div className="space-y-6 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mb-6" />
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Building Your Plan</h2>
                    <p className="text-muted-foreground mt-4 text-lg">We're analyzing your goals and crafting the perfect curriculum...</p>
                  </div>
                  <div className="space-y-2 max-w-xs mx-auto">
                    <Progress value={66} className="h-2.5 transition-all duration-500 ease-out" />
                    <p className="text-sm text-muted-foreground">Finalizing...</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            <div className="mb-8 px-2">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-3">
                <span>Step {currentStep} of {TOTAL_STEPS}</span>
                <span>{Math.round((currentStep / TOTAL_STEPS) * 100)}%</span>
              </div>
              <Progress value={(currentStep / TOTAL_STEPS) * 100} className="h-2.5 transition-all duration-500 ease-out" />
            </div>

            <Card className="w-full overflow-hidden">
              <CardContent className="p-0">
                <div className="relative min-h-[400px] p-6 sm:p-10">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="w-full"
                    >
                      {renderStep()}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="px-6 sm:px-10 pb-10 pt-0">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-6 flex items-center gap-3 text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/30 p-4 rounded-xl border border-red-100 dark:border-red-900"
                    >
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      {error}
                    </motion.div>
                  )}

                  <div className="flex justify-between mt-4 pt-6 border-t">
                    <Button
                      variant="ghost"
                      onClick={prevStep}
                      disabled={currentStep === 1}
                      className={cn(
                        "flex items-center text-muted-foreground hover:text-foreground pl-0 hover:bg-transparent",
                        currentStep === 1 && "invisible"
                      )}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>

                    {currentStep === TOTAL_STEPS ? (
                      <Button
                        onClick={submitOnboarding}
                        disabled={isSubmitting}
                        className="flex items-center px-8 py-6 text-lg rounded-full shadow-lg shadow-green-500/20"
                      >
                        Complete Setup
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    ) : (
                      <Button
                        onClick={nextStep}
                        disabled={isInterestLoading}
                        className="flex items-center px-8 py-6 text-lg rounded-full shadow-lg shadow-primary/20"
                      >
                        {isInterestLoading ? (
                          <>
                            <Loading size="sm" className="mr-2" />
                            Loading...
                          </>
                        ) : (
                          <>
                            Next Step
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      <ScoreUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFileSelect={handleScoreFileUpload}
      />
    </div>
  );
}
