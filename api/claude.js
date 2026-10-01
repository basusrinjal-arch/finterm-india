// Vercel serverless function: proxies a prompt to the Claude API with the API key kept
// server-side (set as the ANTHROPIC_API_KEY environment variable in the Vercel project,
// never in this file or in the front-end). The client only ever sends plain text; the
// model and token cap are fixed here so a visitor can't request an expensive model or a
// huge response against your key.
//
// Model choice: Haiku, deliberately - this endpoint has no auth and anyone visiting the
// public site can call it, so cost-per-request is kept low by design. Swap MODEL below
// if you want higher-quality answers and are comfortable with the cost tradeoff.

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 500;

// Restrict to your deployed GitHub Pages origin. Update this if you fork/rename the repo
// or host it elsewhere - a mismatch here just means the browser blocks the response, it
// won't break anything else.
const ALLOWED_ORIGIN = 'https://basusrinjal-arch.github.io';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Server misconfigured: ANTHROPIC_API_KEY is not set in the Vercel project.' }); return; }

  const prompt = req.body && req.body.prompt;
  if (!prompt || typeof prompt !== 'string' || prompt.length > 4000) {
    res.status(400).json({ error: 'Missing or invalid "prompt" (must be a string under 4000 chars).' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Upstream request to Claude API failed: ' + e.message });
  }
};
