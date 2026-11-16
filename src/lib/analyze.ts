import type { PanPoint, Suggestion } from '../types';
import { clamp, fmt, uid } from './format';

export type Energy = { t: number; v: number };

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Decodes the audio track at a low sample rate and returns loudness over time.
 * Runs fully in the browser — nothing is uploaded.
 */
export async function computeEnergy(
  url: string,
  duration: number,
  onProgress?: (p: number) => void,
): Promise<Energy[]> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  onProgress?.(0.15);

  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new Ctx({ sampleRate: 8000 });
  let audio: AudioBuffer;
  try {
    audio = await ac.decodeAudioData(buf);
  } finally {
    void ac.close();
  }

  onProgress?.(0.35);
  const channel = audio.getChannelData(0);
  const block = Math.max(1, Math.floor(audio.sampleRate * 0.1));
  const out: Energy[] = [];
  let lastYield = 0;

  for (let i = 0; i < channel.length; i += block) {
    const stop = Math.min(channel.length, i + block);
    let sum = 0;
    for (let j = i; j < stop; j++) sum += channel[j] * channel[j];
    out.push({ t: (i + stop) / 2 / audio.sampleRate, v: Math.sqrt(sum / Math.max(1, stop - i)) });

    if (out.length - lastYield > 300) {
      lastYield = out.length;
      await tick();
      onProgress?.(0.35 + 0.6 * (i / channel.length));
    }
  }

  onProgress?.(1);
  return out;
}

function movingAverage(values: Float32Array, window: number): Float32Array {
  const out = new Float32Array(values.length);
  let sum = 0;
  const half = Math.floor(window / 2);
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i - window >= 0) sum -= values[i - window];
    const count = Math.min(i + 1, window);
    out[i] = sum / count;
  }
  const pre = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      s += out[j];
      n++;
    }
    pre[i] = s / n;
  }
  return pre;
}

const LABELS = ['Big reaction', 'Hype moment', 'Chat goes wild', 'Peak energy', 'Clutch play', 'Screaming point'];

/**
 * Scores loudness peaks across the VOD and returns ready-to-edit vertical clips.
 */
export function findHighlights(
  energy: Energy[],
  duration: number,
  count = 6,
  options: { minLength?: number; maxLength?: number } = {},
): Suggestion[] {
  if (energy.length < 12 || duration < 6) return [];

  const smooth = movingAverage(Float32Array.from(energy.map((e) => e.v)), 12);
  let mean = 0;
  for (const v of smooth) mean += v;
  mean /= smooth.length;
  let variance = 0;
  for (const v of smooth) variance += (v - mean) ** 2;
  const std = Math.sqrt(variance / smooth.length) || 1;

  const threshold = mean + Math.max(std * 0.5, mean * 0.18);
  const minGap = clamp(duration / 12, 12, 90);
  const peaks: { t: number; score: number }[] = [];

  for (let i = 2; i < smooth.length - 2; i++) {
    const v = smooth[i];
    if (v < threshold) continue;
    if (v < smooth[i - 1] || v < smooth[i + 1]) continue;
    const t = energy[i].t;
    const last = peaks[peaks.length - 1];
    if (last && t - last.t < minGap) {
      if (v > last.score) peaks[peaks.length - 1] = { t, score: v };
      continue;
    }
    peaks.push({ t, score: v });
  }

  if (!peaks.length) {
    const order = Array.from(smooth.keys()).sort((a, b) => smooth[b] - smooth[a]);
    for (const i of order) {
      const t = energy[i].t;
      if (peaks.every((p) => Math.abs(p.t - t) > minGap)) peaks.push({ t, score: smooth[i] });
      if (peaks.length >= count) break;
    }
  }

  const top = peaks.slice(0, count);
  if (!top.length) return [];
  const max = Math.max(...top.map((p) => p.score));
  const min = Math.min(...top.map((p) => p.score));

  return top
    .map((peak, i) => {
      const minLength = clamp(options.minLength ?? 12, 5, 120);
      const maxLength = clamp(options.maxLength ?? 42, minLength, 180);
      const length = clamp(30, minLength, Math.min(maxLength, Math.max(minLength, duration / 3)));
      let start = clamp(peak.t - length * 0.42, 0, Math.max(0, duration - length));
      let end = Math.min(duration, start + length);
      if (end - start < 8) start = Math.max(0, end - 8);
      const score = min === max ? 0.8 : 0.62 + 0.38 * ((peak.score - min) / (max - min));
      return {
        id: uid('sug'),
        start: Math.floor(start * 10) / 10,
        end: Math.floor(end * 10) / 10,
        title: `${LABELS[i % LABELS.length]} · ${fmt(peak.t)}`,
        score: Math.round(score * 100) / 100,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - t) < 0.04) return resolve();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.currentTime = t;
    window.setTimeout(done, 2500);
  });
}

export type FacecamAnalysis = {
  hasFacecam: boolean;
  box: { x: number; y: number; w: number; h: number };
  confidence: number;
};

export type TrackOptions = {
  mode?: 'auto' | 'facecam' | 'action';
  onProgress?: (p: number) => void;
};

function isSkin(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > 40 && g > 25 && b > 15 && r > g;
}

/**
 * Samples frames through a clip and finds the horizontal centre of attention.
 * Features StreamLadder-style Facecam & Action Detection:
 * - Detects streamer facecam via skin-tone density and facial motion.
 * - In 'auto' or 'facecam' mode, locks the 9:16 crop onto the streamer's webcam so reactions stay framed.
 * - Smoothly falls back to gameplay action tracking if no facecam is detected.
 */
