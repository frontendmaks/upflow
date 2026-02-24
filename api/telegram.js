// api/telegram.js — test + send Telegram
// Token/ChatId: from request body (browser localStorage) OR env vars
const https = require('https');

function tgPost(token, chatId, text) {
  const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 8000,
    }, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(d) })); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload); req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  let body = '';
  await new Promise(r => { req.on('data', c => body += c); req.on('end', r); });
  const { action, token: bodyToken, chatId: bodyChat, text } = (() => { try { return JSON.parse(body); } catch(e) { return {}; } })();

  // Priority: body params → env vars
  const token  = bodyToken  || process.env.TG_TOKEN   || '';
  const chatId = bodyChat   || process.env.TG_CHAT_ID || '';

  if (!token || !chatId) return res.status(400).json({ ok: false, error: 'TG_TOKEN and TG_CHAT_ID required' });

  try {
    if (action === 'test') {
      const r = await tgPost(token, chatId, '✅ *UpFlow connected!*\n\nYou will receive push notifications for Upwork jobs matching 95%+');
      return res.status(200).json({ ok: r.body.ok, error: r.body.description });
    }
    if (action === 'send' && text) {
      const r = await tgPost(token, chatId, text);
      return res.status(200).json({ ok: r.body.ok });
    }
    res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
};
