import fs from 'node:fs';
import path from 'node:path';
import { findTool, execCommand, getCacheDir } from '../utils/tools.js';

export type TranscriptCue = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptResult = {
  sourceUrl: string;
  language: string;
  totalCues: number;
  fullText: string;
  cues: TranscriptCue[];
};

function parseVttOrSrt(content: string): TranscriptCue[] {
  const cues: TranscriptCue[] = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  let currentStart = -1;
  let currentEnd = -1;
  let currentText: string[] = [];

  const timeRe = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})/;

  function parseTime(h: string | undefined, m: string, s: string, ms: string): number {
    const hours = h ? parseInt(h, 10) : 0;
    const mins = parseInt(m, 10);
    const secs = parseInt(s, 10);
    const millis = parseInt(ms, 10);
    return hours * 3600 + mins * 60 + secs + millis / 1000;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'WEBVTT' || /^\d+$/.test(trimmed)) {
      if (currentStart >= 0 && currentText.length > 0) {
        const text = currentText.join(' ').replace(/<[^>]+>/g, '').trim();
        if (text) {
          cues.push({ start: currentStart, end: currentEnd, text });
        }
        currentStart = -1;
        currentEnd = -1;
        currentText = [];
      }
      continue;
    }

    const match = trimmed.match(timeRe);
    if (match) {
      if (currentStart >= 0 && currentText.length > 0) {
        const text = currentText.join(' ').replace(/<[^>]+>/g, '').trim();
        if (text) {
          cues.push({ start: currentStart, end: currentEnd, text });
        }
      }
      currentStart = parseTime(match[1], match[2], match[3], match[4]);
      currentEnd = parseTime(match[5], match[6], match[7], match[8]);
      currentText = [];
    } else if (currentStart >= 0) {
      currentText.push(trimmed);
    }
  }

  if (currentStart >= 0 && currentText.length > 0) {
    const text = currentText.join(' ').replace(/<[^>]+>/g, '').trim();
    if (text) {
      cues.push({ start: currentStart, end: currentEnd, text });
    }
  }

  return cues;
}

export async function extractTranscript(url: string, lang = 'en'): Promise<TranscriptResult> {
  const ytdlp = await findTool('yt-dlp', ['--version']);
  if (!ytdlp) {
    throw new Error('yt-dlp is required to extract stream transcripts, but was not found.');
  }

  const cache = getCacheDir();
  const id = `trans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const outTemplate = path.join(cache, `${id}.%(ext)s`);

  // Fast subtitle extraction without downloading video
  await execCommand(ytdlp.command, [
    '--write-auto-sub',
    '--write-sub',
    '--sub-lang', lang,
    '--skip-download',
    '--sub-format', 'vtt/srt/best',
    '-o', outTemplate,
    url,
  ], { timeoutMs: 40000 }).catch(() => {});

  // Find generated subtitle file
  const files = fs.readdirSync(cache);
  const subFile = files.find((f) => f.startsWith(id) && (f.endsWith('.vtt') || f.endsWith('.srt')));

  if (!subFile) {
    throw new Error(`No subtitles or audio transcription available for URL: ${url}. Ensure the stream has speech or captions.`);
  }

  const subPath = path.join(cache, subFile);
  const content = fs.readFileSync(subPath, 'utf8');
  const cues = parseVttOrSrt(content);

  // Clean up subtitle file
  try { fs.unlinkSync(subPath); } catch {}

  const fullText = cues.map((c) => c.text).join(' ');

  return {
    sourceUrl: url,
    language: lang,
    totalCues: cues.length,
    fullText,
    cues,
  };
}
