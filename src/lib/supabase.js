import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Wraps fetch with automatic retry for transient network failures (e.g. brief regional
// connectivity blips) — retries up to 2 times with a short backoff before giving up, so a
// rare hiccup doesn't require the user to manually hard-refresh the page.
async function fetchWithRetry(url, options, retries = 2, backoffMs = 500) {
  try {
    const res = await fetch(url, options);
    // Retry on server-side errors (5xx) too, not just network failures — these can also be transient
    if (!res.ok && res.status >= 500 && retries > 0) {
      await new Promise(r => setTimeout(r, backoffMs));
      return fetchWithRetry(url, options, retries - 1, backoffMs * 2);
    }
    return res;
  } catch (err) {
    // Network-level failure (e.g. "Failed to fetch") — retry if attempts remain
    if (retries > 0) {
      await new Promise(r => setTimeout(r, backoffMs));
      return fetchWithRetry(url, options, retries - 1, backoffMs * 2);
    }
    throw err;
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: fetchWithRetry },
});
