import type { Clip, Cue, Style } from '../types';
import { clamp } from './format';

export const FONT_STACKS: Record<string, string> = {
  anton: 'Anton, Impact, "Arial Black", sans-serif',
  inter: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, monospace',
};

const FILTERS: Record<string, string> = {
  none: 'none',
  vivid: 'saturate(1.22) contrast(1.06)',
  cinematic: 'contrast(1.12) saturate(1.05) sepia(0.08)',
  noir: 'grayscale(1) contrast(1.15)',
};

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function centreAt(clip: Clip, time: number): number | null {
  if (!clip.autoReframe || !clip.panTrack || clip.panTrack.length < 2) return null;
  const track = clip.panTrack;
  let a = track[0];
  let b = track[track.length - 1];
  for (let i = 0; i < track.length - 1; i++) {
    if (time >= track[i].t && time <= track[i + 1].t) {
      a = track[i];
      b = track[i + 1];
      break;
    }
  }
  if (time <= track[0].t) return track[0].x;
  if (time >= track[track.length - 1].t) return track[track.length - 1].x;
  const span = b.t - a.t;
  const k = span > 0 ? clamp((time - a.t) / span, 0, 1) : 0;
  const eased = k * k * (3 - 2 * k);
  return a.x + (b.x - a.x) * eased;
}

function drawSplit(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  clip: Clip,
  style: Style,
  time: number,
  W: number,
  H: number,
  vw: number,
  vh: number,
  s: number,
) {
  const splitRatio = clamp(clip.splitRatio ?? 0.38, 0.25, 0.55);
  const topH = Math.round(H * splitRatio);
  const bottomH = H - topH;

  // --- Top part: Facecam ---
  const camZoom = clamp(clip.camZoom ?? 1.35, 1, 3);
  const camCenterX = clip.camPan ?? clip.facecamPosition?.x ?? 0.18;
  const camCenterY = clip.facecamPosition?.y ?? 0.22;

  const topAspect = W / topH;
  let camSh = (vh * 0.45) / camZoom;
  let camSw = camSh * topAspect;
  if (camSw > vw) {
    camSw = vw;
    camSh = camSw / topAspect;
  }
  const camSx = clamp(vw * camCenterX - camSw / 2, 0, Math.max(0, vw - camSw));
  const camSy = clamp(vh * camCenterY - camSh / 2, 0, Math.max(0, vh - camSh));

  ctx.save();
  ctx.filter = FILTERS[style.filter] ?? 'none';
  ctx.drawImage(video, camSx, camSy, camSw, camSh, 0, 0, W, topH);
  ctx.restore();

  // --- Bottom part: Gameplay ---
  const gameAspect = W / bottomH;
  const gameZoom = clamp(clip.zoom ?? 1, 1, 3);
  let gameSh = vh / gameZoom;
  let gameSw = gameSh * gameAspect;
  if (gameSw > vw) {
    gameSw = vw;
    gameSh = gameSw / gameAspect;
  }
  const fraction = gameSw / vw;
  const centre = centreAt(clip, time);
  const target = centre ?? clip.pan * (1 - fraction) + fraction / 2;
  const gameSx = clamp(vw * target - gameSw / 2, 0, Math.max(0, vw - gameSw));
  const gameSy = clamp((vh - gameSh) / 2, 0, Math.max(0, vh - gameSh));

  ctx.save();
  ctx.filter = FILTERS[style.filter] ?? 'none';
  ctx.drawImage(video, gameSx, gameSy, gameSw, gameSh, 0, topH, W, bottomH);
  ctx.restore();

  // --- Sleek divider line (StreamLadder style) ---
  ctx.save();
  const divY = topH;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, divY - 3 * s, W, 6 * s);

  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(190, 242, 100, 0.9)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(1, 'rgba(167, 139, 250, 0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, divY - 1.5 * s, W, 3 * s);
  ctx.restore();
}

