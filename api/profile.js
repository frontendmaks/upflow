const https = require('https');

function upworkGet(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.upwork.com', path, method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000,
    }, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, body: d })); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const accessToken = process.env.UPWORK_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(200).json({ source: 'none', reason: process.env.UPWORK_CLIENT_ID ? 'API pending approval' : 'No credentials' });
  }
  try {
    const r = await upworkGet('/api/auth/v1/info.json', accessToken);
    if (r.status !== 200) return res.status(200).json({ source: 'none', reason: 'API error ' + r.status });
    return res.status(200).json({ source: 'live', data: JSON.parse(r.body) });
  } catch(e) {
    return res.status(200).json({ source: 'none', reason: e.message });
  }
};
