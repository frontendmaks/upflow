const https = require('https');

function httpsPost(host, path, payload, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request({
      hostname: host, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
      timeout: 8000,
    }, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, body: d })); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method === 'GET') {
    return res.status(200).json({
      claude:  !!process.env.CLAUDE_KEY,
      tg:      !!(process.env.TG_TOKEN && process.env.TG_CHAT_ID),
      // tg:  !!('7885491612:AAG_fF3aQwc4uqzcBdCboS_VO6ehZ6Q5pTE' && '359986040'),
      upwork:  !!(process.env.UPWORK_CLIENT_ID && process.env.UPWORK_SECRET),
      scoreAlert: parseInt(process.env.SCORE_ALERT || '95'),
    });
  }

  let body = '';
  await new Promise(r => { req.on('data', c => body += c); req.on('end', r); });
  const { action } = (() => { try { return JSON.parse(body); } catch(e) { return {}; } })();

  if (action === 'test_claude') {
    const key = process.env.CLAUDE_KEY;
    if (!key) return res.status(200).json({ ok: false, error: 'CLAUDE_KEY not set in Vercel' });
    try {
      const r = await httpsPost('api.anthropic.com', '/v1/messages',
        { model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] },
        { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
      );
      const d = JSON.parse(r.body);
      return res.status(200).json({ ok: r.status === 200, model: d.model, error: d.error?.message });
    } catch(e) { return res.status(200).json({ ok: false, error: e.message }); }
  }

  if (action === 'test_telegram') {
    const token = process.env.TG_TOKEN, chatId = process.env.TG_CHAT_ID;
    console.log(token);
    if (!token || !chatId) return res.status(200).json({ ok: false, error: 'TG_TOKEN or TG_CHAT_ID not set in Vercel' });
    try {
      const payload = JSON.stringify({ chat_id: chatId, text: '✅ *UpFlow* — Telegram connected!', parse_mode: 'Markdown' });
      const r = await new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, timeout: 8000 },
          (resp) => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => resolve(JSON.parse(d))); });
        req.on('error', reject); req.write(payload); req.end();
      });
      return res.status(200).json({ ok: r.ok, error: r.description });
    } catch(e) { return res.status(200).json({ ok: false, error: e.message }); }
  }

  if (action === 'test_upwork') {
    const id = process.env.UPWORK_CLIENT_ID;
    if (!id) return res.status(200).json({ ok: false, error: 'UPWORK_CLIENT_ID not set in Vercel' });
    return res.status(200).json({ ok: true, note: 'Credentials present. Awaiting Upwork API approval.' });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