export async function trackMotion(
  url: string,
  start: number,
  end: number,
  optionsOrProgress?: TrackOptions | ((p: number) => void),
): Promise<PanPoint[] & { facecam?: FacecamAnalysis }> {
  const options: TrackOptions =
    typeof optionsOrProgress === 'function' ? { onProgress: optionsOrProgress } : optionsOrProgress ?? {};
  const mode = options.mode ?? 'auto';
  const onProgress = options.onProgress;

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error('Could not read the video for auto-reframe.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadeddata', ok);
      video.removeEventListener('error', fail);
    };
    video.addEventListener('loadeddata', ok);
    video.addEventListener('error', fail);
    video.load();
  });

  const W = 96;
  const H = 54;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !video.videoWidth) {
    const empty: PanPoint[] & { facecam?: FacecamAnalysis } = [];
    return empty;
  }

  const count = Math.round(clamp((end - start) * 3, 20, 140));
  const raw: { t: number; x: number }[] = [];
  let prev: Float32Array | null = null;

  // Track skin-pixel spatial distribution to find webcam
  const skinAcc = new Float32Array(W * H);
  let skinFrames = 0;

  for (let i = 0; i < count; i++) {
    const t = start + ((end - start) * i) / Math.max(1, count - 1);
    await seek(video, t);
    try {
      ctx.drawImage(video, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      const lum = new Float32Array(W * H);

      // Frame skin mask
      let frameSkinCount = 0;
      for (let p = 0; p < W * H; p++) {
        const r = data[p * 4];
        const g = data[p * 4 + 1];
        const b = data[p * 4 + 2];
        lum[p] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        if (isSkin(r, g, b)) {
          skinAcc[p] += 1;
          frameSkinCount++;
        }
      }
      if (frameSkinCount > 8) skinFrames++;

      if (prev) {
        const cols = new Float32Array(W);
        let total = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            const d = Math.abs(lum[idx] - prev[idx]);
            cols[x] += d;
            total += d;
          }
        }
        let centre = 0.5;
        if (total > 0.6) {
          let acc = 0;
          for (let x = 0; x < W; x++) acc += (x + 0.5) * cols[x];
          centre = acc / total / W;
        }
        raw.push({ t, x: clamp(centre, 0.05, 0.95) });
      }
      prev = lum;
    } catch {
      // Tainted canvas (cross-origin video without CORS) — bail out gracefully.
      const empty: PanPoint[] & { facecam?: FacecamAnalysis } = [];
      return empty;
    }
    onProgress?.((i + 1) / count);
  }

  // Analyze facecam presence across 4 primary stream quadrants + center
  let bestQuad = { x: 0.5, y: 0.5, w: 0.35, h: 0.35, score: 0 };
  const quadrants = [
    { name: 'top-left', x0: 0, y0: 0, x1: Math.floor(W * 0.42), y1: Math.floor(H * 0.5) },
    { name: 'top-right', x0: Math.floor(W * 0.58), y0: 0, x1: W, y1: Math.floor(H * 0.5) },
    { name: 'bottom-left', x0: 0, y0: Math.floor(H * 0.5), x1: Math.floor(W * 0.42), y1: H },
    { name: 'bottom-right', x0: Math.floor(W * 0.58), y0: Math.floor(H * 0.5), x1: W, y1: H },
    { name: 'center', x0: Math.floor(W * 0.25), y0: Math.floor(H * 0.15), x1: Math.floor(W * 0.75), y1: Math.floor(H * 0.85) },
  ];

  for (const q of quadrants) {
    let quadSkin = 0;
    let quadArea = (q.x1 - q.x0) * (q.y1 - q.y0);
    let skinCenterX = 0;
    let skinCenterY = 0;

    for (let y = q.y0; y < q.y1; y++) {
      for (let x = q.x0; x < q.x1; x++) {
        const val = skinAcc[y * W + x];
        if (val >= Math.max(2, count * 0.2)) {
          quadSkin += val;
          skinCenterX += x * val;
          skinCenterY += y * val;
        }
      }
    }

    const density = quadSkin / Math.max(1, quadArea * count);
    if (density > 0.04 && density > bestQuad.score) {
      const cx = (skinCenterX / Math.max(1, quadSkin) + 0.5) / W;
      const cy = (skinCenterY / Math.max(1, quadSkin) + 0.5) / H;
      bestQuad = {
        x: clamp(cx, 0.15, 0.85),
        y: clamp(cy, 0.15, 0.85),
        w: (q.x1 - q.x0) / W,
        h: (q.y1 - q.y0) / H,
        score: density,
      };
    }
  }

  const hasFacecam = bestQuad.score >= 0.045;
  const facecam: FacecamAnalysis = {
    hasFacecam,
    box: { x: bestQuad.x, y: bestQuad.y, w: bestQuad.w, h: bestQuad.h },
    confidence: Math.min(1, Math.round(bestQuad.score * 1200) / 100),
  };

  // Adjust crop points based on mode & facecam
  const targetX = bestQuad.x;
  const adjusted = raw.map((point) => {
    let finalX = point.x;
    if (mode === 'facecam' && hasFacecam) {
      finalX = targetX;
    } else if (mode === 'auto' && hasFacecam) {
      // StreamLadder style: Lock tightly onto facecam (75%) with subtle action drift (25%)
      finalX = targetX * 0.75 + point.x * 0.25;
    }
    return { t: point.t, x: clamp(finalX, 0.05, 0.95) };
  });

  const smoothed = adjusted.map((point, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(adjusted.length - 1, i + 2); j++) {
      sum += adjusted[j].x;
      n++;
    }
    return { t: point.t, x: clamp(sum / n, 0.05, 0.95) };
  });

  const result = smoothed as PanPoint[] & { facecam?: FacecamAnalysis };
  result.facecam = facecam;
  return result;
}
