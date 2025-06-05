"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// We would ideally get user info from a verified token or a client-side store
// For now, this is a placeholder

export default function DashboardPage() {
  const [userName, setUserName] = useState<string | null>(null);
  const router = useRouter();

  // Placeholder for fetching user data or checking auth status client-side
  // In a real app, you might get this from a context, a store, or by decoding the token (if safe to do so client-side)
  useEffect(() => {
    // Simulate fetching user data
    // This is NOT secure and just for illustrative purposes.
    // Auth check should happen in middleware and/or server components.
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    if (!token) {
      // router.push('/login'); // This redirection should ideally be handled by middleware
      console.log("No token found, redirect should be handled by middleware.")
    } else {
      // In a real app, you'd verify the token and get user details.
      // For now, let's just assume a user name.
      setUserName("Valued User"); 
    }
  }, [router]);

  const handleLogout = async () => {
    // Clear the cookie by calling an API route or by setting expiry to the past
    // For now, just redirect to login and simulate cookie removal for client
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push('/login');
  };

  // if (!userName) {
  //   // This is a simple loading state or if user is not found (though middleware should handle unauth)
  //   return <p>Loading...</p>; 
  // }

  return (
    <div style={{ maxWidth: "600px", margin: "50px auto", padding: "20px", textAlign: "center" }}>
      <h1>Welcome to Your Dashboard{userName ? `, ${userName}` : ''}!</h1>
      <p>This is your personal space. More features coming soon!</p>
      <button 
        onClick={handleLogout}
        style={{ marginTop: "20px", padding: "10px 15px", backgroundColor: "red", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
      >
        Logout
      </button>
    </div>
  );
}