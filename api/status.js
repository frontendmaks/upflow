// api/status.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  res.status(200).json({
    ok: true,
    env: {
      claudeKey:  !!process.env.CLAUDE_KEY,
      tgToken:    !!process.env.TG_TOKEN,
      tgChatId:   !!process.env.TG_CHAT_ID,
      scoreAlert: parseInt(process.env.SCORE_ALERT || '95'),
    },
    ts: new Date().toISOString(),
  });
};
