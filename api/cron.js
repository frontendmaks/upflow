// api/cron.js — Vercel Cron Job (runs every hour via vercel.json)
// Pre-fetches RSS, AI-scores top jobs, sends Telegram alerts for 95%+ matches

const https = require('https');

// Reuse scoring logic inline (can't import from api/jobs.js in Vercel)
const RSS_FEEDS = [
  { cat: 'seo_geo', label: 'SEO & GEO', q: 'technical SEO audit specialist' },
  { cat: 'seo_geo', label: 'SEO & GEO', q: 'GEO generative engine optimization' },
  { cat: 'seo_geo', label: 'SEO & GEO', q: 'SEO specialist SaaS' },
  { cat: 'seo_geo', label: 'SEO & GEO', q: 'local SEO google business profile' },
  { cat: 'ads',     label: 'Ads',       q: 'google ads PPC specialist' },
  { cat: 'ads',     label: 'Ads',       q: 'meta facebook ads specialist' },
  { cat: 'analytics', label: 'Analytics & GTM', q: 'google tag manager GTM setup' },
  { cat: 'analytics', label: 'Analytics & GTM', q: 'GA4 google analytics 4 setup' },
];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const { URL } = require('url');
    const p = new URL(url);
    const req = https.request({ hostname: p.hostname, path: p.pathname + p.search, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, (r) => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); }); req.end();
  });
}

function parseRSSBasic(xml, feed) {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  return items.slice(0, 8).map(item => {
    const get = tag => { const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return m?(m[1]||m[2]||'').trim():''; };
    const title = get('title'); if (!title) return null;
    const desc = get('description').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    const pubDate = get('pubDate'); const link = get('link');
    const age = pubDate ? Date.now() - new Date(pubDate).getTime() : 999999999;
    const budget = (desc.match(/\$[\d,]+(?:\/hr)?/i)||['—'])[0];
    return { title, desc: desc.substring(0, 400), url: link, budget, cat: feed.cat, catLabel: feed.label, pubDate: pubDate || new Date().toISOString(), ageMs: age };
  }).filter(Boolean);
}

function quickScore(title, desc, cat) {
  let s = 35 + ({ seo_geo:20, analytics:18, ads:12, dev:8 }[cat]||0);
  const t = (title+' '+desc).toLowerCase();
  if (/technical seo|site audit|core web vitals/i.test(t)) s+=15;
  if (/ga4|gtm|tag manager/i.test(t)) s+=15;
  if (/geo|ai search|perplexity|generative engine/i.test(t)) s+=20;
  if (/saas|b2b software/i.test(t)) s+=10;
  if (/local seo|google business/i.test(t)) s+=10;
  if (/long.?term|ongoing|retainer/i.test(t)) s+=10;
  if (/cheap|affordable|low budget/i.test(t)) s-=18;
  if (/guaranteed rank|100 backlinks/i.test(t)) s-=30;
  return Math.min(99, Math.max(5, Math.round(s)));
}

async function aiScore(job, key) {
  const payload = JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:100, system:`Score Upwork job for Maksym Kotsupyra, SEO&GEO specialist. Return JSON only: {"score":0-100,"reason":"max 12 words","verdict":"Apply|Caution|Skip"}`, messages:[{role:'user',content:`${job.title}\n${job.desc.substring(0,250)}`}] });
  try {
    const r = await new Promise((res,rej) => {
      const req = https.request({ hostname:'api.anthropic.com', path:'/v1/messages', method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),'x-api-key':key,'anthropic-version':'2023-06-01'}, timeout:9000 }, (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); });
      req.on('error',rej); req.on('timeout',()=>{req.destroy();rej(new Error('timeout'));});
      req.write(payload); req.end();
    });
    const d = JSON.parse(r); const text = d.content?.[0]?.text||'';
    const p = JSON.parse(text.match(/\{[\s\S]+\}/)?.[0]||'{}');
    if (p.score) { job.aiScore=p.score; job.aiReason=p.reason; job.verdict=p.verdict; job.score=p.score; }
  } catch(e) {}
  return job;
}

async function sendTG(token, chatId, job) {
  const score = job.aiScore || job.score;
  const icon  = score >= 97 ? '🔥🔥' : '🔥';
  const text  = `${icon} *Upwork Hot Job: ${score}% Match*\n\n*${job.title}*\n\n📁 ${job.catLabel}\n💰 ${job.budget}\n🕐 Just posted\n${job.aiReason?`\n💬 _${job.aiReason}_\n`:''}\n[↗ Open on Upwork](${job.url})`;
  const payload = JSON.stringify({ chat_id:chatId, text, parse_mode:'Markdown' });
  return new Promise(resolve => {
    const req = https.request({ hostname:'api.telegram.org', path:`/bot${token}/sendMessage`, method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}, timeout:6000 }, r => { r.resume(); resolve(); });
    req.on('error',resolve); req.write(payload); req.end();
  });
}

module.exports = async function handler(req, res) {
  // Vercel cron passes Authorization header
  const authHeader = req.headers['authorization'] || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || ''}` && process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  const claudeKey  = process.env.CLAUDE_KEY   || '';
  const tgToken    = process.env.TG_TOKEN      || '';
  const tgChatId   = process.env.TG_CHAT_ID    || '';
  const alertScore = parseInt(process.env.SCORE_ALERT || '95');
  const log        = [];

  log.push(`Cron started at ${new Date().toISOString()}`);

  try {
    // 1. Fetch all feeds
    const allJobs = [];
    for (const feed of RSS_FEEDS) {
      try {
        const enc = encodeURIComponent(feed.q);
        const r = await httpsGet(`https://www.upwork.com/ab/feed/jobs/rss?q=${enc}&sort=recency&paging=0;15`);
        if (r.status === 200) allJobs.push(...parseRSSBasic(r.body, feed));
      } catch(e) { log.push(`Feed error [${feed.q}]: ${e.message}`); }
    }
    log.push(`Fetched ${allJobs.length} total items`);

    // 2. Score with quick algo
    const scored = allJobs.map(j => ({ ...j, score: quickScore(j.title, j.desc, j.cat) }));

    // 3. Filter: new (last 2h) + score >= 85
    const recent  = scored.filter(j => j.ageMs < 2 * 60 * 60 * 1000);
    const topJobs = recent.filter(j => j.score >= 85).sort((a,b) => b.score - a.score).slice(0, 8);
    log.push(`Recent high-score jobs: ${topJobs.length}`);

    // 4. AI score top jobs
    if (claudeKey && topJobs.length > 0) {
      for (const job of topJobs) {
        await aiScore(job, claudeKey);
        await new Promise(r => setTimeout(r, 400));
      }
      log.push(`AI scored ${topJobs.length} jobs`);
    }

    // 5. Send Telegram alerts
    if (tgToken && tgChatId) {
      const alerts = topJobs.filter(j => (j.aiScore||j.score) >= alertScore);
      log.push(`Sending ${alerts.length} Telegram alerts (threshold: ${alertScore}%)`);
      for (const job of alerts.slice(0, 5)) {
        await sendTG(tgToken, tgChatId, job);
        await new Promise(r => setTimeout(r, 500));
      }
    } else {
      log.push('Telegram not configured — skipping alerts');
    }

    res.status(200).json({ ok: true, log, topJobs: topJobs.length, alertsSent: topJobs.filter(j=>(j.aiScore||j.score)>=alertScore).length });

  } catch(e) {
    log.push(`Fatal error: ${e.message}`);
    res.status(500).json({ ok: false, log, error: e.message });
  }
};
