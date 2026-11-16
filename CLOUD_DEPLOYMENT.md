# StreamCut Cloud Architecture & Deployment Guide

Run StreamCut **100% in the cloud**, completely decoupled from your local PC and phone.

---

## ⚡ Option 1: 1-Click Railway / Render / Fly.io

### Deploy on Railway (Recommended)
1. Push this repo to your GitHub account.
2. In [Railway.app](https://railway.app), click **New Project** -> **Deploy from GitHub repo**.
3. Railway automatically detects the `Dockerfile`.
4. Add environment variables:
   - `DEEPSEEK_API_KEY`: your DeepSeek API key
   - `GEMINI_API_KEY`: your Gemini API key (optional)
   - `PORT`: `5173`
   - `HOST`: `0.0.0.0`
   - `LAN`: `1`
5. Click **Deploy**. You get a public HTTPS domain (e.g. `https://streamcut.up.railway.app`) accessible anywhere on iPhone, Android, or PC!

### Deploy on Fly.io
Run from your terminal:
```bash
fly launch
fly deploy
```

---

## 🖥 Option 2: Cloud VPS (Hetzner, DigitalOcean, AWS EC2, Linode)

Run on any clean Ubuntu/Debian cloud server ($4-$6/mo):
```bash
git clone <your-repo-url>
cd streamcut
chmod +x deploy-cloud.sh
./deploy-cloud.sh
```

This starts the Docker container in daemon mode. Your dashboard is immediately accessible at:
`http://YOUR_SERVER_IP:5173`

---

## 🔒 Cloud AI Engines
- **DeepSeek V4.1 Flash / V3**: `https://api.deepseek.com`
- **Google Gemini 2.5/Flash**: Cloud API
- **Cloudflare R2 / S3**: Object storage for rendered MP4 clips.
