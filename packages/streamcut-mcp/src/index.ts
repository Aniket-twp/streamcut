#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getSystemHealth } from './utils/tools.js';
import { probeMedia } from './tools/probe.js';
import { extractTranscript } from './tools/transcript.js';
import { detectViralSegments } from './tools/viral.js';
import { exportClip } from './tools/export.js';

// Initialize StreamCut MCP Server
const server = new McpServer({
  name: 'streamcut-mcp',
  version: '1.0.0',
});

// Tool 1: System Health & Tool Readiness
server.tool(
  'streamcut_system_health',
  'Check the availability of media engines (ffmpeg, ffprobe, yt-dlp) and local storage paths.',
  {},
  async () => {
    try {
      const health = await getSystemHealth();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `System health check failed: ${err.message}` }],
      };
    }
  }
);

// Tool 2: Probe Video Stream or Local File
server.tool(
  'streamcut_probe_video',
  'Inspect and probe an online stream URL (YouTube, Twitch, Kick, podcast) or local video file to retrieve duration, resolution, channels, and metadata.',
  {
    url: z.string().describe('YouTube/Twitch/Kick URL or local video file path'),
  },
  async ({ url }) => {
    try {
      const info = await probeMedia(url);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to probe video: ${err.message}` }],
      };
    }
  }
);

// Tool 3: Extract Timed Transcript
server.tool(
  'streamcut_extract_transcript',
  'Extract speech transcripts with precise timestamped cues from a video stream URL without downloading full video.',
  {
    url: z.string().describe('Video stream URL or media link'),
    language: z.string().default('en').describe('Subtitle/transcript language code (e.g. "en", "es", "hi")'),
  },
  async ({ url, language }) => {
    try {
      const transcript = await extractTranscript(url, language);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                sourceUrl: transcript.sourceUrl,
                language: transcript.language,
                totalCues: transcript.totalCues,
                sampleText: transcript.fullText.slice(0, 500) + '...',
                cues: transcript.cues.slice(0, 100), // First 100 cues preview
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to extract transcript: ${err.message}` }],
      };
    }
  }
);

// Tool 4: Detect Viral Moments (ClipGPT)
server.tool(
  'streamcut_detect_viral_moments',
  'Analyze transcript cues or speech text to identify viral hooks, energy spikes, and punchlines, returning ranked 9:16 clip candidates with retention scores (0-100).',
  {
    url: z.string().describe('Video stream URL to automatically extract and analyze'),
    minDuration: z.number().default(20).describe('Minimum clip length in seconds (default: 20)'),
    maxDuration: z.number().default(60).describe('Maximum clip length in seconds (default: 60)'),
    maxResults: z.number().default(5).describe('Number of top viral moments to return (default: 5)'),
  },
  async ({ url, minDuration, maxDuration, maxResults }) => {
    try {
      const transcript = await extractTranscript(url);
      const viral = detectViralSegments(transcript.cues, { minDuration, maxDuration, maxResults });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(viral, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Viral moment detection failed: ${err.message}` }],
      };
    }
  }
);

// Tool 5: Trim, Reframe, and Export 9:16 Short
server.tool(
  'streamcut_export_clip',
  'Trim a video segment and reframe into a vertical 9:16 (or square 1:1) video ready for YouTube Shorts, TikTok, and Instagram Reels.',
  {
    sourceUrlOrPath: z.string().describe('Source video URL or local file path'),
    startTime: z.number().describe('Start timestamp in seconds'),
    endTime: z.number().describe('End timestamp in seconds'),
    aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('9:16').describe('Target video aspect ratio'),
    layout: z.enum(['crop', 'fit_blur', 'split']).default('crop').describe('Reframe layout: "crop" (center-crop) or "fit_blur" (blurred background)'),
    outputPath: z.string().optional().describe('Optional custom destination path for the rendered MP4'),
  },
  async (args) => {
    try {
      const result = await exportClip(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Clip export failed: ${err.message}` }],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('StreamCut MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error running StreamCut MCP server:', err);
  process.exit(1);
});
