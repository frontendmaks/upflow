# UpFlow — Upwork SEO Intelligence

Персональний дашборд для Upwork: живий Job Feed з Upwork RSS, AI-скоринг вакансій через Claude, Telegram push для 95%+ матчів, генерація cover letters.

---

## 🚀 Деплой на Vercel (5-7 хвилин)

### 1. Встановити Vercel CLI
```bash
npm install -g vercel
```

### 2. Задеплоїти
```bash
cd upflow
vercel --prod
```
Слідуй підказкам: вибери свій акаунт, дай назву проекту (наприклад `upflow`).

### 3. Встановити Environment Variables

Відкрий **Vercel Dashboard** → твій проект → **Settings** → **Environment Variables**

Додай ці змінні:

| Variable | Value | Required |
|----------|-------|----------|
| `CLAUDE_KEY` | `sk-ant-api03-...` | ✅ Yes |
| `TG_TOKEN` | `123456:ABC-DEF...` | ✅ Yes |
| `TG_CHAT_ID` | `123456789` | ✅ Yes |
| `SCORE_ALERT` | `95` | Optional (default: 95) |

### 4. Редеплой після env vars
```bash
vercel --prod
```
або натисни **Redeploy** в Vercel Dashboard.

### 5. Перевірити
- Відкрий `https://your-project.vercel.app`
- Job Feed → має завантажити живі вакансії з Upwork
- Setup → натисни **Send Test Notification** → має прийти в Telegram

---

## ⚙️ Як це працює

```
Vercel Cron (кожну годину)
  └─ /api/cron
       ├─ Fetches Upwork RSS feeds (14 queries)
       ├─ Quick scores all jobs (local algorithm)
       ├─ AI scores top jobs (Claude Haiku — дешево)
       └─ Sends Telegram push for score >= 95%

Browser (ти)
  └─ /api/jobs   ← live fetch on demand
  └─ /api/claude ← proxy for cover letters & analyzer
  └─ /api/telegram ← test notifications
  └─ /api/status ← check env vars
```

### RSS Feeds (14 queries):
- **SEO & GEO**: technical SEO, GEO/AI search, SaaS SEO, local SEO, ecommerce SEO
- **Ads**: Google Ads, Meta Ads, LinkedIn Ads, TikTok Ads
- **Development**: Webflow, WordPress
- **Analytics**: GTM, GA4, conversion tracking

### Cron Schedule:
Налаштований в `vercel.json`: `"schedule": "0 * * * *"` = кожну годину

---

## 📱 Telegram Bot Setup

1. Відкрий [@BotFather](https://t.me/BotFather) в Telegram
2. `/newbot` → дай ім'я → скопіюй **token**
3. Напиши будь-яке повідомлення своєму боту
4. Відкрий у браузері:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
5. Знайди `"chat": {"id": 123456789}` — це твій **Chat ID**

---

## 🔗 Upwork API (коли зареєструєш)

Коли отримаєш Upwork Developer App credentials:
- Client ID + Secret → додай як env vars: `UPWORK_CLIENT_ID`, `UPWORK_SECRET`
- Це відкриє: реальний JSS в реальному часі, синхронізацію контрактів, реальні пропозиції

Поки що: дані контрактів статичні (вписані вручну), Job Feed — через RSS.

---

## 📁 Структура проекту

```
upflow/
├── api/
│   ├── jobs.js       ← Live RSS fetch + AI scoring + Telegram alerts
│   ├── claude.js     ← Proxy для Claude API (приховує ключ)
│   ├── telegram.js   ← Test + send Telegram messages
│   ├── cron.js       ← Hourly cron job (Vercel Cron)
│   └── status.js     ← Environment variables check
├── public/
│   └── index.html    ← Frontend SPA
├── vercel.json       ← Routing + cron config
├── package.json
└── README.md
```

---

## 💡 Scoring Algorithm

### Quick Score (локальний, без API):
- Base: 35 points
- Category bonus: SEO&GEO +20, Analytics +18, Ads +12, Dev +8
- Technical SEO keywords: +15
- GEO/AI search: +20 (рідкісна ніша = перевага)
- SaaS/B2B: +10
- Long-term/retainer: +10
- Red flags (cheap/guaranteed rankings): -18 to -30

### AI Score (Claude Haiku):
- Контекст твого профілю: Komodor SaaS, Aesthete Med Spa (845% ROI), pharmacy ecom (+290%), Chiropractic
- Повертає: score 0-100, reason (15 слів), verdict (Apply/Caution/Skip)
- Коштує ~$0.001 за вакансію (Haiku — найдешевша модель)

### Telegram Alert:
- Надсилається якщо AI score (або Quick score) >= `SCORE_ALERT` (default 95%)
- Лише для вакансій, опублікованих в останні 2 години (щоб уникнути дублів)

---

## 🔧 Локальна розробка

```bash
npm install -g vercel
vercel dev
```

Або просто відкрий `public/index.html` в браузері — але API calls не працюватимуть без сервера.

---

## 💰 Costs

| Service | Cost |
|---------|------|
| Vercel Hobby | **Free** (includes cron) |
| Claude Haiku (scoring) | ~$0.01-0.05/day |
| Claude Sonnet (cover letters) | ~$0.01 per letter |
| Telegram Bot API | **Free** |
| Upwork RSS | **Free** |
