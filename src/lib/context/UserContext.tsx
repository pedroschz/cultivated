"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, app } from '@/lib/firebaseClient';
import { DEFAULT_AVATAR } from '@/lib/constants/avatar';

export interface AiUsage {
  voiceCalls: number;
  chatMessages: number;
  totalCostCents: number;
  lastUsageAt?: any;
}

interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  userName: string | null;
  userUsername: string | null;
  userAvatarIcon: string | null;
  userAvatarColor: string | null;
  tutorName: string;
  tutorVoice?: string;
  schoolId: string | null;
  role?: string | null;
  practiceTextSize?: number; // 1-5, default 2
  aiUsage: AiUsage;
  geminiApiKey: string | null;
  quickOnboardingCompleted: boolean;
  onboardingCompleted: boolean;
}

interface UserContextType {
  user: User | null;
  userData: UserData | null;
  isLoading: boolean;
  refreshUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser) {
        setUserData(null);
        setIsLoading(false);
        return;
      }

      // Initial fetch
      await fetchUserData(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen for real-time updates to the user document
  useEffect(() => {
    if (!user || !app) return;

    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);

    const unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        updateLocalUserData(user, data);
      }
    }, (error) => {
      console.error("Error listening to user data:", error);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  const updateLocalUserData = (currentUser: User, data: any) => {
    const raw = data.aiUsage;
    setUserData({
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      userName: data.name || currentUser.displayName || 'Valued User',
      userUsername: data.username || null,
      userAvatarIcon: data.avatarIcon || DEFAULT_AVATAR.icon,
      userAvatarColor: data.avatarColor || DEFAULT_AVATAR.color,
      tutorName: (data['tutor-name'] as string)?.trim() || 'My Tutor',
      tutorVoice: (data['tutor-voice'] as string)?.trim(),
      schoolId: data.schoolId || null,
      role: data.role || null,
      practiceTextSize: data.practiceTextSize || 2,
      aiUsage: {
        voiceCalls: raw?.voiceCalls ?? 0,
        chatMessages: raw?.chatMessages ?? 0,
        totalCostCents: raw?.totalCostCents ?? 0,
        lastUsageAt: raw?.lastUsageAt ?? null,
      },
      geminiApiKey: data.geminiApiKey || null,
      quickOnboardingCompleted: data.quickOnboardingCompleted === true || data.onboardingCompleted === true,
      onboardingCompleted: data.onboardingCompleted === true,
    });
  };

  const fetchUserData = async (currentUser: User) => {
    if (!app) return;
    
    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(userRef);
      
      if (snap.exists()) {
        updateLocalUserData(currentUser, snap.data());
      } else {
        setUserData({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          userName: currentUser.displayName || 'Valued User',
          userUsername: null,
          userAvatarIcon: DEFAULT_AVATAR.icon,
          userAvatarColor: DEFAULT_AVATAR.color,
          tutorName: 'My Tutor',
          schoolId: null,
          aiUsage: { voiceCalls: 0, chatMessages: 0, totalCostCents: 0 },
          geminiApiKey: null,
          quickOnboardingCompleted: false,
          onboardingCompleted: false,
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user);
    }
  };

  return (
    <UserContext.Provider value={{ user, userData, isLoading, refreshUserData }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
