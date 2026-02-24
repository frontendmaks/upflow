// api/jobs.js — Vercel Serverless Function
// Fetches Upwork RSS feeds, scores jobs, returns JSON

const https = require('https');
const { URL } = require('url');

// ── RSS FEEDS CONFIG ─────────────────────────────────────────
const RSS_FEEDS = [
  // SEO & GEO
  { cat: 'seo_geo', label: 'SEO & GEO', q: 'technical SEO audit specialist' },
  { cat: 'seo_geo', label: 'SEO & GEO', q: 'GEO generative engine optimization AI search' },
  { cat: 'seo_geo', label: 'SEO & GEO', q: 'SEO specialist SaaS B2B' },
  { cat: 'seo_geo', label: 'SEO & GEO', q: 'local SEO google business profile GMB' },
  { cat: 'seo_geo', label: 'SEO & GEO', q: 'ecommerce SEO shopify organic traffic' },
  // Ads
  { cat: 'ads', label: 'Ads', q: 'google ads PPC campaign specialist' },
  { cat: 'ads', label: 'Ads', q: 'meta facebook ads specialist performance' },
  { cat: 'ads', label: 'Ads', q: 'linkedin ads B2B lead generation' },
  { cat: 'ads', label: 'Ads', q: 'tiktok ads creative specialist' },
  // Development
  { cat: 'dev', label: 'Development', q: 'webflow developer designer' },
  { cat: 'dev', label: 'Development', q: 'wordpress developer SEO optimization' },
  // Analytics
  { cat: 'analytics', label: 'Analytics & GTM', q: 'google tag manager GTM setup tracking' },
  { cat: 'analytics', label: 'Analytics & GTM', q: 'GA4 google analytics 4 setup migration' },
  { cat: 'analytics', label: 'Analytics & GTM', q: 'conversion tracking attribution analytics' },
];

