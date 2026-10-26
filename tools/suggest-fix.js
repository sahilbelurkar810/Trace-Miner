// Shared OpenAI fix-suggestion logic, used by tools/live-log-server.js (local)
// and api/suggest-fix.js (Vercel).
const https = require('https');

// ---- /suggest-fix: proxy a single OpenAI call so the API key never has to
// live in browser code. Given a newly-mined pattern's evidence, asks for a
// suggested fix + human_intervention runbook in the exact shape every
// hand-authored knowledge_base.json pattern already uses (data/sample-logs.js)
// so the app's rendering code needs no "AI vs human" branching on the shape.
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SUGGEST_FIX_SYSTEM_PROMPT = `You are a senior SRE triaging a failure signature a log-mining tool just discovered for the first time (no human has looked at it yet). Given the pattern's title, description, category, keywords, and example log lines, respond with ONLY a JSON object, no prose, no code fences, matching exactly this shape:
{"fix": "string, 1-3 sentences, concrete and actionable", "human_intervention": {"required": boolean, "owner": "string, a plausible team/role", "severity": "P1"|"P2"|"P3", "runbook": "string, 1-3 sentences of concrete triage/remediation steps", "escalation": "string, 1 sentence describing when/who to escalate to"}}

You will also be given the full existing knowledge base — every other pattern already on record, each with the fix that was suggested and, when present, the fix a human actually applied historically. It is NOT pre-filtered to "related" patterns — decide for yourself which entries (if any) are actually relevant to the new pattern, including ones that share the same failing service or root cause family even if their wording differs. When you find a genuine match, prefer adapting its proven fix — especially an applied_fix, since that's a confirmed real-world resolution, not just a suggestion — over inventing something unrelated. If nothing in the knowledge base is actually relevant, say so to yourself and build the fix solely from this new pattern's own evidence instead of forcing a weak match.`;

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) { reject(new Error('Request body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function callOpenAI(pattern) {
  return new Promise((resolve, reject) => {
    const userContent = [
      `Title: ${pattern.title || ''}`,
      `Category: ${pattern.category || 'unknown'}`,
      `Description: ${pattern.description || ''}`,
      `Keywords: ${(pattern.keywords || []).join(', ')}`,
      `Example log lines:`,
      ...(pattern.examples || []).map((e) => `  - ${e}`),
      ...((pattern.knowledgeBase || []).length ? [
        '',
        `Full existing knowledge base (${pattern.knowledgeBase.length} other patterns on record):`,
        ...pattern.knowledgeBase.map((p) =>
          `  - [${p.category || 'unknown'}] ${p.id} "${p.title}" (keywords: ${(p.keywords||[]).join(', ')}) — suggested fix: ${p.fix || 'none on record'}` +
          (p.applied_fix ? ` | actually applied: ${p.applied_fix}` : '')
        ),
      ] : []),
    ].join('\n');

    const payload = JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: SUGGEST_FIX_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`OpenAI API returned ${res.statusCode}: ${body.slice(0, 300)}`));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          const content = parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
          if (!content) { reject(new Error('OpenAI response had no message content')); return; }
          const fixJson = JSON.parse(content);
          if (!fixJson.fix || !fixJson.human_intervention) { reject(new Error('OpenAI response missing fix/human_intervention')); return; }
          resolve(fixJson);
        } catch (e) { reject(new Error('Failed to parse OpenAI response: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { readJsonBody, callOpenAI };
