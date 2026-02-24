const https = require('https');
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const apiKey = process.env.CLAUDE_KEY || '';
  if (!apiKey) return res.status(400).json({ error: 'CLAUDE_KEY not set in Vercel environment variables' });
  let body = '';
  await new Promise(r => { req.on('data', c => body += c); req.on('end', r); });
  let parsed;
  try { parsed = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  const payload = JSON.stringify({
    model: parsed.model || 'claude-sonnet-4-20250514',
    max_tokens: parsed.max_tokens || 1000,
    messages: parsed.messages,
    system: parsed.system,
  });
  try {
    const result = await new Promise((resolve, reject) => {
      const r = https.request({
        hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        timeout: 25000,
      }, (resp) => { let data = ''; resp.on('data', c => data += c); resp.on('end', () => resolve({ status: resp.statusCode, body: data })); });
      r.on('error', reject); r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
      r.write(payload); r.end();
    });
    res.status(result.status).setHeader('Content-Type', 'application/json').send(result.body);
  } catch(e) { res.status(500).json({ error: e.message }); }
};
