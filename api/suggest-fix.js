// Vercel serverless counterpart of POST /suggest-fix in tools/live-log-server.js.
// Set OPENAI_API_KEY (and optionally OPENAI_MODEL) in the Vercel project env.
//
// Rate limiting (per client IP, fixed window). Tunable via env:
//   RATE_LIMIT_MAX     requests allowed per window   (default 10)
//   RATE_LIMIT_WINDOW  window length in seconds      (default 600)
// If UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN) are set, counts live
// in Redis and are shared across all instances. Otherwise an in-memory counter is
// used, which is best-effort only (each serverless instance counts separately).
const { callOpenAI } = require('../tools/suggest-fix');

const MAX = Number(process.env.RATE_LIMIT_MAX || 10);
const WINDOW = Number(process.env.RATE_LIMIT_WINDOW || 600);
const MAX_BODY_BYTES = 200 * 1024;

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const memory = new Map(); // ip -> { count, resetAt }

async function hit(ip) {
  if (REDIS_URL && REDIS_TOKEN) {
    const key = `tm:rl:${ip}`;
    const r = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, WINDOW, 'NX'], ['TTL', key]]),
    });
    const out = await r.json();
    return { count: out[0].result, retryAfter: Math.max(out[2].result, 1) };
  }
  const now = Date.now();
  for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
  let e = memory.get(ip);
  if (!e) { e = { count: 0, resetAt: now + WINDOW * 1000 }; memory.set(ip, e); }
  e.count++;
  return { count: e.count, retryAfter: Math.max(Math.ceil((e.resetAt - now) / 1000), 1) };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'POST only' });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: 'OPENAI_API_KEY not set on the server' });
    return;
  }

  const body = req.body || {};
  if (JSON.stringify(body).length > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'Request body too large' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  try {
    const { count, retryAfter } = await hit(ip);
    res.setHeader('X-RateLimit-Limit', MAX);
    res.setHeader('X-RateLimit-Remaining', Math.max(MAX - count, 0));
    if (count > MAX) {
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({ error: `Rate limit exceeded. Try again in ${retryAfter}s.` });
      return;
    }
  } catch (e) {
    // Limiter backend down: fail closed rather than expose an unmetered key.
    res.status(503).json({ error: 'Rate limiter unavailable' });
    return;
  }

  try {
    res.status(200).json(await callOpenAI(body));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
