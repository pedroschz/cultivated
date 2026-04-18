"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, app } from '@/lib/firebaseClient';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from '@/components';


export default function AdminEmailPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('<p>Write your message here.</p>');
  const [text, setText] = useState('');
  const [everyone, setEveryone] = useState(false);
  const [users, setUsers] = useState<{ id: string; name?: string; email?: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth as any, async (user) => {
      if (!user) { router.replace('/login'); return; }
      try {
        const tokenResult = await user.getIdTokenResult();
        if (tokenResult.claims.admin !== true) { router.replace('/dashboard'); return; }
      } catch { router.replace('/dashboard'); return; }
      setIsAuthorized(true);
      setIsChecking(false);
      // load users
      if (app) {
        try {
          const db = getFirestore(app);
          const snap = await getDocs(collection(db, 'users'));
          const list = await Promise.all(snap.docs.slice(0, 500).map(async (d) => ({ id: d.id, ...(d.data() as any) })));
          setUsers(list.map((u: any) => ({ id: u.id, name: u.name || 'User' })));
        } catch {}
      }
    });
    return () => unsub?.();
  }, [router]);

  const previewHtml = useMemo(() => {
    return `<!doctype html><html><head><meta charset="utf-8" /></head><body style="background:#F7F7F7;padding:20px;font-family:sans-serif;color:#4B4B4B;"><div style="max-width:680px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);"><div style="padding:16px 40px;border-bottom:1px solid #E5E5E5;"><img src="/text-logo.png" alt="CultivatED" height="28" /></div><div style="padding:40px">${html}</div><div style="padding:14px 40px;border-top:1px solid #E5E5E5;color:#AFAFAF;font-size:12px;background:#F7F7F7;text-align:center;">You’re receiving this email because you have a CultivatED account.</div></div></body></html>`;
  }, [html]);

  const send = async () => {
    if (!auth?.currentUser) return;
    setLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const payload: any = { idToken, subject: subject.trim(), html, text: text.trim() || undefined };
      if (everyone) payload.everyone = true; else payload.toUserIds = selected;
      const res = await fetch('https://sendadminemail-qzfzrr6vbq-uc.a.run.app', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      alert(`Sent to ${json.sent} recipient(s)`);
    } catch (e: any) {
      alert(e?.message || 'Failed to send');
    } finally {
      setLoading(false);
    }
  };

  if (isChecking) {
    return <div className="min-h-screen ambient-bg flex items-center justify-center"><div className="text-sm text-muted-foreground">Checking admin access…</div></div>;
  }
  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen ambient-bg">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-display font-bold mb-2">Email Creator</h1>
        <p className="text-muted-foreground mb-6">Compose a branded email and choose recipients.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Compose</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
              </div>
              <div>
                <Label>HTML Body</Label>
                <Textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={14} />
                <div className="text-xs text-muted-foreground mt-1">Brand assets: <code>/text-logo.png</code>, <code>/logo.png</code></div>
              </div>
              <div>
                <Label>Plain Text (optional)</Label>
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recipients</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} /> Send to everyone</label>
              {!everyone && (
                <div>
                  <Label>Select users</Label>
                  <div className="mt-2 max-h-64 overflow-auto border rounded">
                    {users.map(u => (
                      <label key={u.id} className="flex items-center gap-2 p-2 border-b last:border-b-0 text-sm">
                        <input type="checkbox" checked={selected.includes(u.id)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id))} />
                        <span>{u.name || 'User'} <span className="text-muted-foreground text-xs">({u.id})</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <Button disabled={loading || !subject.trim() || !html.trim()} onClick={send}>{loading ? 'Sending…' : 'Send Email'}</Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent>
            <iframe title="preview" className="w-full h-[420px] bg-white rounded" srcDoc={previewHtml} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


