// ─────────────────────────────────────────────
// Yoda Speak — Cloudflare Worker
// Deploy at: workers.cloudflare.com
//
// 1. Create a new Worker, paste this code
// 2. Worker → Settings → Bindings → Add binding:
//    Type: Workers AI — Variable name: AI
// 3. Workers & Pages → KV → Create namespace: RATE_LIMIT
//    Worker → Settings → Bindings → KV Namespace:
//    Variable name: RATE_LIMIT → select namespace → Save
// 4. Save & Deploy
//
// No external API key needed — Workers AI is built into Cloudflare!
// ─────────────────────────────────────────────

const RATE_LIMIT_MAX = 20;       // max requests per IP per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms

export default {
  async fetch(request, env) {

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // ── Rate limiting via KV ──────────────────────────────────────────
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const windowKey = Math.floor(Date.now() / RATE_LIMIT_WINDOW);
    const rateLimitKey = `rate:${ip}:${windowKey}`;

    try {
      const current = parseInt(await env.RATE_LIMIT.get(rateLimitKey) || '0');

      if (current >= RATE_LIMIT_MAX) {
        return new Response(
          JSON.stringify({ error: 'Too many requests. A moment, wait you must. (Rate limit: 20/min)' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Increment counter, expire after 60 seconds
      await env.RATE_LIMIT.put(rateLimitKey, String(current + 1), { expirationTtl: 60 });

    } catch (kvErr) {
      console.error('KV rate limit error (is RATE_LIMIT namespace bound?):', kvErr.message);
    }
    // ─────────────────────────────────────────────────────────────────

    // Parse incoming request
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'No text provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (text.length > 500) {
      return new Response(JSON.stringify({ error: 'Text too long. 500 characters max.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build prompt
    const prompt = `Convert the following text to Yoda's speech pattern from Star Wars.

Rules:
- Object-Subject-Verb word order: "I am tired" becomes "Tired, I am"
- Move predicates to the front: "I will help you" becomes "Help you, I will"
- Drop articles occasionally
- Add "Hmm." or "Yes." as rare interjections
- Preserve the full meaning

Return ONLY the translated Yoda text. No quotes, no explanation.

Text: ${text.trim()}`;

    // ── Call Cloudflare Workers AI ────────────────────────────────────
    try {
      const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are a Yoda speech translator. Return only the Yoda-style translation, nothing else.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 600
      });

      const translated = aiRes?.response?.trim();

      if (!translated) {
        return new Response(JSON.stringify({ error: 'Empty response from AI' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ translated }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Workers AI error: ' + err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    // ─────────────────────────────────────────────────────────────────
  }
};
