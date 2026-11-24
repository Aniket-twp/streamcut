# streamcut-mcp

> **Official Model Context Protocol (MCP) server for StreamCut** — Turn YouTube, Twitch, and Kick streams into viral 9:16 Shorts directly from Anthropic Claude Desktop or Claude Code.

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg?style=flat-square)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0-green.svg?style=flat-square)](https://nodejs.org/)

---

## ⚡ Features for Claude Desktop & Claude Code

With `streamcut-mcp` installed, you can talk to Claude conversationally to edit and clip videos:

1. **`streamcut_probe_video`**: Inspect any stream link or local file (duration, resolution, channels, live status).
2. **`streamcut_extract_transcript`**: Grab timed speech transcripts with word timestamps from any video in seconds.
3. **`streamcut_detect_viral_moments`**: AI viral scoring (0–100) identifying jokes, energy spikes, and narrative hooks.
4. **`streamcut_export_clip`**: Automatically trim, reframe into 9:16 vertical video, and render MP4s ready for YouTube Shorts and TikTok.
5. **`streamcut_system_health`**: Verifies local FFmpeg, yt-dlp, and cache directories.

---

## 🚀 Quick Setup for Claude Desktop

Add this to your `claude_desktop_config.json`:

### MacOS
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows
`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "streamcut": {
      "command": "npx",
      "args": ["-y", "streamcut-mcp"]
    }
  }
}
```

Or for local development from source:
```json
{
  "mcpServers": {
    "streamcut": {
      "command": "node",
      "args": ["<PATH-TO-STREAMCUT>/packages/streamcut-mcp/bin/streamcut-mcp.js"]
    }
  }
}
```

---

## 💬 Example Prompts in Claude Desktop

Once enabled, just ask Claude:

- *"Probe this YouTube stream and tell me the main topics discussed: `https://www.youtube.com/watch?v=...`"*
- *"Find the 3 most viral moments in this Twitch VOD between 30 and 60 seconds."*
- *"Clip from minute 12:45 to 13:30, reframe it into 9:16 vertical video, and save it to my Desktop."*

---

## 📄 License
MIT © Aniket (StreamCut Contributors)
