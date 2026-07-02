// Fixed-window rate limiter keyed by client IP, 5 requests per minute per IP.
// State is per server instance — on Vercel each instance has its own map, so
// this is best-effort abuse protection, not a hard global limit.

const MAX_REQUESTS = 5;
const WINDOW_MS = 60_000;
const SWEEP_THRESHOLD = 1_000;

type Window = { count: number; windowStart: number };

const buckets = new Map<string, Window>();

function getClientIp(request: Request): string {
  // Vercel overwrites x-forwarded-for at the edge, so the first entry is the
  // real client IP there; elsewhere it's only as trustworthy as the proxy.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function checkRateLimit(request: Request): boolean {
  const ip = getClientIp(request);
  const now = Date.now();

  if (buckets.size > SWEEP_THRESHOLD) {
    for (const [key, window] of buckets) {
      if (now - window.windowStart >= WINDOW_MS) {
        buckets.delete(key);
      }
    }
  }

  const window = buckets.get(ip);
  if (!window || now - window.windowStart >= WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return true;
  }

  window.count++;
  return window.count <= MAX_REQUESTS;
}
