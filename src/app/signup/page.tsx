"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebaseClient"; 
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!auth) {
      setError("Firebase auth is not initialized. Check your firebaseClient.ts configuration.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        // Update Firebase user profile with the name
        await updateProfile(user, { displayName: name });

        const idToken = await user.getIdToken();

        // Call your API to set the session cookie
        const res = await fetch("/api/set-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: idToken }),
        });

        if (res.ok) {
          router.push("/dashboard");
        } else {
          const data = await res.json();
          setError(data.error || "Failed to set session token.");
        }
      }
    } catch (err: any) {
      // Handle Firebase errors
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            setError('This email address is already in use.');
            break;
          case 'auth/invalid-email':
            setError('The email address is not valid.');
            break;
          case 'auth/operation-not-allowed':
            setError('Email/password accounts are not enabled.');
            break;
          case 'auth/weak-password':
            setError('The password is too weak.');
            break;
          default:
            setError("An error occurred during sign up. Please try again.");
        }
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
      console.error("Signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h1>Sign Up</h1>
      <form onSubmit={handleSignUp}>
        <div style={{ marginBottom: "10px" }}>
          <label htmlFor="name">Name:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "10px 15px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          {loading ? "Signing Up..." : "Sign Up"}
        </button>
      </form>
      <p style={{ marginTop: "15px" }}>
        Already have an account? <a href="/login">Login</a>
      </p>
    </div>
  );
} 