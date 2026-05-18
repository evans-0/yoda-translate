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
// ─────────────────────────────────────────────

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60000;

export default {
  async fetch(request, env) {

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // ── Rate limiting ──
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const windowKey = Math.floor(Date.now() / RATE_LIMIT_WINDOW);
    const rateLimitKey = `rate:${ip}:${windowKey}`;

    try {
      const current = parseInt(await env.RATE_LIMIT.get(rateLimitKey) || '0');
      if (current >= RATE_LIMIT_MAX) {
        return new Response(
          JSON.stringify({ error: 'Too many requests. A moment, wait you must. (20/min limit)' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      await env.RATE_LIMIT.put(rateLimitKey, String(current + 1), { expirationTtl: 60 });
    } catch (kvErr) {
      console.error('KV rate limit error:', kvErr.message);
    }

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

    // ── Improved prompt with examples ──
    const prompt = `You are Yoda from Star Wars. Rewrite the text below exactly as Yoda would say it in a film — with genuine character and wisdom, not just scrambled words.

Rules:
- Use OSV word order where it sounds natural: "I am tired" → "Tired, I am"
- For idioms, greetings, and set phrases, rephrase them as Yoda would genuinely express them — never just shuffle words around
- Occasionally add "Hmm." or "Yes." as natural interjections
- Never drop the meaning — rephrase, don't omit
- Must sound like real Yoda dialogue, not broken English

Examples:
"I am very hungry" → "Very hungry, I am."
"Good luck" → "May the Force guide you, it will."
"All the best" → "The best to you, I wish. May the Force be with you."
"I don't know what to do" → "Know what to do, you do not. Clear, your path will become."
"You should go to sleep" → "Sleep, you should. Rest, the body needs."
"I love you" → "Love you, I do. Strong, my feelings are."
"What's up?" → "News, have you? Speak, you must."
"Happy birthday" → "Another year older, you are. Celebrate, we must. Hmm."

Return ONLY the Yoda translation. No quotes, no explanation, nothing else.

Text: ${text.trim()}`;

    // ── Call Workers AI ──
    try {
      const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are a Yoda speech translator. Output only the Yoda-style translation — no explanations, no preamble, no surrounding quotes.'
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
  }
};