function drawFill(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  clip: Clip,
  style: Style,
  time: number,
  W: number,
  H: number,
  vw: number,
  vh: number,
) {
  const srcAspect = vw / vh;
  const dstAspect = W / H;
  const zoom = clamp(clip.zoom, 1, 3);
  let sw: number;
  let sh: number;
  if (srcAspect > dstAspect) {
    sh = vh / zoom;
    sw = sh * dstAspect;
  } else {
    sw = vw / zoom;
    sh = sw / dstAspect;
  }
  sw = Math.min(sw, vw);
  sh = Math.min(sh, vh);

  const fraction = sw / vw;
  const centre = centreAt(clip, time);
  const target = centre ?? clip.pan * (1 - fraction) + fraction / 2;
  const sx = clamp(vw * target - sw / 2, 0, Math.max(0, vw - sw));
  const sy = clamp((vh - sh) / 2, 0, Math.max(0, vh - sh));

  ctx.save();
  ctx.filter = FILTERS[style.filter] ?? 'none';
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
  ctx.restore();
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  style: Style,
  W: number,
  H: number,
  vw: number,
  vh: number,
  s: number,
) {
  if (style.layout === 'blur') {
    const scale = Math.max(W / vw, H / vh);
    const w = vw * scale;
    const h = vh * scale;
    const overscan = 60 * s;
    ctx.save();
    ctx.filter = 'blur(46px) saturate(1.25) brightness(0.6)';
    ctx.drawImage(video, (W - w) / 2 - overscan, (H - h) / 2 - overscan, w + overscan * 2, h + overscan * 2);
    ctx.restore();
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(5,4,12,0.35)');
    shade.addColorStop(0.5, 'rgba(5,4,12,0.1)');
    shade.addColorStop(1, 'rgba(5,4,12,0.5)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  if (style.layout === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, style.bgA);
    grad.addColorStop(1, style.bgB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W * 0.2, H * 0.18, 0, W * 0.2, H * 0.18, W * 0.9);
    glow.addColorStop(0, 'rgba(255,255,255,0.22)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const glow2 = ctx.createRadialGradient(W * 0.85, H * 0.9, 0, W * 0.85, H * 0.9, W * 1.1);
    glow2.addColorStop(0, 'rgba(0,0,0,0.35)');
    glow2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  ctx.fillStyle = style.bgA;
  ctx.fillRect(0, 0, W, H);
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  style: Style,
  W: number,
  H: number,
  vw: number,
  vh: number,
  s: number,
) {
  const pad = (clamp(style.padding, 0, 14) / 100) * W;
  const cardW = W - pad * 2;
  const cardH = Math.min(cardW * (vh / vw), H * 0.72);
  const x = pad;
  const y = H * 0.47 - cardH / 2;
  const r = style.radius * s;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 60 * s;
  ctx.shadowOffsetY = 22 * s;
  ctx.fillStyle = '#000';
  rrect(ctx, x, y, cardW, cardH, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  rrect(ctx, x, y, cardW, cardH, r);
  ctx.clip();
  ctx.filter = FILTERS[style.filter] ?? 'none';
  ctx.drawImage(video, 0, 0, vw, vh, x, y, cardW, cardH);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = Math.max(1, 2 * s);
  rrect(ctx, x, y, cardW, cardH, r);
  ctx.stroke();
  ctx.restore();
}

function drawOverlays(ctx: CanvasRenderingContext2D, style: Style, clip: Clip, time: number, W: number, H: number, s: number) {
  const span = Math.max(0.1, clip.end - clip.start);
  const progress = clamp((time - clip.start) / span, 0, 1);

  if (style.progress) {
    const barH = Math.max(4, 9 * s);
    const barW = W * 0.84;
    const x = (W - barW) / 2;
    const y = H * 0.045;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    rrect(ctx, x, y, barW, barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = style.progressColor;
    rrect(ctx, x, y, Math.max(barH, barW * progress), barH, barH / 2);
    ctx.fill();
    ctx.restore();
  }

  const handle = style.handle.trim();
  if (handle) {
    const size = 34 * s;
    ctx.save();
    ctx.font = `800 ${size}px ${FONT_STACKS.inter}`;
    const text = handle.startsWith('@') ? handle : `@${handle}`;
    const w = ctx.measureText(text).width;
    const h = size * 1.9;
    const x = W * 0.06;
    const y = H * 0.09;
    ctx.fillStyle = 'rgba(8,6,16,0.5)';
    rrect(ctx, x - size * 0.5, y - h / 2, w + size, h, h / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }
}

function drawCaptions(ctx: CanvasRenderingContext2D, style: Style, cues: Cue[], time: number, W: number, H: number) {
  const cs = style.captions;
  if (!cs.enabled) return;
  const cue = cues.find((c) => time >= c.start - 0.001 && time <= c.end + 0.001);
  if (!cue) return;

  const text = cs.uppercase ? cue.text.toUpperCase() : cue.text;
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return;

  const fontSize = Math.max(10, (cs.size / 100) * H);
  ctx.save();
  ctx.font = `900 ${fontSize}px ${FONT_STACKS[cs.font] ?? FONT_STACKS.anton}`;
  ctx.textBaseline = 'middle';

  const maxW = W * clamp(cs.maxWidth, 0.3, 1);
  const spaceW = ctx.measureText(' ').width;
  const widths = words.map((w) => ctx.measureText(w).width);

  const lines: { words: string[]; widths: number[] }[] = [];
  let lineWords: string[] = [];
  let lineWidths: number[] = [];
  let lineWidth = 0;

  words.forEach((word, i) => {
    const add = widths[i] + (lineWords.length ? spaceW : 0);
    if (lineWords.length && lineWidth + add > maxW) {
      lines.push({ words: lineWords, widths: lineWidths });
      lineWords = [word];
      lineWidths = [widths[i]];
      lineWidth = widths[i];
    } else {
      lineWords.push(word);
      lineWidths.push(widths[i]);
      lineWidth += add;
    }
  });
  if (lineWords.length) lines.push({ words: lineWords, widths: lineWidths });

  const lineH = fontSize * 1.08;
  const blockH = lines.length * lineH;
  const centreY = H * clamp(cs.y, 0.1, 0.95);
  const topY = centreY - blockH / 2;

  const cueDur = Math.max(0.15, cue.end - cue.start);
  const elapsed = clamp(time - cue.start, 0, cueDur);
  const pop = elapsed < 0.16 ? 1 + 0.12 * (1 - elapsed / 0.16) : 1;
  const active = Math.min(words.length - 1, Math.floor((elapsed / cueDur) * words.length));

  ctx.translate(W / 2, centreY);
  ctx.scale(pop, pop);
  ctx.translate(-W / 2, -centreY);

  let index = 0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const total = line.widths.reduce((a, b) => a + b, 0) + spaceW * (line.widths.length - 1);
    const y = topY + li * lineH + lineH / 2;

    if (cs.box) {
      ctx.fillStyle = `rgba(0,0,0,${clamp(cs.boxOpacity, 0, 1)})`;
      rrect(
        ctx,
        W / 2 - total / 2 - fontSize * 0.24,
        y - lineH * 0.46,
        total + fontSize * 0.48,
        lineH * 0.92,
        fontSize * 0.18,
      );
      ctx.fill();
    }

    let x = W / 2 - total / 2;
    ctx.textAlign = 'left';
    for (let k = 0; k < line.words.length; k++) {
      const word = line.words[k];
      if (cs.stroke) {
        ctx.lineWidth = Math.max(2, fontSize * 0.16);
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineJoin = 'round';
        ctx.strokeText(word, x, y);
      }
      ctx.fillStyle = index === active ? cs.accent : cs.color;
      ctx.fillText(word, x, y);
      x += line.widths[k] + spaceW;
      index++;
    }
  }

  ctx.restore();
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  clip: Clip,
  style: Style,
  cues: Cue[],
  time: number,
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const s = H / 1920;
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#08060f';
  ctx.fillRect(0, 0, W, H);
  if (!vw || !vh) return;

  if (style.layout === 'fill') {
    drawFill(ctx, video, clip, style, time, W, H, vw, vh);
  } else if (style.layout === 'split') {
    drawSplit(ctx, video, clip, style, time, W, H, vw, vh, s);
  } else {
    drawBackdrop(ctx, video, style, W, H, vw, vh, s);
    drawCard(ctx, video, style, W, H, vw, vh, s);
  }

  drawOverlays(ctx, style, clip, time, W, H, s);
  drawCaptions(ctx, style, cues, time, W, H);
}
