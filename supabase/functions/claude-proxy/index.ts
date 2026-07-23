// Supabase Edge Function: claude-proxy
// Purpose: proxies requests to Anthropic's API so the real API key never has to be shipped to the browser.
// The frontend calls this function's URL instead of https://api.anthropic.com/v1/messages directly.
// The real key lives only here, as a server-side secret (set via `supabase secrets set ANTHROPIC_API_KEY=...`),
// and is never included in any response sent back to the browser.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // tighten to your app's actual domain once deployed, e.g. "https://yourapp.com"
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server misconfiguration: ANTHROPIC_API_KEY not set" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    // If the request asked for streaming, pass the raw SSE stream straight through
    // instead of buffering it — buffering would break real-time chat (the app reads
    // this response with response.body.getReader() and expects live chunks).
    if (body.stream) {
      return new Response(anthropicRes.body, {
        status: anthropicRes.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": anthropicRes.headers.get("Content-Type") || "text/event-stream",
        },
      });
    }

    const data = await anthropicRes.json();
    return new Response(JSON.stringify(data), {
      status: anthropicRes.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