// ── HTTP HELPER ──────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      timeout: 8000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ── RSS PARSER ───────────────────────────────────────────────
function parseRSS(xml, feed) {
  const jobs = [];
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

  items.slice(0, 15).forEach((item) => {
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };

    const title   = get('title');
    const rawDesc = get('description');
    const link    = get('link') || get('guid');
    const pubDate = get('pubDate');

    if (!title || title.length < 5) return;

    // Clean description
    const desc = rawDesc
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);

    // Extract budget
    const budgetMatch = desc.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\/hr|\/hour)?/i);
    const budget = budgetMatch ? budgetMatch[0] : 'Not specified';

    // Job type
    const isHourly = /hourly|\/hr|per hour/i.test(desc);
    const isFixed  = /fixed.?price|fixed budget/i.test(desc);
    const jobType  = isHourly ? 'Hourly' : isFixed ? 'Fixed' : 'See listing';

    // Posted time
    const postedAt = pubDate ? timeAgo(new Date(pubDate)) : 'Recently';
    const pubTs    = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

    // Unique ID
    const id = link
      ? link.replace(/https?:\/\/[^/]+/, '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 60)
      : `${feed.cat}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

    const score = quickScore(title, desc, feed.cat);

    jobs.push({
      id, title, desc, url: link, budget, jobType,
      posted: postedAt, pubDate: pubTs,
      cat: feed.cat, catLabel: feed.label,
      score, aiScore: null, aiReason: null, verdict: null,
      isNew: true,
    });
  });

  return jobs;
}

function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h > 48)  return `${Math.floor(h/24)}d ago`;
  if (h >= 1)  return `${h}h ago`;
  if (m >= 1)  return `${m}m ago`;
  return 'Just now';
}

// ── QUICK SCORING ─────────────────────────────────────────────
function quickScore(title, desc, cat) {
  let score = 35;
  const t = (title + ' ' + desc).toLowerCase();

  // Category base bonus
  const catBonus = { seo_geo: 20, analytics: 18, ads: 12, dev: 8 };
  score += catBonus[cat] || 0;

  // High-value keyword matches
  if (/technical seo|site audit|crawl|core web vitals|screaming frog/i.test(t)) score += 15;
  if (/ga4|google analytics 4|gtm|tag manager|looker studio/i.test(t))           score += 15;
  if (/geo|ai search|perplexity|chatgpt seo|generative engine|ai overview/i.test(t)) score += 20;
  if (/saas|b2b software|software company/i.test(t))                              score += 10;
  if (/local seo|google business|gmb|google my business/i.test(t))               score += 10;
  if (/ecommerce|shopify|woocommerce|magento/i.test(t))                           score += 8;
  if (/healthcare|medical|clinic|spa|wellness|dental/i.test(t))                  score += 8;
  if (/long.?term|ongoing|retainer|monthly/i.test(t))                            score += 10;
  if (/senior|expert|specialist|experienced/i.test(t))                           score += 5;
  if (/recovery|traffic drop|penalty|algorithm update/i.test(t))                 score += 8;
  if (/ahrefs|semrush|screaming frog|search console/i.test(t))                   score += 5;

  // Budget signals (higher budget = better match)
  if (/\$[4-9]\d\/hr|\$[1-9]\d{2}\/hr/i.test(t))       score += 10;
  else if (/\$[2-3]\d\/hr/i.test(t))                    score += 5;
  if (/\$[5-9]\d{3}|\$[1-9]\d{4}/i.test(t))            score += 8;

  // Red flags
  if (/cheap|affordable|low cost|low budget|minimum budget/i.test(t)) score -= 18;
  if (/guaranteed.*rank|100 backlinks|#1 on google|instant results/i.test(t)) score -= 30;
  if (/only need.*content writer|data entry|virtual assistant/i.test(t)) score -= 20;
  if (/social media manager only|smm only/i.test(t)) score -= 15;

  return Math.min(99, Math.max(5, Math.round(score)));
}

// ── AI SCORING (Claude) ───────────────────────────────────────
async function scoreWithClaude(job, apiKey) {
  if (!apiKey) return job;

  try {
    const payload = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: `Score Upwork jobs for Maksym Kotsupyra, SEO & GEO Specialist. Skills: Technical SEO, GEO/AI search, Local SEO, E-commerce SEO, SaaS SEO, GA4+GTM. Portfolio: Komodor SaaS, Med Spa USA (845% ROI), Pharmacy ecom (+290% organic), Chiropractic clinics. Return JSON only: {"score":0-100,"reason":"max 15 words","verdict":"Apply|Caution|Skip"}`,
      messages: [{ role: 'user', content: `Title: ${job.title}\nDesc: ${job.desc.substring(0, 300)}` }],
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: 10000,
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.write(payload);
      req.end();
    });

    const d = JSON.parse(result);
    const text = d.content?.[0]?.text || '';
    const parsed = JSON.parse(text.match(/\{[\s\S]+\}/)?.[0] || '{}');

    if (parsed.score) {
      job.aiScore  = parsed.score;
      job.aiReason = parsed.reason;
      job.verdict  = parsed.verdict;
      job.score    = parsed.score;
    }
  } catch (e) {
    // keep quick score silently
  }

  return job;
}

// ── MAIN HANDLER ─────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { cat = 'all', q = '', minScore = '0', ai = 'false' } = req.query || {};
  const claudeKey = process.env.CLAUDE_KEY || '';
  const doAI = ai === 'true' && !!claudeKey;

  try {
    // Select which feeds to fetch
    const feedsToFetch = cat === 'all'
      ? RSS_FEEDS
      : RSS_FEEDS.filter(f => f.cat === cat);

    // Fetch all feeds in parallel (max 5 concurrent)
    const batchSize = 5;
    let allJobs = [];

    for (let i = 0; i < feedsToFetch.length; i += batchSize) {
      const batch = feedsToFetch.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async feed => {
          const encoded = encodeURIComponent(feed.q);
          const url = `https://www.upwork.com/ab/feed/jobs/rss?q=${encoded}&sort=recency&paging=0;20`;
          const r = await httpsGet(url);
          return r.status === 200 ? parseRSS(r.body, feed) : [];
        })
      );
      results.forEach(r => { if (r.status === 'fulfilled') allJobs.push(...r.value); });
    }

    // Deduplicate by title similarity
    const seen = new Set();
    const unique = allJobs.filter(j => {
      const key = j.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter
    let jobs = unique;
    if (cat !== 'all') jobs = jobs.filter(j => j.cat === cat);
    if (q)             jobs = jobs.filter(j => j.title.toLowerCase().includes(q.toLowerCase()) || j.desc.toLowerCase().includes(q.toLowerCase()));
    if (minScore)      jobs = jobs.filter(j => j.score >= parseInt(minScore));

    // Sort by score desc
    jobs.sort((a, b) => b.score - a.score);

    // AI score top 10 if requested
    if (doAI) {
      const top = jobs.filter(j => j.score >= 70).slice(0, 10);
      await Promise.all(top.map(j => scoreWithClaude(j, claudeKey)));
      jobs.sort((a, b) => b.score - a.score);
    }

    // Send Telegram for 95%+ jobs (fire and forget)
    const tgToken  = process.env.TG_TOKEN  || '';
    const tgChatId = process.env.TG_CHAT_ID || '';
    const alertScore = parseInt(process.env.SCORE_ALERT || '95');

    if (tgToken && tgChatId) {
      const alerts = jobs.filter(j => (j.aiScore || j.score) >= alertScore);
      // We can't track "already sent" in serverless — use pubDate to avoid duplicates
      const recentAlerts = alerts.filter(j => {
        const age = Date.now() - new Date(j.pubDate).getTime();
        return age < 2 * 60 * 60 * 1000; // only jobs posted in last 2h
      });
      recentAlerts.slice(0, 3).forEach(job => sendTelegramAlert(job, tgToken, tgChatId).catch(() => {}));
    }

    res.status(200).json({
      jobs: jobs.slice(0, 100),
      total: jobs.length,
      fetched: unique.length,
      lastRefresh: new Date().toISOString(),
      aiEnabled: doAI,
    });

  } catch (e) {
    res.status(500).json({ error: e.message, jobs: [] });
  }
};

// ── TELEGRAM ─────────────────────────────────────────────────
async function sendTelegramAlert(job, token, chatId) {
  const score = job.aiScore || job.score;
  const icon  = score >= 97 ? '🔥🔥' : score >= 95 ? '🔥' : '⭐';
  const text  = `${icon} *Upwork Match: ${score}%*\n\n*${job.title}*\n\n📁 ${job.catLabel}\n💰 ${job.budget}\n🕐 ${job.posted}${job.aiReason ? `\n\n💬 _${job.aiReason}_` : ''}\n\n[↗ Open on Upwork](${job.url})`;

  const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: false });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 5000,
    }, (r) => { r.resume(); resolve(); });
    req.on('error', resolve);
    req.write(payload);
    req.end();
  });
}
