import fs from 'node:fs';
import { findTool, execCommand } from '../utils/tools.js';

export type VideoProbeResult = {
  title: string;
  duration: number;
  durationFormatted: string;
  uploader?: string;
  width?: number;
  height?: number;
  fps?: number;
  isLive?: boolean;
  thumbnail?: string;
  sourceType: 'online_stream' | 'local_file';
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const h = Math.floor(m / 60);
  if (h > 0) {
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function probeMedia(urlOrPath: string): Promise<VideoProbeResult> {
  const isLocal = fs.existsSync(urlOrPath);

  if (isLocal) {
    const ffprobe = await findTool('ffprobe', ['-version']);
    if (!ffprobe) {
      throw new Error('ffprobe is required to probe local media files, but was not found on PATH or in tools/.');
    }

    const { stdout, code } = await execCommand(ffprobe.command, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      urlOrPath,
    ], { timeoutMs: 15000 });

    if (code !== 0) {
      throw new Error(`Failed to probe local file: ${urlOrPath}`);
    }

    const data = JSON.parse(stdout);
    const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
    const duration = Number(data.format?.duration || videoStream?.duration || 0);

    return {
      title: data.format?.tags?.title || urlOrPath.split(/[\/\\]/).pop() || 'Local Video',
      duration,
      durationFormatted: formatDuration(duration),
      width: videoStream?.width ? Number(videoStream.width) : undefined,
      height: videoStream?.height ? Number(videoStream.height) : undefined,
      fps: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : undefined,
      sourceType: 'local_file',
    };
  }

  // Online stream URL: Use yt-dlp
  const ytdlp = await findTool('yt-dlp', ['--version']);
  if (!ytdlp) {
    throw new Error('yt-dlp is required to probe online stream URLs (YouTube, Twitch, Kick), but was not found.');
  }

  const { stdout, code } = await execCommand(ytdlp.command, [
    '--dump-single-json',
    '--no-playlist',
    '--skip-download',
    urlOrPath,
  ], { timeoutMs: 30000 });

  if (code !== 0) {
    throw new Error(`yt-dlp failed to inspect URL: ${urlOrPath}`);
  }

  const data = JSON.parse(stdout);
  const duration = Number(data.duration || 0);

  return {
    title: data.title || 'Untitled Stream',
    duration,
    durationFormatted: formatDuration(duration),
    uploader: data.uploader || data.channel,
    width: data.width,
    height: data.height,
    fps: data.fps,
    isLive: Boolean(data.is_live),
    thumbnail: data.thumbnail,
    sourceType: 'online_stream',
  };
}
