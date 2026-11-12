import "server-only";

type Window = { count: number; resetAt: number };

const MAX_TRACKED_KEYS = 5_000;
const windows = new Map<string, Window>();

// Fixed window, held in memory. On serverless hosting each instance counts for itself,
// so this limits runaway clients rather than enforcing an exact quota.
export const allowRequest = (
  key: string,
  limit: number,
  windowMs: number,
): boolean => {
  const now = Date.now();

  if (windows.size >= MAX_TRACKED_KEYS) {
    for (const [trackedKey, { resetAt }] of windows) {
      if (resetAt <= now) windows.delete(trackedKey);
    }
  }

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  current.count += 1;
  return current.count <= limit;
};

// The caller's IP for rate-limit keys. Vercel sets both headers itself and drops any
// value the client sent; behind another proxy x-forwarded-for can be spoofed, so
// never let an IP limit be the only one protecting something.
export const clientIp = (requestHeaders: Headers): string =>
  requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  requestHeaders.get("x-real-ip")?.trim() ||
  "unknown";
