#!/usr/bin/env node
// Standalone local log generator for Trace Miner's Live page, plus a
// /suggest-fix endpoint the Miner calls for newly-mined patterns.
//
// Zero npm dependencies — Node's built-in `http`/`https` modules only,
// matching the rest of this project's zero-build ethos. /stream pushes
// synthetic log lines to any connected browser tab over Server-Sent Events;
// /suggest-fix proxies a single call to the OpenAI API so the API key stays
// server-side instead of sitting in browser code.
//
// This is a stand-in for a real monitoring-tool feed, not an integration
// with one — see DEVLOG (kept outside this repo) for why that's the
// deliberate choice for a demo: no vendor auth/CORS/hosting, and full
// control over the demo narrative.
//
// Usage:
//   node tools/live-log-server.js [port]
// Reads OPENAI_API_KEY from a .env file next to this script if present
// (never commit that file — see .gitignore), or from the environment
// directly, e.g.:
//   OPENAI_API_KEY=sk-proj-... node tools/live-log-server.js [port]
// Then in the app's Live page, connect to http://127.0.0.1:<port>/stream
// /suggest-fix works without an API key set too — it just responds 503 and
// the app keeps showing its placeholder fix text instead of an AI one.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Minimal .env loader — zero npm deps, matching the rest of this file.
// Only sets vars that aren't already in the environment, so an explicit
// `OPENAI_API_KEY=... node tools/live-log-server.js` still wins.
(function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  let text;
  try { text = fs.readFileSync(envPath, 'utf8'); }
  catch { return; }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
})();

const PORT = Number(process.argv[2] || process.env.PORT || 8090);

// Mostly noise, several lines that reuse the seeded knowledge base's
// keyword phrases (data/sample-logs.js: P-001 connection-pool, P-002
// auth-service timeout/circuit-breaker, P-003 OOMKilled) so live matching
// lights up convincingly, plus a few distinctive "never seen before"
// signatures that should surface as new-pattern candidates on the first
// live-analyze cycle they appear in.
const NOISE = [
  ['INFO', 'healthcheck GET /healthz 200 2ms'],
  ['INFO', 'api-gateway request POST /v2/checkout 201 44ms'],
  ['INFO', 'scheduler assigned pod checkout-9f1 to node ip-10-4-2-190'],
  ['INFO', 'HPA scaling auth-service 4 replicas -> 6 replicas'],
  ['INFO', 'cache warm complete for catalog-service (18422 keys)'],
  ['WARN', 'upstream auth-service p95 latency 640ms (threshold 400ms)'],
  ['WARN', 'node ip-10-4-2-190 memory pressure: 88% (threshold 85%)'],
];

const KNOWN = [
  ['ERROR', 'upstream auth-service timeout after 5000ms on POST /v2/token'],
  ['ERROR', 'circuit breaker OPEN for auth-service (4 failures / 9s)'],
  ['ERROR', 'connection pool at capacity: 200/200 active, 63 waiting'],
  ['ERROR', 'connection timeout after 5000ms (pool exhausted)'],
  ['ERROR', 'pod auth-service-2f7 OOMKilled (limit 512Mi, usage 540Mi)'],
  ['ERROR', 'pod auth-service-6c9 OOMKilled (limit 512Mi, usage 519Mi)'],
];

// `mineNewPatterns` (data/pattern-engine.js) signs each freshly-mined pattern
// by a line's first 3 content-word tokens, then folds that signature's
// keywords back into the KB — so any later line with the *same* leading
// tokens legitimately matches the pattern it just created instead of being
// re-mined. A fixed handful of NOVEL lines therefore has a hard, fast ceiling
// on how many new patterns can ever appear (one per distinct template, once).
// To keep live demos interesting for longer, build NOVEL as every
// service x template combination — the service name is always among a
// line's first 3 tokens, so each pairing is its own distinct signature.
const NOVEL_SERVICES = [
  'ledger-service', 'checkout-service', 'pricing-service', 'inventory-service',
  'shipping-service', 'notification-service', 'fraud-service', 'loyalty-service',
  'refund-service', 'tax-service',
];
const NOVEL_TEMPLATES = [
  (svc) => ['ERROR', `${svc} grpc DeadlineExceeded calling balance-service after 3000ms`],
  (svc) => ['ERROR', `${svc} payment webhook signature mismatch, dropping event evt_${1000 + Math.floor(Math.random() * 9000)}`],
  (svc) => ['FATAL', `${svc}: panic, index out of range [12] with length 8 at handler.go:88`],
  (svc) => ['ERROR', `${svc} redis SETEX failed: connection reset by peer`],
  (svc) => ['ERROR', `${svc} kafka consumer group rebalance stalled for 45s`],
];
const NOVEL = NOVEL_SERVICES.flatMap(svc => NOVEL_TEMPLATES.map(t => t(svc)));

let seq = 0;
function nextLine() {
  const roll = Math.random();
  const pool = roll < 0.55 ? NOISE : roll < 0.9 ? KNOWN : NOVEL;
  const [level, msg] = pool[Math.floor(Math.random() * pool.length)];
  seq += 1;
  return { ts: new Date().toISOString(), level, msg, raw: msg, seq };
}

const clients = new Set();

function schedule(res) {
  const delay = 500 + Math.random() * 1200;
  const timer = setTimeout(() => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(nextLine())}\n\n`);
    schedule(res);
  }, delay);
  clients.add({ res, timer });
}

const { readJsonBody, callOpenAI } = require('./suggest-fix');

async function handleSuggestFix(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY not set on the server' }));
    return;
  }
  let pattern;
  try { pattern = await readJsonBody(req, 1e6); }
  catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Invalid request body: ' + e.message }));
    return;
  }
  try {
    const fixJson = await callOpenAI(pattern);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(fixJson));
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/suggest-fix') {
    handleSuggestFix(req, res);
    return;
  }
  if (req.method === 'OPTIONS' && req.url === '/suggest-fix') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.url !== '/stream') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found. Connect to /stream, or POST to /suggest-fix.');
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  schedule(res);

  req.on('close', () => {
    for (const c of clients) {
      if (c.res === res) { clearTimeout(c.timer); clients.delete(c); }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Trace Miner live-log generator running.`);
  console.log(`Connect the app's Live page to: http://127.0.0.1:${PORT}/stream`);
  console.log(`AI fix suggestions: POST http://127.0.0.1:${PORT}/suggest-fix` + (process.env.OPENAI_API_KEY ? '' : ' (OPENAI_API_KEY not set — will return 503)'));
  console.log('Ctrl+C to stop.');
});
