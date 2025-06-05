"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth'; // Import onAuthStateChanged and User type
import { auth } from '../../lib/firebaseClient'; // Corrected import path

export default function DashboardPage() {
  const [userName, setUserName] = useState<string | null>(null); // Initialize to null
  const router = useRouter();
  const [showPracticeOptions, setShowPracticeOptions] = useState(false);

  useEffect(() => {
    if (!auth) {
      console.log("Firebase auth is not initialized. Displaying default user name.");
      setUserName("Valued User"); // Fallback if auth is not available
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        // User is signed in
        setUserName(user.displayName || "Valued User");
      } else {
        // User is signed out
        console.log("No user signed in. Redirect should be handled by middleware. Displaying default user name.");
        setUserName("Valued User"); // Fallback or handle redirection
        // router.push('/login'); // This redirection should ideally be handled by middleware
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    if (auth) {
      try {
        await auth.signOut();
        console.log("User signed out from Firebase");
      } catch (error) {
        console.error("Error signing out from Firebase: ", error);
      }
    }
    router.push('/login');
  };

  // if (!userName) {
  //   // This is a simple loading state or if user is not found (though middleware should handle unauth)
  //   return <p>Loading...</p>; 
  // }

  return (
    <div style={{ position: "relative", minHeight: "100vh", padding: "20px" }}>
      <button 
        onClick={handleLogout}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          padding: "10px 15px",
          backgroundColor: "red",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }}
      >
        Logout
      </button>

      <div style={{ maxWidth: "800px", margin: "50px auto", padding: "20px", textAlign: "left" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "20px" }}>
          {userName ? `Hi, ${userName}!` : 'Loading user...'}
        </h1>
        <p style={{ marginBottom: "30px" }}>This is your personal space. More features coming soon!</p>

        <div 
          style={{ marginTop: "30px", position: "relative" }}
        >
          <button
            onMouseEnter={() => setShowPracticeOptions(true)}
            onMouseLeave={() => setShowPracticeOptions(false)}
            style={{
              padding: "12px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px"
            }}
          >
            Start Practice
          </button>
          {showPracticeOptions && (
            <div 
              onMouseEnter={() => setShowPracticeOptions(true)}
              onMouseLeave={() => setShowPracticeOptions(false)}
              style={{
                position: "absolute",
                top: "100%", 
                left: "0",
                marginTop: "5px",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                backgroundColor: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "10px",
                boxShadow: "0px 4px 8px rgba(0,0,0,0.1)",
                zIndex: 10
              }}
            >
              <button 
                onClick={() => router.push('/practice?time=15')}
                style={{ padding: "8px 12px", backgroundColor: "#f0f0f0", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                15 mins
              </button>
              <button 
                onClick={() => router.push('/practice?time=30')}
                style={{ padding: "8px 12px", backgroundColor: "#f0f0f0", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                30 mins
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}