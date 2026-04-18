"use client";

import { useEffect } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

export function OnlineHeartbeat() {
  useEffect(() => {
    if (!auth) return;

    let intervalId: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Initial update
        updateHeartbeat(user.uid);

        // Update every 2 minutes
        intervalId = setInterval(() => {
          updateHeartbeat(user.uid);
        }, 2 * 60 * 1000);
      } else {
        if (intervalId) clearInterval(intervalId);
      }
    });

    return () => {
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const updateHeartbeat = async (uid: string) => {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        lastSeen: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating heartbeat:", error);
    }
  };

  return null;
}
