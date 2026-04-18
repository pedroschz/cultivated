import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

// ---------------------------------------------------------------------------
// Free-tier limits (lifetime)
// ---------------------------------------------------------------------------
export const FREE_LIMITS = {
  voiceCalls: 10,
  chatMessages: 20,
  costCents: 50, // $0.50
} as const;

// ---------------------------------------------------------------------------
// Per-model pricing (cents per 1 M tokens).  Keep this in sync with the
// published Gemini pricing page.
// ---------------------------------------------------------------------------
interface ModelPrice { inputPer1M: number; outputPer1M: number }

const MODEL_PRICES: Record<string, ModelPrice> = {
  'gemini-2.0-flash':                              { inputPer1M: 10,  outputPer1M: 40  },
  'gemini-2.5-flash':                              { inputPer1M: 15,  outputPer1M: 60  },
  'gemini-2.5-flash-lite':                         { inputPer1M: 5,   outputPer1M: 20  },
  'gemini-2.5-flash-native-audio-preview-12-2025': { inputPer1M: 15,  outputPer1M: 60  },
};

const DEFAULT_PRICE: ModelPrice = { inputPer1M: 15, outputPer1M: 60 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface AiState {
  voiceCalls: number;
  chatMessages: number;
  totalCostCents: number;
  geminiApiKey: string | null;
}

export async function getUserAiState(uid: string): Promise<AiState> {
  const snap = await getFirestore().doc(`users/${uid}`).get();
  const data = snap.data() ?? {};
  const u = data.aiUsage ?? {};
  return {
    voiceCalls: u.voiceCalls ?? 0,
    chatMessages: u.chatMessages ?? 0,
    totalCostCents: u.totalCostCents ?? 0,
    geminiApiKey: data.geminiApiKey ?? null,
  };
}

export async function assertWithinLimits(uid: string): Promise<AiState> {
  const state = await getUserAiState(uid);
  if (state.geminiApiKey) return state;

  const reasons: string[] = [];
  if (state.voiceCalls >= FREE_LIMITS.voiceCalls) reasons.push('voice');
  if (state.chatMessages >= FREE_LIMITS.chatMessages) reasons.push('chat');
  if (state.totalCostCents >= FREE_LIMITS.costCents) reasons.push('cost');

  if (reasons.length > 0) {
    throw new HttpsError('resource-exhausted', 'AI_LIMIT_REACHED', { reasons });
  }
  return state;
}

/**
 * Returns the Gemini API key to use for a given user.  If the user has their
 * own key it is returned; otherwise `fallbackKey` (the platform secret) is
 * returned.
 */
export function getGeminiKeyForUser(state: AiState, fallbackKey: string): string {
  return state.geminiApiKey || fallbackKey;
}

// ---------------------------------------------------------------------------
// Usage recorders (best-effort, never throw)
// ---------------------------------------------------------------------------

export async function recordChatMessage(uid: string): Promise<void> {
  try {
    await getFirestore().doc(`users/${uid}`).set({
      aiUsage: {
        chatMessages: FieldValue.increment(1),
        lastUsageAt: FieldValue.serverTimestamp(),
      },
    }, { merge: true });
  } catch (e) {
    console.error('[aiUsage] recordChatMessage failed', uid, e);
  }
}

export async function recordVoiceCall(uid: string): Promise<void> {
  try {
    await getFirestore().doc(`users/${uid}`).set({
      aiUsage: {
        voiceCalls: FieldValue.increment(1),
        lastUsageAt: FieldValue.serverTimestamp(),
      },
    }, { merge: true });
  } catch (e) {
    console.error('[aiUsage] recordVoiceCall failed', uid, e);
  }
}

export function computeCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICES[model] ?? DEFAULT_PRICE;
  return Math.ceil((inputTokens * p.inputPer1M + outputTokens * p.outputPer1M) / 1_000_000);
}

export async function recordTokenCost(
  uid: string,
  model: string,
  usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | null | undefined,
): Promise<void> {
  if (!usageMetadata) return;
  try {
    const input = usageMetadata.promptTokenCount ?? 0;
    const output = usageMetadata.candidatesTokenCount ?? 0;
    const cents = computeCostCents(model, input, output);
    if (cents <= 0) return;
    await getFirestore().doc(`users/${uid}`).set({
      aiUsage: {
        totalCostCents: FieldValue.increment(cents),
        lastUsageAt: FieldValue.serverTimestamp(),
      },
    }, { merge: true });
  } catch (e) {
    console.error('[aiUsage] recordTokenCost failed', uid, e);
  }
}
