# 🌌 Yoda Speak — Galactic Translation Terminal

> *"Type your words. Translated, they shall be."*

A Star Wars-themed translator that converts any text into Yoda's iconic speech pattern. Powered by **Llama 3.1** via Cloudflare Workers AI — no external API keys needed.

🔗 **Live demo:** [yoda-translate.pages.dev](https://yoda-translate.pages.dev)

---

## ✨ Features

- 🤖 AI-powered Yoda speech translation using Llama 3.1
- ⚡ Serverless backend via Cloudflare Workers
- 🛡️ Per-IP rate limiting with Cloudflare KV
- 📜 Recent translations history (session-based)
- 🌠 Animated starfield background
- 📋 One-click copy to clipboard
- 📱 Fully responsive design

---

## 🏗️ Architecture

```
Browser (Cloudflare Pages)
        │
        │  POST /  { text }
        ▼
Cloudflare Worker  ←── KV (rate limiting)
        │
        │  env.AI.run(llama-3.1-8b-instruct)
        ▼
Cloudflare Workers AI
```

---

## 🚀 Self-hosting

### 1. Deploy the Worker

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) and create a new Worker
2. Paste the contents of `worker.js`
3. Add bindings under **Settings → Bindings**:
   - **Workers AI** → variable name: `AI`
   - **KV Namespace** → variable name: `RATE_LIMIT` (create namespace first under Storage & Databases → Workers KV)
4. Deploy

### 2. Deploy the Frontend

1. Update `WORKER_URL` in `index.html` to your Worker URL
2. Go to **Workers & Pages → Create → Pages**
3. Upload `index.html` directly
4. Deploy

---

## 📁 Files

| File | Description |
|------|-------------|
| `index.html` | Frontend — single-file UI with starfield, input, and output |
| `worker.js` | Cloudflare Worker — rate limiting + Workers AI call |

---

## ⚙️ Rate Limiting

20 requests per IP per minute, enforced via Cloudflare KV. Resets automatically every 60 seconds.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS, hosted on Cloudflare Pages
- **Backend:** Cloudflare Workers (serverless)
- **AI:** Llama 3.1 8B Instruct via Cloudflare Workers AI
- **Storage:** Cloudflare KV (rate limiting)

---

## 📄 License

MIT

---

*May the Force be with you.* ✨
