// Vercel serverless counterpart of POST /suggest-fix in tools/live-log-server.js.
// Set OPENAI_API_KEY (and optionally OPENAI_MODEL) in the Vercel project env.
const { callOpenAI } = require('../tools/suggest-fix');

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
  try {
    res.status(200).json(await callOpenAI(req.body || {}));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
