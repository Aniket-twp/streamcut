# <p align="center"><img src="public/icon-192.png" width="80" height="80" alt="StreamCut Logo"><br>StreamCut</p>

<p align="center">
  <b>AI-Powered Video Stream Clipper, 9:16 Reframe & Viral Shorts Generator</b><br>
  Turn hours of live streams and long videos into viral, ready-to-post Shorts, Reels, and TikToks in seconds.
</p>

<p align="center">
  <a href="https://github.com/Aniket-twp/streamcut/releases/tag/v1.0.0"><img src="https://img.shields.io/badge/Release-v1.0.0-lime.svg?style=flat-square" alt="Release"></a>
  <a href="https://github.com/Aniket-twp/streamcut/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/Platforms-Windows%20%7C%20Android%20%7C%20Web-purple.svg?style=flat-square" alt="Platforms">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20.0-green.svg?style=flat-square" alt="Node.js">
  <img src="https://img.shields.io/badge/React-18-61dafb.svg?style=flat-square" alt="React">
  <img src="https://img.shields.io/badge/Vite-6-646cff.svg?style=flat-square" alt="Vite">
</p>

---

## ⚡ Direct Downloads (v1.0.0)

| Platform | Download Link | Description |
| :--- | :--- | :--- |
| 🤖 **Android** | [**Download StreamCut.apk**](https://github.com/Aniket-twp/streamcut/releases/download/v1.0.0/StreamCut.apk) | Native full-screen APK package with offline assets |
| 🪟 **Windows** | [**Download StreamCut.exe**](https://github.com/Aniket-twp/streamcut/releases/download/v1.0.0/StreamCut.exe) | Standalone frameless desktop launcher (Windows 10/11) |
| 📦 **All Assets** | [**GitHub Releases v1.0.0**](https://github.com/Aniket-twp/streamcut/releases/tag/v1.0.0) | Complete binaries, release notes, and store packages |

---

## ✨ Features

- 🎯 **AI Viral Moment Detection (ClipGPT)**
  - Ingests audio and video transcriptions.
  - Automatically identifies laughter, high-energy hooks, intense gameplay moments, and punchlines.
  - Generates viral scores (0–100), suggested captions, and automated title suggestions.
  - Multi-provider BYOK (Bring Your Own Key) support: **DeepSeek (V4.1 / R1)**, **Google Gemini 2.5 / Flash**, **OpenAI GPT-4o**, and **Anthropic Claude 3.5**.

- 📱 **Intelligent 9:16 Reframe Engine**
  - Converts horizontal 16:9 streams into vertical 9:16 Shorts/Reels seamlessly.
  - Dynamic layouts: Facecam on top + gameplay/presentation on bottom, full-frame zoomed crop, or custom pan-and-zoom keyframing.
  - Real-time client-side preview with hardware acceleration.

- 💬 **Kinetic Viral Subtitle Presets**
  - **Hormozi Style**: Bold, high-contrast, word-by-word highlighted captions.
  - **MrBeast Style**: Vibrant primary pop with bounce effects.
  - **Neon Cyber**: Glowing electric cyan & magenta aesthetic.
  - **Clean Minimal**: Elegant editorial captions with subtitle wrapping.

- 🎨 **Obsidian Liquid Glass Design**
  - Silky canvas backdrops rendered with an ultra-efficient internal buffer.
  - Custom typography powered by the **Satoshi Variable** font family.
  - Browser-style Back (`←`) and Forward (`→`) history navigation.
  - Responsive layout: Dedicated desktop sidebar & fixed native mobile bottom tab bar (`Home`, `ClipGPT`, `Editor`, `Library`, `Scheduler`).

- 🌐 **1-Click Direct Creator Studio Links**
  - Instant studio launch to YouTube Studio, TikTok Creator Center, Instagram, and X without developer console OAuth walls.
  - Local persistence for connected channels and handles.

- 📥 **Universal Stream Ingestion**
  - Download and clip directly from YouTube, Twitch, Kick, and podcast URLs via integrated `yt-dlp` and `ffmpeg`.
  - Local drag-and-drop support for MP4, MOV, WebM, and MKV files.

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite 6, HTML5 Canvas, Satoshi Variable Typography.
- **Backend / Engine**: Node.js ES Modules (`server.mjs`), `yt-dlp`, `ffmpeg`, `ffprobe`.
- **Mobile**: Android Native WebView wrapper (`android/`) with full offline caching and asset fallback.
- **Desktop**: Standalone .NET C# Launcher (`StreamCutLauncher.cs` / `StreamCut.exe`).
- **Cloud / Tunneling**: Docker, Cloudflare Quick Tunnels (`cloudflared`).

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [FFmpeg](https://ffmpeg.org/) (installed and available in system PATH)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (optional, server bundles local fallback)

### 2. Clone & Install
```bash
# Clone the repository
git clone https://github.com/Aniket-twp/streamcut.git
cd streamcut

# Install dependencies
npm install
```

### 3. Run Locally
```bash
# Start server and dev client (accessible locally)
npm run dev

# Or start with LAN mode enabled (accessible across home Wi-Fi)
npm run dev:lan
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🐳 Cloud & Docker Deployment

Deploy StreamCut 100% in the cloud on Railway, Render, Fly.io, or any Ubuntu VPS:

```bash
# Build Docker image
docker build -t streamcut .

# Run container
docker run -d -p 5173:5173 \
  -e DEEPSEEK_API_KEY="your-deepseek-key" \
  -e GEMINI_API_KEY="your-gemini-key" \
  --name streamcut streamcut
```
For detailed cloud setup instructions, check out [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md).

---

## 📂 Project Structure

```text
streamcut/
├── android/                   # Native Android Studio / Gradle project & WebView wrapper
│   ├── app/src/main/assets/   # Bundled offline web client
│   └── app/src/main/java/     # MainActivity.java
├── public/                    # Static assets, Satoshi fonts, icons, manifest
├── scripts/                   # Windows installation & packaging scripts
├── src/                       # React frontend source code
│   ├── components/            # Screens (AiClips, Editor, Library, Connections, etc.)
│   ├── lib/                   # Video analysis, router, store, formatters
│   ├── types.ts               # TypeScript data definitions
│   └── App.tsx                # Main application component
├── tools/                     # Standalone launcher sources & utilities
├── server.mjs                 # Unified Node.js media server & API handler
├── vite.config.ts             # Vite build configuration
└── package.json               # Node dependencies and scripts
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check out the [issues page](https://github.com/Aniket-twp/streamcut/issues) and read [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) © 2026 StreamCut Contributors.
