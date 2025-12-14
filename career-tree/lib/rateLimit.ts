import { RateLimiter } from "limiter";

// Allow 5 requests per minute per server instance
const limiter = new RateLimiter({ tokensPerInterval: 7, interval: "minute" });

export async function checkRateLimit() {
  // tryRemoveTokens returns true immediately if a token is available,
  // otherwise it returns false immediately without waiting.
  return limiter.tryRemoveTokens(1);
}