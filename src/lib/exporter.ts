import type { Clip, Cue, Style } from '../types';
import { clamp } from './format';
import { renderFrame } from './render';

export type ExportFormat = 'mp4' | 'webm';

const MP4_MIMES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'];
const WEBM_MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function mediaRecorderAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
}

export function supportsMp4(): boolean {
  return mediaRecorderAvailable() && MP4_MIMES.some((m) => MediaRecorder.isTypeSupported(m));
}

export function pickMime(format: ExportFormat): { mime: string; ext: ExportFormat } | null {
  if (!mediaRecorderAvailable()) return null;
  const list = format === 'mp4' ? [...MP4_MIMES, ...WEBM_MIMES] : WEBM_MIMES;
  const mime = list.find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) return null;
  return { mime, ext: mime.includes('mp4') ? 'mp4' : 'webm' };
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - t) < 0.03) return resolve();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.currentTime = t;
    window.setTimeout(done, 2000);
  });
}

export type ExportArgs = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  clip: Clip;
  style: Style;
  cues: Cue[];
  width: number;
  height: number;
  format: ExportFormat;
  fps?: number;
  audioStream: MediaStream | null;
  onProgress?: (p: number) => void;
};

/**
 * Draws the clip to a canvas in real time and records canvas video plus the
 * app's audio graph. Runs at 1x speed, so a 30s clip takes about 30s to render.
 */
export async function exportClip(args: ExportArgs): Promise<{ blob: Blob; ext: string; mime: string }> {
  const { video, canvas, clip, style, cues, width, height, format, audioStream, onProgress } = args;

  const picked = pickMime(format);
  if (!picked) throw new Error('This browser cannot record video. Try Chrome, Edge or Firefox.');

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the export canvas.');

  canvas.width = width;
  canvas.height = height;

  const wasMuted = video.muted;
  let canvasStream: MediaStream | null = null;
  let interrupted = false;
  const onVisibility = () => {
    if (document.hidden) interrupted = true;
  };
  document.addEventListener('visibilitychange', onVisibility);

  video.pause();
  video.muted = false;
  video.volume = 1;

  try {
    await seek(video, clip.start);
    renderFrame(ctx, video, clip, style, cues, clip.start);
    onProgress?.(0);

    const targetFps = args.fps || 60;
    canvasStream = canvas.captureStream(targetFps);
    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
    if (audioStream) tracks.push(...audioStream.getAudioTracks());

    await video.play().catch(() => undefined);
    if (video.paused) {
      await video.play().catch(() => undefined);
    }
    if (video.paused) {
      throw new Error('The browser blocked playback, so nothing could be recorded. Press play once, then export again.');
    }

    const bitrate =
      width >= 2000
        ? 32_000_000
        : width >= 1400
          ? 20_000_000
          : width >= 1000
            ? 12_000_000
            : 6_000_000;

    const recorder = new MediaRecorder(new MediaStream(tracks), {
      mimeType: picked.mime,
      videoBitsPerSecond: bitrate,
      audioBitsPerSecond: 192_000,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(200);

    await new Promise<void>((resolve) => {
      let raf = 0;
      let timer = 0;

      const finish = () => {
        window.clearTimeout(timer);
        cancelAnimationFrame(raf);
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('ended', onTimeUpdate);
        resolve();
      };

      // Also stop on media events so a throttled tab cannot overrun the clip.
      const onTimeUpdate = () => {
        if (video.currentTime >= clip.end - 0.03 || video.ended) {
          renderFrame(ctx, video, clip, style, cues, clip.end);
          finish();
        }
      };

      timer = window.setTimeout(finish, (clip.end - clip.start + 12) * 1000);
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('ended', onTimeUpdate);

      const loop = () => {
        if (video.currentTime >= clip.end - 0.03 || video.ended) {
          renderFrame(ctx, video, clip, style, cues, clip.end);
          finish();
          return;
        }
        renderFrame(ctx, video, clip, style, cues, video.currentTime);
        onProgress?.(clamp((video.currentTime - clip.start) / Math.max(0.1, clip.end - clip.start), 0, 1));
        raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);
    });

    video.pause();
    recorder.stop();
    await stopped;

    if (interrupted) {
      throw new Error('Rendering stopped because the tab went to the background. Keep it visible and try again.');
    }
    onProgress?.(1);

    const blob = new Blob(chunks, { type: picked.mime });
    if (!blob.size) throw new Error('The recording came out empty — press play once, then export again.');
    return { blob, ext: picked.ext, mime: picked.mime };
  } finally {
    document.removeEventListener('visibilitychange', onVisibility);
    canvasStream?.getTracks().forEach((track) => track.stop());
    video.muted = wasMuted;
    video.pause();
  }
}
