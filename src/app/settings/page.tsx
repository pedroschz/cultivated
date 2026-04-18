/**
 * @file This file implements the comprehensive user settings page where users can
 * manage their account preferences, personal information, and application settings.
 * It includes profile editing, avatar customization, AI tutor settings, password
 * changes, data reset options, and account deletion. The page provides a complete
 * user management interface with real-time updates and validation.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, onAuthStateChanged, deleteUser, updateProfile, updatePassword } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc, getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import countryList from 'country-list';
import { auth, app } from "@/lib/firebaseClient";
import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";
import { 
  Button,
  Input,
  Label,
  Switch
} from "@/components";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { toast } from "sonner";
import { resetUserStats } from "@/lib/utils/resetUserData";
import { Loading } from "@/components/ui/loading";
import { ReportBugDialog } from "@/components/ReportBugDialog";
import { UsageBar } from "@/components/ai/UsageBar";
import { getFunctions, httpsCallable } from "firebase/functions";
import { AvatarCustomizer } from "@/components/ui/avatar-customizer";
import { DEFAULT_AVATAR } from "@/lib/constants/avatar";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Pencil } from "lucide-react";

interface UserData {
  name: string;
  username: string;
  email: string;
  country: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | '';
  avatarIcon?: string;
  avatarColor?: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string | null>(null);
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  // AI Usage & BYOK
  const [aiUsage, setAiUsage] = useState({ voiceCalls: 0, chatMessages: 0, totalCostCents: 0 });
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  
  // School Affiliation
  const [schoolSlugInput, setSchoolSlugInput] = useState("");
  const [isJoiningSchool, setIsJoiningSchool] = useState(false);
  const [isLeavingSchool, setIsLeavingSchool] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const [isSidebarCollapsed] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);

  const countries = countryList.getData().sort((a: { name: string; }, b: { name: string; }) => a.name.localeCompare(b.name));

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [formData, setFormData] = useState<UserData>({
    name: "",
    username: "",
    email: "",
    country: "",
    dateOfBirth: "",
    gender: '',
    avatarIcon: DEFAULT_AVATAR.icon,
    avatarColor: DEFAULT_AVATAR.color,
  });

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user && app) {
        try {
          const db = getFirestore(app);
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            setUserData(data as UserData);
            setUserName(data.name || user.displayName || "Valued User");
            setUserUsername(data.username || null);
            setUserAvatarIcon(data.avatarIcon || null);
            setUserAvatarColor(data.avatarColor || null);
            setFormData({
              name: data.name || "",
              username: data.username || "",
              email: user.email || "",
              country: data.country || "",
              dateOfBirth: data.dateOfBirth || "",
              gender: data.gender || '',
              avatarIcon: data.avatarIcon || DEFAULT_AVATAR.icon,
              avatarColor: data.avatarColor || DEFAULT_AVATAR.color,
            });
            const u = data.aiUsage ?? {};
            setAiUsage({
              voiceCalls: u.voiceCalls ?? 0,
              chatMessages: u.chatMessages ?? 0,
              totalCostCents: u.totalCostCents ?? 0,
            });
            const savedKey = data.geminiApiKey || '';
            setGeminiApiKey(savedKey);
            setGeminiApiKeyInput(savedKey);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast.error("Failed to load user data");
        }
      } else {
        setUserName("Valued User");
        setUserUsername(null);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Close country dropdown on outside click
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

  useEffect(() => {
    if (editingName) {
      const el = document.getElementById("settings-profile-name");
      el?.focus();
    }
  }, [editingName]);

  useEffect(() => {
    if (editingUsername) {
      const el = document.getElementById("settings-profile-username");
      el?.focus();
    }
  }, [editingUsername]);

  const filteredCountries = countries.filter(country => 
    country.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Username validation
  const validateUsername = (username: string): boolean => {
    if (!/[a-z]/.test(username)) return false;
    if (!/^[a-z0-9.-]+$/.test(username)) return false;
    if (/^[-.]|[-.]$/.test(username)) return false;
    return true;
  };

  // Check username availability
  const checkUsernameAvailability = async (username: string, currentUserId: string): Promise<boolean> => {
    if (!app) return false;
    const db = getFirestore(app);
    try {
      const usersRef = collection(db, "users_public");
      const q = query(usersRef, where("username", "==", username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return true; // Username is available
      }
      // If not empty, check if the found user is the current user
      let isAvailable = true;
      querySnapshot.forEach(doc => {
        if (doc.id !== currentUserId) {
          isAvailable = false; // Found another user with this username
        }
      });
      return isAvailable;
    } catch (err) {
      console.error("Error checking username:", err);
      return false;
    }
  };

  const debouncedUpdateAvatar = useCallback((data: { avatarIcon?: string; avatarColor?: string }) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(async () => {
      if (!user || !app) return;
      try {
        const db = getFirestore(app);
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, data);
        toast.info("Avatar preference saved!");
      } catch (error) {
        console.error("Error updating avatar:", error);
        toast.error("Failed to save avatar change");
      }
    }, 500);
  }, [user]);

  const handleAvatarIconChange = (icon: string) => {
    setFormData(prev => ({ ...prev, avatarIcon: icon }));
    setUserAvatarIcon(icon);
    debouncedUpdateAvatar({ avatarIcon: icon });
  };

  const handleAvatarColorChange = (color: string) => {
    setFormData(prev => ({ ...prev, avatarColor: color }));
    setUserAvatarColor(color);
    debouncedUpdateAvatar({ avatarColor: color });
  };

  const handleSaveProfile = async (): Promise<boolean> => {
    if (!user || !app) return false;

    setIsSaving(true);
    try {
      const newUsername = formData.username.toLowerCase();
      
      if (!validateUsername(newUsername)) {
        toast.error("Invalid username format. Please use lowercase letters, numbers, dots, and dashes.");
        return false;
      }

      if (newUsername !== userData?.username) {
        const isAvailable = await checkUsernameAvailability(newUsername, user.uid);
        if (!isAvailable) {
          toast.error("This username is already taken. Please choose another one.");
          return false;
        }
      }

      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);

      await updateDoc(userRef, {
        name: formData.name,
        username: newUsername,
        country: formData.country,
        avatarIcon: formData.avatarIcon,
        avatarColor: formData.avatarColor,
      });

      if (formData.name !== user.displayName) {
        await updateProfile(user, { displayName: formData.name });
      }

      setUserData(formData);
      toast.success("Profile updated successfully!");
      return true;
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const persistCountry = async (countryCode: string) => {
    if (!user || !app) return;
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, "users", user.uid), { country: countryCode });
      setUserData((prev) => (prev ? { ...prev, country: countryCode } : null));
      toast.success("Country saved");
    } catch (error) {
      console.error("Error saving country:", error);
      toast.error("Failed to save country");
    }
  };

  const handleDoneNameUsername = async () => {
    const ok = await handleSaveProfile();
    if (ok) {
      setEditingName(false);
      setEditingUsername(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !newPassword) return;

    setIsUpdatingPassword(true);
    try {
      await updatePassword(user, newPassword);
      setNewPassword("");
      toast.success("Password updated successfully!");
    } catch (error: any) {
      console.error("Error updating password:", error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error("Please log out and log back in before changing your password");
      } else {
        toast.error("Failed to update password");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!user || !app) return;
    setIsSavingApiKey(true);
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', user.uid), { geminiApiKey: geminiApiKeyInput || null } as any);
      setGeminiApiKey(geminiApiKeyInput);
      toast.success(geminiApiKeyInput ? 'API key saved' : 'API key removed');
    } catch {
      toast.error('Failed to save API key');
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleJoinSchool = async () => {
    if (!user || !app || !schoolSlugInput.trim()) return;
    setIsJoiningSchool(true);
    try {
      const functions = getFunctions(app);
      const joinFn = httpsCallable(functions, 'joinSchoolCallable');
      let slug = schoolSlugInput.trim();
      try {
        const url = new URL(slug);
        const ref = url.searchParams.get('ref');
        if (ref) slug = ref;
      } catch {}
      
      const res = await joinFn({ slug });
      const data = (res.data || {}) as any;
      if (data.ok) {
        toast.success(`Successfully joined ${data.schoolName || 'the school'}!`);
        setUserData(prev => prev ? ({ ...prev, schoolId: data.schoolId, schoolName: data.schoolName }) : prev);
        setSchoolSlugInput("");
        window.location.reload(); 
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to join school. Please check the code/link.");
    } finally {
      setIsJoiningSchool(false);
    }
  };

  const handleLeaveSchool = async () => {
    if (!user || !app) return;
    setIsLeavingSchool(true);
    try {
      const functions = getFunctions(app);
      const leaveFn = httpsCallable(functions, 'leaveSchoolCallable');
      await leaveFn();
      toast.success("You have left the school.");
      setShowLeaveDialog(false);
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to leave school.");
    } finally {
      setIsLeavingSchool(false);
    }
  };

  const handleResetStats = async () => {
    if (!user) return;

    setIsResetting(true);
    try {
      await resetUserStats(user.uid);
      toast.success("Statistics reset successfully! Your progress has been cleared.");
    } catch (error) {
      console.error("Error resetting statistics:", error);
      toast.error("Failed to reset statistics");
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !app) return;

    setIsDeleting(true);
    try {
      const db = getFirestore(app);
      
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      
      toast.success("Account deleted successfully");
      router.push("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error("Please log out and log back in before deleting your account");
      } else {
        toast.error("Failed to delete account");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Notification preferences
  const [emailPrefs, setEmailPrefs] = useState({
    remindersEnabled: true,
    friendStartAlertsEnabled: true,
    friendDigestEnabled: true,
    friendRequestEnabled: true,
  });
  
  useEffect(() => {
    (async () => {
      if (!user || !app) return;
      try {
        const db = getFirestore(app);
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data() as any;
          const s = (d?.emailSettings as any) || {};
          setEmailPrefs({
            remindersEnabled: s.remindersEnabled !== false,
            friendStartAlertsEnabled: s.friendStartAlertsEnabled !== false,
            friendDigestEnabled: s.friendDigestEnabled !== false,
            friendRequestEnabled: s.friendRequestEnabled !== false,
          });
        }
      } catch {}
    })();
  }, [user, app]);
  
  const saveEmailPrefs = async (next: typeof emailPrefs) => {
    if (!user || !app) return;
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', user.uid), { emailSettings: next } as any);
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    }
  };

  const handleBackToDashboard = async () => {
    window.location.href = '/dashboard';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen ambient-bg">
        <Sidebar 
          user={user}
          userName={userName}
          userUsername={userUsername}
          userAvatarIcon={userAvatarIcon}
          userAvatarColor={userAvatarColor}
        />
        
        <div className={cn(
          "transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "ml-16" : "ml-64"
        )}>
          <div className="p-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <Loading size="lg" text="Loading settings..." />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen ambient-bg">
      <Sidebar 
        user={user}
        userName={userName}
        userUsername={userUsername}
        userAvatarIcon={userAvatarIcon}
        userAvatarColor={userAvatarColor}
      />
      
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "ml-0 md:ml-16" : "ml-0 md:ml-64"
      )}>
        <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
          <div className="container max-w-screen-xl mx-auto py-8">

            {/* Profile Header & Avatar */}
            <div className="flex flex-col sm:flex-row items-start gap-8 mb-16">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-transform hover:scale-105 active:scale-95 shrink-0">
                    <CustomAvatar 
                      icon={formData.avatarIcon || DEFAULT_AVATAR.icon} 
                      color={formData.avatarColor || DEFAULT_AVATAR.color} 
                      size="xl" 
                      className="w-32 h-32 text-6xl"
                    />
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-white text-sm font-bold">Edit Avatar</span>
                    </div>
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Customize Avatar</DialogTitle>
                  </DialogHeader>
                  <AvatarCustomizer
                    currentIcon={formData.avatarIcon || DEFAULT_AVATAR.icon}
                    currentColor={formData.avatarColor || DEFAULT_AVATAR.color}
                    onIconChange={handleAvatarIconChange}
                    onColorChange={handleAvatarColorChange}
                    showPreview={false}
                  />
                </DialogContent>
              </Dialog>

              <div className="text-left flex-1 space-y-4 w-full min-w-0">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-start gap-2 min-h-[2.25rem]">
                    {editingName ? (
                      <Input
                        id="settings-profile-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Your full name"
                        className="text-3xl font-bold h-12 max-w-md"
                        aria-label="Full name"
                      />
                    ) : (
                      <>
                        <h2 className="text-3xl font-bold">{formData.name || "Valued User"}</h2>
                        <button
                          type="button"
                          onClick={() => setEditingName(true)}
                          className="p-1.5 rounded-md text-muted-foreground/80 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                          aria-label="Edit full name"
                        >
                          <Pencil className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-2 min-h-[1.75rem]">
                    {editingUsername ? (
                      <div className="flex items-center gap-1 max-w-md w-full sm:w-auto min-w-0">
                        <span className="text-muted-foreground text-lg select-none shrink-0" aria-hidden>
                          @
                        </span>
                        <Input
                          id="settings-profile-username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="username"
                          className="text-lg h-10 flex-1 min-w-0"
                          aria-label="Username"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-muted-foreground text-lg">
                          @{formData.username}
                        </p>
                        <button
                          type="button"
                          onClick={() => setEditingUsername(true)}
                          className="p-1.5 rounded-md text-muted-foreground/80 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                          aria-label="Edit username"
                        >
                          <Pencil className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {(editingName || editingUsername) && (
                  <div className="flex justify-start">
                    <Button type="button" onClick={handleDoneNameUsername} disabled={isSaving}>
                      {isSaving ? "Saving..." : "Done"}
                    </Button>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={formData.email}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <div className="relative" ref={countryDropdownRef}>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={showCountryList}
                        className="w-full justify-between font-normal"
                        onClick={() => setShowCountryList(!showCountryList)}
                      >
                        {formData.country ? countryList.getName(formData.country) : "Select country"}
                      </Button>
                      {showCountryList && (
                        <div className="absolute z-10 w-full bg-popover text-popover-foreground border border-border rounded-md mt-1 shadow-lg">
                          <div className="p-2">
                            <Input
                              placeholder="Search country..."
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {filteredCountries.map((country: { code: string; name: string }) => (
                              <div
                                key={country.code}
                                className="p-2 hover:bg-muted cursor-pointer"
                                onClick={() => {
                                  const next = country.code;
                                  setFormData({ ...formData, country: next });
                                  setShowCountryList(false);
                                  setCountrySearch("");
                                  if (next !== formData.country) void persistCountry(next);
                                }}
                              >
                                {country.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings Grid: two columns so the left stack is not stretched to match the tall right column */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-start">
              
              {/* Column 1 — account, AI, and danger (single vertical flow) */}
              <div className="space-y-10">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">Appearance</h3>
                    <p className="text-sm text-muted-foreground">Choose how CultivatED adapts to your system theme</p>
                  </div>
                  <RadioGroup
                    value={(theme as string) || "system"}
                    onValueChange={(val) => setTheme(val as "light" | "dark" | "system")}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                  >
                    <label className="flex flex-col items-center gap-2 rounded-xl border-2 border-border border-b-4 p-3 cursor-pointer hover:bg-muted [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:text-primary">
                      <RadioGroupItem value="system" id="theme-system" className="sr-only" />
                      <span className="font-bold text-sm">System</span>
                    </label>
                    <label className="flex flex-col items-center gap-2 rounded-xl border-2 border-border border-b-4 p-3 cursor-pointer hover:bg-muted [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:text-primary">
                      <RadioGroupItem value="light" id="theme-light" className="sr-only" />
                      <span className="font-bold text-sm">Light</span>
                    </label>
                    <label className="flex flex-col items-center gap-2 rounded-xl border-2 border-border border-b-4 p-3 cursor-pointer hover:bg-muted [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:text-primary">
                      <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
                      <span className="font-bold text-sm">Dark</span>
                    </label>
                  </RadioGroup>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">Change Password</h3>
                    <p className="text-sm text-muted-foreground">Update your account password</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />
                    </div>
                    <Button 
                      onClick={handleUpdatePassword} 
                      disabled={isUpdatingPassword || !newPassword}
                    >
                      {isUpdatingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">AI Usage &amp; API Key</h3>
                    <p className="text-sm text-muted-foreground">Track your free AI usage and optionally add your own Gemini API key for unlimited access.</p>
                  </div>
                  <div className="space-y-6">
                    <UsageBar usage={aiUsage} hasByok={!!geminiApiKey} />
                    <div className="space-y-4">
                      <Label htmlFor="geminiApiKey">Gemini API Key</Label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                          id="geminiApiKey"
                          type="password"
                          value={geminiApiKeyInput}
                          onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                          placeholder="AIza..."
                          className="flex-1"
                        />
                        <Button
                          onClick={handleSaveApiKey}
                          disabled={isSavingApiKey || geminiApiKeyInput === geminiApiKey}
                          className="shrink-0"
                        >
                          {isSavingApiKey ? 'Saving...' : 'Save Key'}
                        </Button>
                      </div>
                      {geminiApiKey && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 px-0"
                          onClick={async () => {
                            if (!user || !app) return;
                            setIsSavingApiKey(true);
                            try {
                              const db = getFirestore(app);
                              await updateDoc(doc(db, 'users', user.uid), { geminiApiKey: null } as any);
                              setGeminiApiKey('');
                              setGeminiApiKeyInput('');
                              toast.success('API key removed');
                            } catch {
                              toast.error('Failed to remove API key');
                            } finally {
                              setIsSavingApiKey(false);
                            }
                          }}
                        >
                          Remove key
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        <a
                          href="https://aistudio.google.com/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Get a free Gemini API key
                        </a>
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">Reset Statistics</h3>
                    <p className="text-sm text-muted-foreground">Clear all your practice statistics and progress data</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      This will permanently delete all your practice statistics, progress data, 
                      skill mastery scores, and answer history. This action cannot be undone.
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                          Reset All Statistics
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset All Statistics</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete all your practice statistics, progress data, 
                            skill mastery scores, and answer history. This action cannot be undone.
                            <br /><br />
                            Are you sure you want to reset everything?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleResetStats}
                            disabled={isResetting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isResetting ? "Resetting..." : "Reset Everything"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </section>
              </div>

              {/* Column 2 */}
              <div className="space-y-10">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">Need Help?</h3>
                    <p className="text-sm text-muted-foreground">Something not working as expected? Let us know.</p>
                  </div>
                  <div>
                    <ReportBugDialog />
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">Notifications</h3>
                    <p className="text-sm text-muted-foreground">Manage which emails you receive from CultivatED</p>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 cursor-pointer rounded-xl border border-transparent hover:bg-muted/50 transition-colors">
                      <div className="pr-4">
                        <div className="font-medium text-sm">Study reminders</div>
                        <div className="text-xs text-muted-foreground mt-1">Emails at your scheduled practice times</div>
                      </div>
                      <Switch checked={emailPrefs.remindersEnabled} onCheckedChange={(v: boolean) => { const n = { ...emailPrefs, remindersEnabled: v }; setEmailPrefs(n); saveEmailPrefs(n); }} />
                    </label>
                    <label className="flex items-center justify-between p-3 cursor-pointer rounded-xl border border-transparent hover:bg-muted/50 transition-colors">
                      <div className="pr-4">
                        <div className="font-medium text-sm">Friend start alerts</div>
                        <div className="text-xs text-muted-foreground mt-1">Email when a friend starts a practice session</div>
                      </div>
                      <Switch checked={emailPrefs.friendStartAlertsEnabled} onCheckedChange={(v: boolean) => { const n = { ...emailPrefs, friendStartAlertsEnabled: v }; setEmailPrefs(n); saveEmailPrefs(n); }} />
                    </label>
                    <label className="flex items-center justify-between p-3 cursor-pointer rounded-xl border border-transparent hover:bg-muted/50 transition-colors">
                      <div className="pr-4">
                        <div className="font-medium text-sm">Friend requests</div>
                        <div className="text-xs text-muted-foreground mt-1">Email when someone sends you a friend request</div>
                      </div>
                      <Switch checked={emailPrefs.friendRequestEnabled} onCheckedChange={(v: boolean) => { const n = { ...emailPrefs, friendRequestEnabled: v }; setEmailPrefs(n); saveEmailPrefs(n); }} />
                    </label>
                    <label className="flex items-center justify-between p-3 cursor-pointer rounded-xl border border-transparent hover:bg-muted/50 transition-colors">
                      <div className="pr-4">
                        <div className="font-medium text-sm">Weekly friend digest</div>
                        <div className="text-xs text-muted-foreground mt-1">Summary of your friends’ progress</div>
                      </div>
                      <Switch checked={emailPrefs.friendDigestEnabled} onCheckedChange={(v: boolean) => { const n = { ...emailPrefs, friendDigestEnabled: v }; setEmailPrefs(n); saveEmailPrefs(n); }} />
                    </label>
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">School Affiliation</h3>
                    <p className="text-sm text-muted-foreground">Manage your school membership</p>
                  </div>
                  <div>
                    {(userData as any)?.schoolId ? (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-2 p-4 border rounded-lg bg-muted/20">
                          <div className="font-medium text-lg">{(userData as any)?.schoolName || "Your School"}</div>
                          <div className="text-sm text-muted-foreground">You are affiliated with this school as a student.</div>
                        </div>
                        <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="text-destructive hover:text-destructive w-full sm:w-auto">
                              Leave School
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Leave School?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to leave <strong>{(userData as any)?.schoolName}</strong>? 
                                <br/><br/>
                                Your school admin will be notified. You will lose access to school assignments and classes.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleLeaveSchool} disabled={isLeavingSchool} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                {isLeavingSchool ? "Leaving..." : "Yes, Leave School"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-4">
                          <Label>Join a School</Label>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Input 
                              placeholder="Paste invite link or enter school code" 
                              value={schoolSlugInput}
                              onChange={(e) => setSchoolSlugInput(e.target.value)}
                              className="flex-1"
                            />
                            <Button onClick={handleJoinSchool} disabled={isJoiningSchool || !schoolSlugInput.trim()} className="shrink-0">
                              {isJoiningSchool ? "Joining..." : "Join"}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Ask your teacher or school admin for the invite link or code.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-red-600">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Once you delete your account, there is no going back. This will permanently 
                      delete your account, all your data, statistics, and progress. This action cannot be undone.
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full sm:w-auto">
                          Delete Account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Account</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action will permanently delete your account and all associated data.
                            <br /><br />
                            <strong>This includes:</strong>
                            <ul className="list-disc list-inside mt-2 space-y-1 text-left">
                              <li>Your profile and personal information</li>
                              <li>All practice statistics and progress</li>
                              <li>Answer history and bookmarks</li>
                              <li>Skill mastery data</li>
                            </ul>
                            <br />
                            This action cannot be undone. Are you absolutely sure?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDeleteAccount}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </section>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
