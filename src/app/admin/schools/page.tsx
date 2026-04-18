"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, app } from "@/lib/firebaseClient";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components";


export default function AdminSchoolsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [country, setCountry] = useState("US");
  const [curriculum, setCurriculum] = useState("US");
  const [creating, setCreating] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth as any, async (user) => {
      if (!user) { router.replace("/login"); return; }
      try {
        const tokenResult = await user.getIdTokenResult();
        if (tokenResult.claims.admin !== true) { router.replace("/dashboard"); return; }
      } catch { router.replace("/dashboard"); return; }
      setIsAuthorized(true);
      setIsChecking(false);
    });
    return () => unsubscribe?.();
  }, [router]);

  const createSchool = async () => {
    try {
      if (!auth || !app) return;
      setCreating(true);
      const fns = getFunctions(app, 'us-central1');
      const callable = httpsCallable(fns, 'createSchoolCallable');
      const res: any = await callable({ 
        name, 
        slug, 
        country,
        curriculum,
        domainAllowlist: domain ? [domain] : [] 
      });
      setSchoolId(String(res?.data?.schoolId));
      setAdminCode(String(res?.data?.adminInviteCode || ''));
    } catch (e: any) {
      alert(e?.message || 'Failed');
    } finally {
      setCreating(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen ambient-bg flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Checking admin access…</div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen ambient-bg">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-display font-bold mb-2">Schools</h1>
        <p className="text-muted-foreground mb-6">Create schools. An admin invite code will be generated automatically.</p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create school</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Springfield High" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="springfield-high" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">🇺🇸 United States</SelectItem>
                    <SelectItem value="NG">🇳🇬 Nigeria</SelectItem>
                    <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Curriculum</Label>
                <Select value={curriculum} onValueChange={setCurriculum}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">American</SelectItem>
                    <SelectItem value="NG">Nigerian</SelectItem>
                    <SelectItem value="GB">British</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Allowlist domain (optional)</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="springfieldhs.org" />
            </div>
            <Button onClick={createSchool} disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
          </CardContent>
        </Card>

        {schoolId && (
          <Card>
            <CardHeader>
              <CardTitle>Admin invite code</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">Share this signup link with your school admin:</div>
              <div className="mt-2 text-sm">
                Signup link: <code>/signup?ref={slug}&admin={adminCode}</code>
              </div>
              <div className="text-muted-foreground text-xs mt-1">Only signup links are supported. No login links.</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}


