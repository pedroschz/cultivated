"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient"; 
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { countries } from 'countries-list';

// Convert country code to flag emoji
const getFlagEmoji = (countryCode: string) => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Convert countries object to sorted array of { code, name }
const countryList = Object.entries(countries)
  .map(([code, country]) => ({
    code,
    name: country.name,
    flag: getFlagEmoji(code)
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isMale, setIsMale] = useState<boolean | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Username validation function
  const validateUsername = (username: string): boolean => {
    // Must contain at least one letter
    if (!/[a-z]/.test(username)) return false;
    
    // Only allow lowercase letters, numbers, dots, and dashes
    if (!/^[a-z0-9.-]+$/.test(username)) return false;
    
    // Can't start or end with dash or dot
    if (/^[-.]|[-.]$/.test(username)) return false;
    
    return true;
  };

  // Filter countries based on search
  const filteredCountries = countryList.filter(country => 
    country.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Handle click outside to close dropdown
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!auth || !db) {
      setError("Firebase is not initialized. Check your firebaseClient.ts configuration.");
      setLoading(false);
      return;
    }

    if (!username) {
      setError("Please enter a username");
      setLoading(false);
      return;
    }

    if (!validateUsername(username)) {
      setError("Username must be lowercase, contain at least one letter, and can only include letters, numbers, dots, and dashes. It cannot start or end with a dash or dot.");
      setLoading(false);
      return;
    }

    // Check if username is already taken
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setError("This username is already taken. Please choose a different one.");
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("Error checking username:", err);
      setError("An error occurred while checking username availability. Please try again.");
      setLoading(false);
      return;
    }

    if (isMale === null) {
      setError("Please select your gender");
      setLoading(false);
      return;
    }

    if (!dateOfBirth) {
      setError("Please enter your date of birth");
      setLoading(false);
      return;
    }

    if (!country) {
      setError("Please enter your country");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        // Update Firebase user profile with the name
        await updateProfile(user, { displayName: name });

        // Create user document in Firestore
        const userData = {
          uid: user.uid,
          email: email,
          name: name,
          username: username.toLowerCase(), // Store username in lowercase
          isMale: isMale,
          dateOfBirth: dateOfBirth,
          country: country,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          questionQueue: [],
          history: [],
          stats: {
            totalAnswered: 0,
            correctAnswers: 0,
            accuracy: 0,
            averageTime: 0,
            domains: {}
          },
          bookmarks: [],
          settings: {
            darkMode: false,
            showTimer: true
          },
          lastQuestionId: null,
          isPremium: false
        };

        await setDoc(doc(db, "users", user.uid), userData);

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
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-center">Sign Up</h1>
      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            required
            disabled={loading}
            pattern="[a-z0-9.-]+"
            title="Username must be lowercase and can only include letters, numbers, dots, and dashes"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Username must be lowercase, contain at least one letter, and can only include letters, numbers, dots, and dashes.
            It cannot start or end with a dash or dot.
          </p>
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Gender:</label>
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="gender"
                checked={isMale === true}
                onChange={() => setIsMale(true)}
                disabled={loading}
                className="form-radio h-4 w-4 text-blue-600"
              />
              <span className="ml-2">Male</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="gender"
                checked={isMale === false}
                onChange={() => setIsMale(false)}
                disabled={loading}
                className="form-radio h-4 w-4 text-blue-600"
              />
              <span className="ml-2">Female</span>
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">Date of Birth:</label>
          <input
            type="date"
            id="dateOfBirth"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
            disabled={loading}
            max={new Date().toISOString().split('T')[0]} // Using local time for client-side date validation
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700">Country:</label>
          <div className="relative" ref={countryDropdownRef}>
            <input
              type="text"
              id="country"
              value={countrySearch}
              onChange={(e) => {
                setCountrySearch(e.target.value);
                setShowCountryList(true);
              }}
              onFocus={() => setShowCountryList(true)}
              placeholder="Search for a country..."
              required
              disabled={loading}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {showCountryList && (
              <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map(({ code, name, flag }) => (
                    <div
                      key={code}
                      onClick={() => {
                        setCountry(code);
                        setCountrySearch(name);
                        setShowCountryList(false);
                      }}
                      className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      <span className="mr-2 text-xl">{flag}</span>
                      <span>{name}</span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2 text-gray-500">No countries found</div>
                )}
              </div>
            )}
          </div>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? "Signing Up..." : "Sign Up"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <a href="/login" className="text-blue-500 hover:text-blue-600">
          Login
        </a>
      </p>
    </div>
  );
} 