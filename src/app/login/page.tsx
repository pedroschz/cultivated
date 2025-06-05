"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebaseClient"; 
import { signInWithEmailAndPassword } from "firebase/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!auth) {
      setError("Firebase auth is not initialized. Check your firebaseClient.ts configuration.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        const idToken = await user.getIdToken();

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
          case 'auth/invalid-email':
            setError('The email address is not valid.');
            break;
          case 'auth/user-disabled':
            setError('This user account has been disabled.');
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password': // or auth/invalid-credential since Firebase v9.6.0 for login
            setError('Invalid email or password.');
            break;
          case 'auth/invalid-credential': // General invalid credential error
             setError('Invalid email or password.');
             break;
          default:
            setError("An error occurred during login. Please try again.");
        }
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
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
            disabled={loading}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "10px 15px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          {loading ? "Logging In..." : "Login"}
        </button>
      </form>
      <p style={{ marginTop: "15px" }}>
        Don\'t have an account? <a href="/signup">Sign Up</a>
      </p>
    </div>
  );
} 