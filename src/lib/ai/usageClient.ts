import type { AiUsage } from '@/lib/context/UserContext';

export const FREE_LIMITS = {
  voiceCalls: 10,
  chatMessages: 20,
  costCents: 50, // $0.50
} as const;

export function isLimitReached(usage: AiUsage | undefined | null): boolean {
  if (!usage) return false;
  return (
    usage.voiceCalls >= FREE_LIMITS.voiceCalls ||
    usage.chatMessages >= FREE_LIMITS.chatMessages ||
    usage.totalCostCents >= FREE_LIMITS.costCents
  );
}

export type LimitReason = 'voice' | 'chat' | 'cost';

export function limitReasons(usage: AiUsage | undefined | null): LimitReason[] {
  if (!usage) return [];
  const reasons: LimitReason[] = [];
  if (usage.voiceCalls >= FREE_LIMITS.voiceCalls) reasons.push('voice');
  if (usage.chatMessages >= FREE_LIMITS.chatMessages) reasons.push('chat');
  if (usage.totalCostCents >= FREE_LIMITS.costCents) reasons.push('cost');
  return reasons;
}

export function shouldBlockAi(
  usage: AiUsage | undefined | null,
  geminiApiKey: string | null | undefined,
): boolean {
  if (geminiApiKey) return false;
  return isLimitReached(usage);
}

// ---- Global popup trigger (simple event emitter) ----

type Listener = () => void;
const listeners = new Set<Listener>();

export function onAiLimitPopup(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function triggerAiLimitPopup(): void {
  listeners.forEach((fn) => fn());
}
