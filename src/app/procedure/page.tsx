"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { app, auth } from '@/lib/firebaseClient';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Button, Loading } from '@/components';
import { Pen, Highlighter as HighlighterIcon, Eraser, Undo2, Redo2, Trash2, Palette, Minus, Plus, Grid as GridIcon, Download } from 'lucide-react';
import type { User } from 'firebase/auth';
import { shouldBlockAi, triggerAiLimitPopup } from '@/lib/ai/usageClient';

/**
 * Calls Gemini via our server proxy so the project's API key never leaves the
 * server. Mirrors the shape of `client.models.generateContent` for callers.
 */
async function callGeminiGenerate(args: { model: string; contents: any; config?: any }): Promise<any> {
  const { getAuth } = await import('firebase/auth');
  const a = getAuth();
  const u = a.currentUser;
  if (!u) throw new Error('Not signed in');
  const idToken = await u.getIdToken();
  const res = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`gemini/generate failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data?.result;
}

export default function ProcedurePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastDrawTs, setLastDrawTs] = useState<number>(0);
  const [connected, setConnected] = useState(false);
  // Hydration-safe: start with a stable default, then adjust on client after mount
  const [color, setColor] = useState<string>('#111827');
  const [size, setSize] = useState<number>(4);
  type Tool = 'pen' | 'eraser' | 'highlighter';
  const [tool, setTool] = useState<Tool>("pen");
  const [practiceActive, setPracticeActive] = useState<boolean>(false);
  const [practiceActiveLoading, setPracticeActiveLoading] = useState<boolean>(true);
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  // Tracks whether any ink has been added since the last explicit clear
  const hasInkSinceClearRef = useRef<boolean>(false);

  useEffect(() => {
    const unsub = auth?.onAuthStateChanged((u: User | null) => {
      console.log('[procedure] auth state changed:', {
        hasUser: !!u,
        uid: u?.uid,
      });
      if (!u) {
        console.warn('[procedure] no user detected → redirecting to /login');
        router.replace('/login');
      }
    });
    return () => { if (unsub) unsub(); };
  }, [router]);

  // Subscribe to user's active practice session flag; block drawing if inactive
  useEffect(() => {
    if (!app || !auth?.currentUser) return;
    const db = getFirestore(app!);
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.data() as any;
      const active = !!data?.['active-practice-session'];
      console.log('[procedure] active-practice-session state:', active);
      setPracticeActive(active);
      setPracticeActiveLoading(false);
    }, (e) => { console.error('[procedure] failed to read active-practice-session', e); setPracticeActiveLoading(false); });
    return () => unsub();
  }, [app, auth?.currentUser?.uid]);

  useEffect(() => {
    // Adjust initial pen color based on theme after mount to avoid SSR/CSR mismatch
    try {
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      setColor(isDark ? '#ffffff' : '#111827');
    } catch {}

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const cssW = Math.max(320, Math.floor(rect.width));
      const cssH = Math.max(240, Math.floor(window.innerHeight - 80));
      canvas.width = Math.floor(cssW * ratio);
      canvas.height = Math.floor(cssH * ratio);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      // Reset transform then apply scale for crisp lines
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Theme-aware background fill
      const bg = (() => {
        try { return window.getComputedStyle(container).backgroundColor || ''; } catch { return ''; }
      })();
      ctx.fillStyle = bg || (document.documentElement.classList.contains('dark') ? '#0b0f19' : '#ffffff');
      ctx.fillRect(0, 0, cssW, cssH);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    // Presence heartbeat – start only when user is ready; write immediately and then every 15s
    if (!app || !auth?.currentUser) return;
    let disposed = false;
    const db = getFirestore(app!);
    const ref = doc(db, 'users', auth.currentUser.uid, 'presence', 'procedure');

    const writePresence = async () => {
      try {
        console.log('[procedure] heartbeat → set connected=true');
        await setDoc(ref, { connected: true, updatedAt: Date.now(), device: 'canvas' }, { merge: true });
        setConnected(true);
        console.log('[procedure] heartbeat saved');
      } catch (e) {
        console.error('[procedure] heartbeat failed:', e);
      }
    };

    // Immediate write on mount (after auth is available)
    writePresence();
    const id = window.setInterval(writePresence, 15000);

    // Also refresh presence promptly when tab becomes visible
    const onVis = () => { if (document.visibilityState === 'visible') writePresence(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      disposed = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [app, auth?.currentUser?.uid]);

  // Listen for remote clear requests from the practice page and clear the canvas
  useEffect(() => {
    if (!app || !auth?.currentUser) return;
    const db = getFirestore(app!);
    const ctrlRef = doc(db, 'users', auth.currentUser.uid, 'procedure', 'control');
    const lastProcessedRef = { current: 0 } as { current: number };
    const unsub = onSnapshot(ctrlRef, (snap) => {
      const data = snap.data() as any;
      const ts = Number(data?.clearRequestedAt || 0);
      if (ts && ts > lastProcessedRef.current) {
        lastProcessedRef.current = ts;
        try {
          handleClear();
        } catch (e) {
          console.warn('[procedure] failed to clear on request', e);
        }
      }
    }, (e) => console.warn('[procedure] control listener error', e));
    return () => unsub();
  }, [app, auth?.currentUser?.uid]);

  useEffect(() => {
    // Mark disconnect on unload
    const onUnload = async () => {
      try {
        if (!app || !auth?.currentUser) return;
        const db = getFirestore(app!);
        const ref = doc(db, 'users', auth.currentUser.uid, 'presence', 'procedure');
        console.log('[procedure] beforeunload → set connected=false');
        await setDoc(ref, { connected: false, updatedAt: Date.now() }, { merge: true });
      } catch {}
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // Simple drawing logic with clean stroke starts and no stray connections
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastX = 0, lastY = 0;
    const getPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      if (!practiceActive) {
        console.warn('[procedure] blocked input: no active practice session');
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      canvas.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      isDrawingRef.current = true;
      const p = getPos(e);
      lastX = p.x; lastY = p.y;
      // Start a new path cleanly to avoid lines to (0,0)
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      hasInkSinceClearRef.current = true;
      // Save snapshot for undo
      try { undoStackRef.current.push(canvas.toDataURL('image/png')); redoStackRef.current = []; } catch {}
      setLastDrawTs(Date.now());
      console.log('[procedure] drawing started at', { x: p.x, y: p.y });
    };
    const onMove = (e: PointerEvent) => {
      if (!isDrawing) return;
      const p = getPos(e);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = Math.max(8, size * 2);
        ctx.strokeStyle = '#000';
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (tool === 'highlighter') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = color + '66'; // add alpha
        ctx.lineWidth = Math.max(10, size * 3);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        hasInkSinceClearRef.current = true;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        hasInkSinceClearRef.current = true;
      }
      lastX = p.x; lastY = p.y;
      setLastDrawTs(Date.now());
    };
    const onUp = (e: PointerEvent) => {
      setIsDrawing(false);
      isDrawingRef.current = false;
      console.log('[procedure] drawing ended');
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [color, size, tool, isDrawing, practiceActive]);

  // Lightweight OCR placeholder: export blank transcript statically (no remote calls)
  useEffect(() => {
    // Client-only Gemini OCR and analysis loop (no server endpoints)
    const scanInFlightRef = { current: false } as { current: boolean };
    const lastScanForDrawTsRef = { current: 0 } as { current: number };
    const questionContextRef = { current: null as null | {
      question?: string;
      options?: string[];
      answer?: string;
      explanation?: string;
      updatedAt?: number;
    } };

    // Live subscription to question context (avoid per-scan fetch)
    let unsubContext: (() => void) | null = null;
    try {
      const db = getFirestore(app!);
      if (auth?.currentUser) {
        const ctxRef = doc(db, 'users', auth.currentUser.uid, 'procedure', 'context');
        unsubContext = onSnapshot(ctxRef, (snap) => {
          if (snap.exists()) {
            questionContextRef.current = snap.data() as any;
          }
        });
      }
    } catch (e) {
      console.warn('[procedure] failed to subscribe to question context', e);
    }

    const estimateInkCoverage = (): { coverage: number; isBlank: boolean } => {
      const src = canvasRef.current;
      if (!src) return { coverage: 0, isBlank: true };
      const sctx = src.getContext('2d');
      if (!sctx) return { coverage: 0, isBlank: true };
      // Downsample for fast estimation
      const sampleW = 96, sampleH = 96;
      const tmp = document.createElement('canvas');
      tmp.width = sampleW; tmp.height = sampleH;
      const tctx = tmp.getContext('2d');
      if (!tctx) return { coverage: 0, isBlank: true };
      tctx.drawImage(src, 0, 0, sampleW, sampleH);
      const img = tctx.getImageData(0, 0, sampleW, sampleH).data;
      // Estimate background brightness from a 1px border ring
      let bgSum = 0, bgCount = 0;
      for (let y = 0; y < sampleH; y++) {
        for (let x = 0; x < sampleW; x++) {
          if (x === 0 || y === 0 || x === sampleW - 1 || y === sampleH - 1) {
            const idx = (y * sampleW + x) * 4;
            const r = img[idx], g = img[idx + 1], b = img[idx + 2];
            const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            bgSum += brightness; bgCount++;
          }
        }
      }
      const bg = bgCount ? (bgSum / bgCount) : 255;
      // Count pixels that deviate meaningfully from background
      let diffCount = 0;
      for (let y = 0; y < sampleH; y++) {
        for (let x = 0; x < sampleW; x++) {
          const idx = (y * sampleW + x) * 4;
          const r = img[idx], g = img[idx + 1], b = img[idx + 2];
          const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (Math.abs(brightness - bg) > 18) diffCount++;
        }
      }
      const total = sampleW * sampleH;
      const coverage = diffCount / total;
      // Treat as blank if coverage extremely low (<0.15%) and no recent ink flag
      const isBlank = coverage < 0.0015;
      return { coverage, isBlank };
    };

    const getCanvasBase64 = (): { data: string; mime: string } | null => {
      const src = canvasRef.current;
      if (!src) return null;
      const w = Math.min(src.width / (window.devicePixelRatio || 1), 512);
      const scale = w / (src.width / (window.devicePixelRatio || 1));
      const h = Math.max(1, Math.round((src.height / (window.devicePixelRatio || 1)) * scale));
      const tmp = document.createElement('canvas');
      tmp.width = Math.max(1, Math.round(w));
      tmp.height = h;
      const tctx = tmp.getContext('2d');
      const sctx = src.getContext('2d');
      if (!tctx || !sctx) return null;
      // Draw with CSS pixel dimensions
      tctx.drawImage(src, 0, 0, tmp.width, tmp.height);
      const dataUrl = tmp.toDataURL('image/jpeg', 0.6);
      const base64 = dataUrl.split(',')[1] || null;
      console.log('[procedure] prepared canvas snapshot', {
        cssWidth: tmp.width,
        cssHeight: tmp.height,
        base64Len: base64?.length,
      });
      return base64 ? { data: base64, mime: 'image/jpeg' } : null;
    };

    const runOcrOnce = async () => {
      console.log('[procedure] scan tick', {
        sinceDrawMs: Date.now() - lastDrawTs,
        scanInFlight: scanInFlightRef.current,
        practiceActive,
      });
      if (scanInFlightRef.current) return;
      if (!app || !auth?.currentUser) return;
      if (!practiceActive) return;
      if (Date.now() - lastDrawTs > 7000) return;
      if (lastScanForDrawTsRef.current >= lastDrawTs) return; // already scanned for this draw
      // Quick guard: skip if canvas looks blank or no ink since clear
      const ink = estimateInkCoverage();
      if (ink.isBlank && !hasInkSinceClearRef.current) {
        console.log('[procedure] skip scan: canvas appears blank', ink);
        lastScanForDrawTsRef.current = lastDrawTs;
        return;
      }
      const img = getCanvasBase64();
      if (!img) return;
      scanInFlightRef.current = true;
      try {
        const scanId = new Date().toISOString();
        // Group logs for this scan instance
        try { console.groupCollapsed(`[procedure] scan ${scanId}`); } catch {}
        console.log('[procedure] starting Gemini OCR scan...');
        // Preflight cap check (server enforces too; this is just for UX)
        const uid = auth?.currentUser?.uid;
        if (uid) {
          try {
            const db = getFirestore(app!);
            const snap = await getDoc(doc(db, 'users', uid));
            const data = snap.data();
            const usage = data?.aiUsage;
            const byok = data?.geminiApiKey;
            if (shouldBlockAi(usage, byok)) {
              triggerAiLimitPopup();
              return;
            }
          } catch {}
        }
        // Context is managed by a separate live subscription; no per-scan fetch.

        const ctx = questionContextRef.current || {};
        const optionsText = Array.isArray(ctx.options) && ctx.options.length
          ? ctx.options.map((opt: string, i: number) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')
          : '';
        const contextBlock = [
          ctx.question ? `QUESTION: ${ctx.question}` : '',
          optionsText ? `OPTIONS:\n${optionsText}` : '',
          ctx.answer ? `CORRECT ANSWER: ${ctx.answer}` : '',
          ctx.explanation ? `EXPLANATION: ${ctx.explanation}` : '',
        ].filter(Boolean).join('\n');

        const prompt = [
          'You will receive ONE image (inlineData) containing the student\'s handwritten work. Perform OCR and analyze the steps relative to the given question context.',
          'Context of the question:',
          contextBlock ? contextBlock : 'No question context available.',
          '',
          'Return ONLY strict JSON (no markdown, no extra commentary):',
          '{"transcript": string, "isGoingWell": boolean, "reason": string, "score": number | null}',
          '',
          'Rules:',
          '- transcript: Clean plain text of only the handwriting visible in the IMAGE. Do NOT copy or paraphrase any of the provided context or instructions. Keep equation formatting like x^2, fractions, etc.',
          '- isGoingWell: Evaluate only against the QUESTION and EXPLANATION above. true if steps logically move toward a correct method, even if its only a number or incomplete steps but on the right track; false if off-topic, purely social (e.g., greetings), or most importantly, mathematically incorrect steps occur. Do NOT infer the final answer.',
          '- reason: One short sentence explaining the verdict focused on procedure quality (e.g., "isolating variable correctly" or "distributed incorrectly").',
          '- score: An integer 1..5 rating how well the procedure is going right now (1 = very poor/off-track, 3 = mixed/partially correct, 5 = excellent/on-track). If the image contains no handwriting or is blank/only grid/background, set transcript to "" and score to null.',
          '- If the image contains no handwriting or only the printed problem text, return transcript as an empty string and score as null. Do not fabricate content.',
          '- Ignore any greetings or chit-chat that do not contribute to solving the problem.',
        ].join('\n');

        let outputText = '' as string;
        const decodeB64 = (b64: string) => {
          try { return atob(b64); } catch { return ''; }
        };
        console.log('[procedure] calling /api/gemini/generate (gemini-2.5-flash-lite)');
        const result: any = await callGeminiGenerate({
          model: 'gemini-2.5-flash-lite',
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: img.mime, data: img.data } },
            { text: prompt }
          ] }],
          config: { responseMimeType: 'application/json' }
        });
        const parts = result?.candidates?.[0]?.content?.parts || [];
        const textPart = parts.find((p: any) => typeof p?.text === 'string' && p.text.trim().length);
        if (textPart?.text) {
          outputText = String(textPart.text);
        } else {
          const jsonPart = parts.find((p: any) => p?.inlineData?.mimeType?.includes('application/json'));
          if (jsonPart?.inlineData?.data) {
            outputText = decodeB64(jsonPart.inlineData.data);
          }
        }
        console.log('[procedure] models.generateContent response length:', outputText?.length ?? 0);

        // Record usage (best-effort)
        if (uid) {
          try {
            const fns = getFunctions(app as any, 'us-central1');
            httpsCallable(fns, 'recordCanvasUsage')({
              inputChars: prompt.length + 1000, // approximate image overhead
              outputChars: outputText?.length ?? 0,
              model: 'gemini-2.5-flash-lite',
            }).catch(() => {});
          } catch {}
        }

        // Extract JSON block
        let transcript = '';
        let isGoingWell = true;
        let reason = '';
        let score: number | null = null;
        try {
          const jsonMatch = outputText.match(/\{[\s\S]*\}/m);
          const jsonStr = jsonMatch ? jsonMatch[0] : outputText;
          const parsed = JSON.parse(jsonStr);
          transcript = String(parsed.transcript || '').trim();
          isGoingWell = Boolean(parsed.isGoingWell !== false);
          reason = String(parsed.reason || '').trim();
          const rawScore = Number(parsed.score);
          if (!Number.isNaN(rawScore)) {
            score = Math.min(5, Math.max(1, Math.round(rawScore)));
          }
          console.log('[procedure] parsed JSON from Gemini', { transcriptLen: transcript.length, isGoingWell, hasReason: !!reason });
          const preview = transcript.length > 220 ? `${transcript.slice(0, 220)}...` : transcript;
          console.info('[procedure] transcription preview:', preview || '<empty>');
          console.info('[procedure] analysis verdict:', { isGoingWell, reason: reason || '<none>', score });
        } catch {
          // Fallback: store raw text as transcript
          transcript = String(outputText || '').trim();
          isGoingWell = true;
          reason = '';
          score = null;
          console.warn('[procedure] failed to parse JSON; using raw text fallback');
          const preview = transcript.length > 220 ? `${transcript.slice(0, 220)}...` : transcript;
          console.info('[procedure] transcription preview (raw):', preview || '<empty>');
        }

        // Guardrail: if transcript appears to mostly copy the provided context, drop it
        try {
          const ctxPlain = String(contextBlock || '').replace(/\s+/g, ' ').toLowerCase();
          const trPlain = String(transcript || '').replace(/\s+/g, ' ').toLowerCase();
          const tokenize = (s: string) => s.split(/[^a-z0-9^/]+/i).filter(Boolean);
          const a = new Set(tokenize(ctxPlain));
          const b = new Set(tokenize(trPlain));
          let intersection = 0;
          b.forEach(t => { if (a.has(t)) intersection++; });
          const overlap = b.size > 0 ? intersection / Math.min(a.size || 1, b.size) : 0;
          const looksCopied = trPlain.length >= 30 && overlap >= 0.7;
          if (looksCopied) {
            console.log('[procedure] dropping transcript: high overlap with context', { overlap });
            transcript = '';
            score = null;
            if (!reason) {
              reason = 'No handwriting detected; ignoring copied context.';
            }
          }
        } catch (e) {
          console.warn('[procedure] overlap check failed', e);
        }

        // Throttle writes: only write when changes are meaningful
        const db = getFirestore(app);
        const ref = doc(db, 'users', auth.currentUser.uid, 'procedure', 'current');
        const lastSentRef = (runOcrOnce as any)._lastSent || { transcript: '', status: '', feedback: '', score: null as number | null };
        const nextPayload = {
          transcript,
          status: isGoingWell ? 'ok' as const : 'warning' as const,
          feedback: reason,
          score: score,
          updatedAt: Date.now(),
        };
        const changed = (
          nextPayload.status !== lastSentRef.status ||
          nextPayload.score !== lastSentRef.score ||
          Math.abs((nextPayload.transcript || '').length - (lastSentRef.transcript || '').length) >= 12 ||
          nextPayload.feedback !== lastSentRef.feedback
        );
        if (changed) {
          console.log('[procedure] writing transcript to Firestore');
          await setDoc(ref, nextPayload, { merge: true });
          (runOcrOnce as any)._lastSent = {
            transcript: nextPayload.transcript,
            status: nextPayload.status,
            feedback: nextPayload.feedback,
            score: nextPayload.score,
          };
        } else {
          console.log('[procedure] skipping Firestore write (no meaningful change)');
        }

        lastScanForDrawTsRef.current = lastDrawTs;
        console.log('[procedure] transcript write complete');
      } catch (err) {
        // Non-fatal; skip update on error
        console.error('[procedure] OCR/analysis error:', err);
      } finally {
        scanInFlightRef.current = false;
        try { console.groupEnd(); } catch {}
      }
    };

        // Trigger scan shortly after the user stops drawing, rather than polling
        let upTimeout: number | undefined;
        let penUpAt: number | null = null;
        const onPointerUp = () => {
          penUpAt = Date.now();
          if (upTimeout) window.clearTimeout(upTimeout);
          upTimeout = window.setTimeout(() => {
            const upForMs = penUpAt ? Date.now() - penUpAt : 0;
            // Only scan if pen has been up for at least 500ms, and no drawing resumed
            if (!isDrawingRef.current && upForMs >= 500) {
              runOcrOnce();
            } else {
              console.log('[procedure] skip scan: pen up duration too short or drawing resumed');
            }
          }, 520);
        };
        const canvas = canvasRef.current;
        canvas?.addEventListener('pointerup', onPointerUp);
        canvas?.addEventListener('pointercancel', onPointerUp);
        // Idle fallback: if pointerup is missed, run a scan ~1.2s after last draw
        let idleTimer: number | undefined;
        const scheduleIdleScan = () => {
          if (idleTimer) window.clearTimeout(idleTimer);
          idleTimer = window.setTimeout(() => {
            if (!isDrawingRef.current && lastScanForDrawTsRef.current < lastDrawTs) {
              runOcrOnce();
            }
          }, 1200);
        };
        // Schedule once on mount and whenever we stop drawing long enough
        scheduleIdleScan();
        return () => {
          if (upTimeout) window.clearTimeout(upTimeout);
          if (idleTimer) window.clearTimeout(idleTimer);
          canvas?.removeEventListener('pointerup', onPointerUp);
          canvas?.removeEventListener('pointercancel', onPointerUp);
          if (unsubContext) unsubContext();
        };
  }, [lastDrawTs, practiceActive]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setLastDrawTs(Date.now());
    hasInkSinceClearRef.current = false;
    console.log('[procedure] canvas cleared');
  };

  const performUndo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const current = canvas.toDataURL('image/png');
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push(current);
    const img = new Image();
    img.onload = () => {
      const ratio = window.devicePixelRatio || 1;
      const cssW = parseInt(canvas.style.width || '0', 10) || canvas.width / ratio;
      const cssH = parseInt(canvas.style.height || '0', 10) || canvas.height / ratio;
      const prevTransform = (ctx as any).getTransform?.();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.drawImage(img, 0, 0, cssW, cssH);
      if (prevTransform && typeof prevTransform === 'object') {
        ctx.setTransform(prevTransform);
      }
    };
    img.src = prev;
  };

  const performRedo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || redoStackRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(canvas.toDataURL('image/png'));
    const img = new Image();
    img.onload = () => {
      const ratio = window.devicePixelRatio || 1;
      const cssW = parseInt(canvas.style.width || '0', 10) || canvas.width / ratio;
      const cssH = parseInt(canvas.style.height || '0', 10) || canvas.height / ratio;
      const prevTransform = (ctx as any).getTransform?.();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.drawImage(img, 0, 0, cssW, cssH);
      if (prevTransform && typeof prevTransform === 'object') {
        ctx.setTransform(prevTransform);
      }
    };
    img.src = next;
  };

  return (
    <div className="w-full h-screen bg-background">
      <div className="flex items-center justify-between px-4 h-16 border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <div className="text-sm font-medium">CultivatED Canvas (Beta)</div>
        <div className="flex items-center gap-2">
          {/* Tool group */}
          <div className="flex items-center gap-1 border rounded-full px-1 py-1 bg-card">
            <Button variant={tool === 'pen' ? 'default' : 'outline'} size="sm" className="rounded-full h-8 px-3" onClick={() => setTool('pen')}>
              <Pen className="h-4 w-4 mr-2" /> Pen
            </Button>
            <Button variant={tool === 'highlighter' ? 'default' : 'outline'} size="sm" className="rounded-full h-8 px-3" onClick={() => setTool('highlighter')}>
              <HighlighterIcon className="h-4 w-4 mr-2" /> Highlight
            </Button>
            <Button variant={tool === 'eraser' ? 'default' : 'outline'} size="sm" className="rounded-full h-8 px-3" onClick={() => setTool('eraser')}>
              <Eraser className="h-4 w-4 mr-2" /> Erase
            </Button>
          </div>
          {/* Size & color */}
          <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-card">
            <button type="button" className="p-1 rounded-full hover:bg-accent" onClick={() => setSize((s) => Math.max(2, s - 1))} aria-label="Decrease size">
              <Minus className="h-4 w-4" />
            </button>
            <div className="text-xs text-muted-foreground w-16 text-center">{size}px</div>
            <button type="button" className="p-1 rounded-full hover:bg-accent" onClick={() => setSize((s) => Math.min(24, s + 1))} aria-label="Increase size">
              <Plus className="h-4 w-4" />
            </button>
            <div className="h-6 w-px bg-border mx-1" />
            <button type="button" className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-accent" onClick={() => colorInputRef.current?.click()}>
              <Palette className="h-4 w-4" />
              <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: color }} />
            </button>
            <input ref={colorInputRef} aria-label="Color" title="Color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="hidden" />
            <div className="hidden sm:flex items-center gap-1 ml-1">
              {['#ffffff','#111827','#ef4444','#3b82f6','#10b981','#f59e0b','#8b5cf6','#f97316','#6b7280'].map((c) => {
                const isSelected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    className={`h-4 w-4 rounded-full border hover:scale-110 transition-transform ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-background' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                );
              })}
            </div>
          </div>
          {/* Undo/redo/clear */}
          <div className="flex items-center gap-1 border rounded-full px-1 py-1 bg-card">
            <Button variant="outline" size="sm" className="rounded-full h-8 px-3" onClick={performUndo}>
              <Undo2 className="h-4 w-4 mr-2" /> Undo
            </Button>
            <Button variant="outline" size="sm" className="rounded-full h-8 px-3" onClick={performRedo}>
              <Redo2 className="h-4 w-4 mr-2" /> Redo
            </Button>
            <Button variant="outline" size="sm" className="rounded-full h-8 px-3" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-2" /> Clear
            </Button>
          </div>
          {/* Grid toggle & export */}
          <div className="flex items-center gap-1 border rounded-full px-1 py-1 bg-card">
            <Button variant="outline" size="sm" className="rounded-full h-8 px-3" onClick={() => setShowGrid((v) => !v)}>
              <GridIcon className="h-4 w-4 mr-2" /> {showGrid ? 'Hide Grid' : 'Show Grid'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-8 px-3"
              onClick={() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const link = document.createElement('a');
                link.download = `procedure-${new Date().toISOString().slice(0,19)}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
              }}
            >
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
          <div className={`text-xs px-2 py-1 rounded-full border ${connected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>{connected ? 'Connected' : 'Offline'}</div>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative w-full"
        style={{
          height: 'calc(100vh - 64px)',
          backgroundImage: showGrid ? 'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)' : 'none',
          backgroundSize: '20px 20px'
        }}
        onMouseEnter={() => setIsHoveringCanvas(true)}
        onMouseLeave={() => setIsHoveringCanvas(false)}
      >
        {practiceActiveLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="p-4 border rounded bg-white shadow text-center max-w-sm">
              <div className="flex items-center justify-center mb-2">
                <Loading size="md" variant="spinner" />
              </div>
              <div className="font-medium mb-1">Checking session…</div>
              <div className="text-sm text-neutral-600">Please wait while we verify your active practice session.</div>
            </div>
          </div>
        ) : (!practiceActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="p-4 border rounded bg-white shadow text-center max-w-sm">
              <div className="font-medium mb-1">No active practice session</div>
              <div className="text-sm text-neutral-600">Open a practice session on your main device to use the canvas.</div>
            </div>
          </div>
        ))}
        <canvas
          ref={canvasRef}
          className={`block w-full h-full touch-none ${tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'}`}
        />
      </div>
    </div>
  );
}


