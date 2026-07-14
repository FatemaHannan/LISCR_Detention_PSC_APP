// Rate limiter for Anthropic API calls
// Max 10 calls per minute per session
const calls = [];
const MAX_CALLS = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

export function checkRateLimit() {
  const now = Date.now();
  // Remove calls older than 1 minute
  const recent = calls.filter(t => now - t < WINDOW_MS);
  calls.length = 0;
  calls.push(...recent);
  
  if (calls.length >= MAX_CALLS) {
    const oldest = calls[0];
    const waitSecs = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);
    throw new Error(`Rate limit reached. Please wait ${waitSecs} seconds before analyzing another document.`);
  }
  calls.push(now);
  return true;
}

export function getRemainingCalls() {
  const now = Date.now();
  const recent = calls.filter(t => now - t < WINDOW_MS);
  return Math.max(0, MAX_CALLS - recent.length);
}
