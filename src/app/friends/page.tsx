"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { 
  doc,
  getDoc,
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getPublicUser, getPublicUserByUsername } from '@/lib/users-public';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { PageHeader } from '@/components/layout/page-header';
import { auth, app } from '@/lib/firebaseClient';
import { DEFAULT_AVATAR } from '@/lib/constants/avatar';
import { cn } from '@/lib/utils';
import { 
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Skeleton
} from '@/components';
import { toast } from 'sonner';

export default function FriendsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string | null>(null);
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null);
  const [isSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Friends and requests state
  const [friends, setFriends] = useState<any[]>([]);
  const [friendsLoading, setFriendsLoading] = useState<boolean>(true);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState<boolean>(true);

  // Search state
  const [searchUsername, setSearchUsername] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<any | null>(null);
  

  // Helper to fetch minimal user profile (uses public mirror).
  const fetchUserProfileById = async (db: any, uid: string) => {
    return await getPublicUser(db, uid);
  };

  // Reconcile referrer friendship if not set. The mutation runs on a Cloud
  // Function because writing to the *referrer's* private user doc isn't
  // allowed by the strict Firestore rule.
  const reconcileReferrerFriendship = async (db: any, uid: string) => {
    try {
      const meRef = doc(db, 'users', uid);
      const meSnap = await getDoc(meRef);
      if (!meSnap.exists()) return;
      const me = meSnap.data() as any;
      const referrerId = me?.referrerId || null;
      const myFriends = (me?.friends as string[] | undefined) || [];
      if (referrerId && !myFriends.includes(referrerId)) {
        try {
          const fns = getFunctions(app as any, 'us-central1');
          const addMutual = httpsCallable(fns, 'addMutualFriendship');
          await addMutual({ otherUid: referrerId });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    let unsubUserDoc: (() => void) | null = null;
    let unsubIncoming: (() => void) | null = null;
    let unsubOutgoing: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && app) {
        try {
          const db = getFirestore(app);
          const userRef = doc(db, 'users', u.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            setUserName(data.name || u.displayName || 'Valued User');
            setUserUsername(data.username || null);
            setUserAvatarIcon(data.avatarIcon || DEFAULT_AVATAR.icon);
            setUserAvatarColor(data.avatarColor || DEFAULT_AVATAR.color);

            // Safeguard: ensure referrer is added as friend if missing
            await reconcileReferrerFriendship(db, u.uid);

            // Listen for my user doc to refresh friends list on change
            setFriendsLoading(true);
            unsubUserDoc = onSnapshot(userRef, async (snap) => {
              const d = snap.data() as any;
              const friendIds: string[] = (d?.friends as string[] | undefined) || [];
              if (friendIds.length === 0) {
                setFriends([]);
                setFriendsLoading(false);
                return;
              }
              const friendProfiles = await Promise.all(friendIds.map(fid => fetchUserProfileById(db, fid)));
              setFriends(friendProfiles.filter(Boolean));
              setFriendsLoading(false);
            });

            // Listen to incoming and outgoing friend requests
            setRequestsLoading(true);
            const incomingQ = query(collection(db, 'friendRequests'), where('toUserId', '==', u.uid));
            const outgoingQ = query(collection(db, 'friendRequests'), where('fromUserId', '==', u.uid));
            unsubIncoming = onSnapshot(incomingQ, async (snap) => {
              const reqs = await Promise.all(snap.docs.map(async d => {
                const data = d.data() as any;
                const fromProfile = await fetchUserProfileById(db, data.fromUserId);
                return { id: d.id, ...data, fromProfile };
              }));
              setIncomingRequests(reqs);
              setRequestsLoading(false);
            });
            unsubOutgoing = onSnapshot(outgoingQ, async (snap) => {
              const reqs = await Promise.all(snap.docs.map(async d => {
                const data = d.data() as any;
                const toProfile = await fetchUserProfileById(db, data.toUserId);
                return { id: d.id, ...data, toProfile };
              }));
              setOutgoingRequests(reqs);
            });
          } else {
            setUserName(u.displayName || 'Valued User');
            setUserUsername(null);
            setUserAvatarIcon(DEFAULT_AVATAR.icon);
            setUserAvatarColor(DEFAULT_AVATAR.color);
          }
        } catch {
          setUserName(u.displayName || 'Valued User');
        }
      }
      setIsLoading(false);
    });

    return () => {
      try { unsubscribe(); } catch {}
      try { unsubUserDoc && unsubUserDoc(); } catch {}
      try { unsubIncoming && unsubIncoming(); } catch {}
      try { unsubOutgoing && unsubOutgoing(); } catch {}
    };
  }, []);

  const exactUsernameSearch = async () => {
    if (!app || !user) return;
    const uname = (searchUsername || '').trim().toLowerCase();
    if (!uname) {
      setSearchResult(null);
      return;
    }
    setSearching(true);
    try {
      const db = getFirestore(app);
      const found = await getPublicUserByUsername(db, uname);
      setSearchResult(found);
    } finally {
      setSearching(false);
    }
  };

  const isAlreadyFriend = (targetUserId: string): boolean => {
    return friends.some(f => f?.id === targetUserId);
  };

  const hasPendingOutgoingTo = (targetUserId: string): boolean => {
    return outgoingRequests.some(r => r.toUserId === targetUserId);
  };

  const hasPendingIncomingFrom = (targetUserId: string): boolean => {
    return incomingRequests.some(r => r.fromUserId === targetUserId);
  };

  const sendFriendRequest = async (toUserId: string) => {
    if (!user || !app) return;
    if (toUserId === user.uid) return;
    if (isAlreadyFriend(toUserId)) {
      toast.info('Already friends');
      return;
    }
    if (hasPendingOutgoingTo(toUserId)) {
      toast.info('Friend request already sent');
      return;
    }
    try {
      const db = getFirestore(app);
      await addDoc(collection(db, 'friendRequests'), {
        fromUserId: user.uid,
        toUserId,
        createdAt: new Date()
      });
      toast.success('Friend request sent');
    } catch (e) {
      toast.error('Failed to send friend request');
    }
  };

  const acceptFriendRequest = async (requestId: string, fromUserId: string) => {
    if (!user || !app) return;
    try {
      const db = getFirestore(app);
      const fns = getFunctions(app as any, 'us-central1');
      const addMutual = httpsCallable(fns, 'addMutualFriendship');
      await addMutual({ otherUid: fromUserId });
      await deleteDoc(doc(db, 'friendRequests', requestId));

      // Clean up any reciprocal outgoing request I may have sent to them
      try {
        const reciprocalQ = query(
          collection(db, 'friendRequests'),
          where('fromUserId', '==', user.uid),
          where('toUserId', '==', fromUserId)
        );
        const reciprocalSnap = await getDocs(reciprocalQ);
        await Promise.all(reciprocalSnap.docs.map(d => deleteDoc(d.ref)));
      } catch {}
      toast.success('Friend request accepted');
    } catch (e) {
      toast.error('Failed to accept request');
    }
  };

  const denyFriendRequest = async (requestId: string) => {
    if (!user || !app) return;
    try {
      const db = getFirestore(app);
      await deleteDoc(doc(db, 'friendRequests', requestId));
      toast.success('Friend request removed');
    } catch (e) {
      toast.error('Failed to remove request');
    }
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
        <div className={cn('transition-all duration-300 ease-in-out', isSidebarCollapsed ? 'ml-16' : 'ml-64')}>
          <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
            <PageHeader title="My Friends" />
            <div className="max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
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
        'transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
      )}>
        <div className="py-8 pr-8 pl-10 md:pl-14 xl:pl-16">
          <PageHeader title="My Friends" />

          {/* Username Search */}
          <Card className="mt-4 max-w-4xl">
            <CardHeader>
              <CardTitle>Find friends by username</CardTitle>
              <CardDescription>Exact match only</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="e.g. username"
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') exactUsernameSearch(); }}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={exactUsernameSearch} disabled={searching}>
                    {searching ? 'Searching…' : 'Search'}
                  </Button>
                </div>
              </div>

              {searchResult && (
                <div className="mt-4 border rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1"
                      onClick={() => searchResult.username && router.push(`/friends/${searchResult.username}`)}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                        style={{ backgroundColor: searchResult.avatarColor || DEFAULT_AVATAR.color }}
                      >
                        <span>{searchResult.avatarIcon || DEFAULT_AVATAR.icon}</span>
                      </div>
                      <div>
                        <div className="font-semibold">{searchResult.name || 'User'}</div>
                        <div className="text-sm text-muted-foreground">@{searchResult.username || 'unknown'}</div>
                      </div>
                    </div>
                    <div>
                      {searchResult.id === user.uid ? (
                        <Button disabled variant="outline">This is you</Button>
                      ) : isAlreadyFriend(searchResult.id) ? (
                        <Button 
                          variant="secondary"
                          onClick={() => searchResult.username && router.push(`/friends/${searchResult.username}`)}
                        >
                          View Profile
                        </Button>
                      ) : hasPendingOutgoingTo(searchResult.id) ? (
                        <Button disabled variant="outline">Request sent</Button>
                      ) : hasPendingIncomingFrom(searchResult.id) ? (
                        <div className="flex gap-2">
                          <Button onClick={() => acceptFriendRequest(incomingRequests.find(r => r.fromUserId === searchResult.id)?.id!, searchResult.id)}>Accept</Button>
                          <Button variant="outline" onClick={() => denyFriendRequest(incomingRequests.find(r => r.fromUserId === searchResult.id)?.id!)}>Deny</Button>
                        </div>
                      ) : (
                        <Button onClick={() => sendFriendRequest(searchResult.id)}>Send Friend Request</Button>
                      )}
                    </div>
                  </div>
                  {/* Basic stats preview */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="p-3 rounded-md border">
                      <div className="text-muted-foreground">Overall</div>
                      <div className="font-semibold">{Math.round(searchResult?.adaptiveLearning?.overallCompetency ?? 0)}</div>
                    </div>
                    <div className="p-3 rounded-md border">
                      <div className="text-muted-foreground">Total Qs</div>
                      <div className="font-semibold">{searchResult?.adaptiveLearning?.totalQuestionsAnswered ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-md border">
                      <div className="text-muted-foreground">Time Spent (min)</div>
                      <div className="font-semibold">{Math.floor((searchResult?.adaptiveLearning?.totalTimeSpent ?? 0) / 60)}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 max-w-6xl">
            {/* Friend Requests */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Friend Requests</CardTitle>
                  <CardDescription>Approve or deny incoming requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {requestsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10" />
                      <Skeleton className="h-10" />
                    </div>
                  ) : incomingRequests.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No requests</div>
                  ) : (
                    <div className="space-y-3">
                      {incomingRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between border rounded-md p-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: req.fromProfile?.avatarColor || DEFAULT_AVATAR.color }}
                            >
                              <span className="text-lg">{req.fromProfile?.avatarIcon || DEFAULT_AVATAR.icon}</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium">{req.fromProfile?.name || 'User'}</div>
                              <div className="text-xs text-muted-foreground">@{req.fromProfile?.username || 'unknown'}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => acceptFriendRequest(req.id, req.fromUserId)}>Accept</Button>
                            <Button size="sm" variant="outline" onClick={() => denyFriendRequest(req.id)}>Deny</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Outgoing Requests</CardTitle>
                  <CardDescription>Awaiting approval</CardDescription>
                </CardHeader>
                <CardContent>
                  {requestsLoading ? (
                    <Skeleton className="h-10" />
                  ) : outgoingRequests.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No pending requests</div>
                  ) : (
                    <div className="space-y-3">
                      {outgoingRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between border rounded-md p-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: req.toProfile?.avatarColor || DEFAULT_AVATAR.color }}
                            >
                              <span className="text-lg">{req.toProfile?.avatarIcon || DEFAULT_AVATAR.icon}</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium">{req.toProfile?.name || 'User'}</div>
                              <div className="text-xs text-muted-foreground">@{req.toProfile?.username || 'unknown'}</div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground pr-1">Pending</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Friends List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Your Friends</CardTitle>
                  <CardDescription>People you’re connected with</CardDescription>
                </CardHeader>
                <CardContent>
                  {friendsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Skeleton className="h-20" />
                      <Skeleton className="h-20" />
                      <Skeleton className="h-20" />
                    </div>
                  ) : friends.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No friends yet. Search by username to connect.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {friends.map((f) => (
                        <div 
                          key={f.id} 
                          className="border rounded-md p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => f.username && router.push(`/friends/${f.username}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                                style={{ backgroundColor: f.avatarColor || DEFAULT_AVATAR.color }}
                              >
                                <span>{f.avatarIcon || DEFAULT_AVATAR.icon}</span>
                              </div>
                              <div>
                                <div className="font-semibold">{f.name || 'User'}</div>
                                <div className="text-sm text-muted-foreground">@{f.username || 'unknown'}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <div className="text-xs text-muted-foreground">Overall</div>
                                <div className="font-semibold">{Math.round(f?.adaptiveLearning?.overallCompetency ?? 0)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Total Qs</div>
                                <div className="font-semibold">{f?.adaptiveLearning?.totalQuestionsAnswered ?? 0}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Minutes</div>
                                <div className="font-semibold">{Math.floor((f?.adaptiveLearning?.totalTimeSpent ?? 0) / 60)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


