import type { Cue } from '../types';
import { clamp, uid } from './format';

function parseTime(raw: string): number {
  const clean = raw.replace(',', '.').match(/\d+(?:\.\d+)?/g);
  if (!clean) return NaN;
  const parts = clean.map(Number);
  if (parts.length >= 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/** Parses SRT and WebVTT into cues with absolute times. */
export function parseSubtitles(raw: string): Cue[] {
  const text = raw.replace(/\r/g, '').replace(/^WEBVTT.*$/m, '');
  const blocks = text.split(/\n{2,}/);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const arrow = lines.findIndex((l) => l.includes('-->'));
    if (arrow === -1) continue;

    const [left, right] = lines[arrow].split('-->');
    const start = parseTime(left.replace(/[^0-9:.,]/g, ''));
    const end = parseTime((right ?? '').split(/\s+/)[0]?.replace(/[^0-9:.,]/g, '') ?? '');
    const body = lines
      .slice(arrow + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (!body || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    cues.push({ id: uid('cue'), start, end, text: body });
  }

  return cues.sort((a, b) => a.start - b.start);
}

/** Converts source-VOD timestamps into the local time range of a downloaded segment. */
export function rebaseSubtitles(cues: Cue[], sourceOffset = 0, segmentDuration = Number.POSITIVE_INFINITY): Cue[] {
  const offset = Math.max(0, Number.isFinite(sourceOffset) ? sourceOffset : 0);
  const duration = Math.max(0, Number.isFinite(segmentDuration) ? segmentDuration : Number.POSITIVE_INFINITY);
  const segmentEnd = offset + duration;
  return cues
    .filter((cue) => cue.end > offset && cue.start < segmentEnd)
    .map((cue) => ({
      ...cue,
      start: Math.max(0, cue.start - offset),
      end: Math.min(duration, cue.end - offset),
    }))
    .filter((cue) => cue.end > cue.start)
    .sort((a, b) => a.start - b.start);
}

function chunkLine(line: string): string[] {
  const sentences = line
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const sentence of sentences.length ? sentences : [line]) {
    const words = sentence.split(/\s+/);
    if (words.length <= 9) {
      out.push(sentence);
      continue;
    }
    for (let i = 0; i < words.length; i += 8) out.push(words.slice(i, i + 8).join(' '));
  }
  return out;
}

/**
 * Turns a typed script into timed captions spread across a clip.
 * Words are given roughly equal screen time with a readable minimum.
 */
export function scriptToCues(script: string, start: number, end: number): Cue[] {
  const chunks = script
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap(chunkLine)
    .filter(Boolean);

  if (!chunks.length || end <= start) return [];

  const total = end - start;
  const words = chunks.map((c) => c.split(/\s+/).length);
  const totalWords = words.reduce((a, b) => a + b, 0) || 1;
  const cues: Cue[] = [];
  let t = start;

  for (let i = 0; i < chunks.length; i++) {
    if (t >= end - 0.05) break;
    const share = total * (words[i] / totalWords);
    const len = Math.max(1.2, share);
    const cueEnd = Math.min(end, t + len);
    cues.push({ id: uid('cue'), start: t, end: Math.max(t + 0.4, cueEnd), text: chunks[i] });
    t = cueEnd;
  }

  return cues;
}

/** Cues that overlap a range, clipped to it. */
export function cuesInRange(cues: Cue[], start: number, end: number): Cue[] {
  return cues
    .filter((c) => c.end > start && c.start < end)
    .map((c) => ({
      ...c,
      start: clamp(c.start, start, end),
      end: clamp(c.end, start, end),
    }));
}
