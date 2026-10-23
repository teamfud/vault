import "server-only";

// Fixed-window failure counter. In-memory is fine: the app runs as a single
// Railway replica, and a restart clearing counters is acceptable.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;

export function isLimited(key: string, max: number): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt < Date.now()) return false;
  return b.count >= max;
}

export function recordFailure(key: string) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else b.count++;
}

export function clearFailures(key: string) {
  buckets.delete(key);
}
