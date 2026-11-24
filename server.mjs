import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { aiStatus, startAiJob, getAiJob, listAiJobs, cancelAiJob, pruneAiJobs, startTranscriptionJob, getTranscriptionJob, cancelTranscriptionJob, MAX_ANALYSIS_SECONDS } from './server/ai.mjs';
import { geminiStatus, generateViralPackage } from './server/gemini.mjs';
import { getOllamaHardwareInfo, startOllamaPull, getOllamaPullStatus } from './server/ollama.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(ROOT, '.cache', 'clips');
const UPLOAD_DIR = path.join(ROOT, '.cache', 'uploads');
const STORE_FILE = path.join(ROOT, '.cache', 'store.json');
const PORT = Number(process.env.PORT) || 5173;
const LAN = process.argv.includes('--lan') || process.env.LAN === '1' || process.env.NODE_ENV === 'production' || Boolean(process.env.PORT);
const CLIP_TTL_MS = 6 * 60 * 60 * 1000;
const JOB_TTL_MS = 30 * 60 * 1000;
const RUNNING_JOB_MAX_MS = 2 * 60 * 60 * 1000;
const MEDIA_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$/i;
const UPLOAD_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm|mov|m4v|mkv)$/i;
const ASPECTS = ['9:16', '16:9', '1:1'];

fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Single source of truth, also imported by the client.
const PLATFORM_HOSTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'platforms.json'), 'utf8')).hosts;

const LOCAL_CANDIDATES = {
  ytdlp: [
    path.join(ROOT, 'tools', 'yt-dlp.exe'),
    path.join(ROOT, 'tools', 'yt-dlp'),
    path.join(ROOT, '.venv', 'Scripts', 'yt-dlp.exe'),
    path.join(ROOT, '.venv', 'bin', 'yt-dlp'),
  ],
  ffmpeg: [path.join(ROOT, 'tools', 'ffmpeg.exe'), path.join(ROOT, 'tools', 'ffmpeg')],
  ffprobe: [path.join(ROOT, 'tools', 'ffprobe.exe'), path.join(ROOT, 'tools', 'ffprobe')],
};

const MISSING_YTDLP =
  'yt-dlp is not installed. Run "npm run setup:links" or install yt-dlp globally, then restart the app.';
const MISSING_FFMPEG =
  'ffmpeg is not installed. Install it with "winget install Gyan.FFmpeg" (or put ffmpeg.exe in tools/), then restart the app.';

const jobs = new Map();

/* ---------------- tool discovery ---------------- */

function binaryVersion(command, args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      resolve(null);
      return;
    }

    let output = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, 15000);

    child.stdout.on('data', (chunk) => {
      if (output.length < 20000) output += chunk.toString();
    });
    child.on('error', () => finish(null));
    child.on('close', (code) => {
      const version = output.split('\n')[0].trim();
      finish(code === 0 && version ? version.slice(0, 120) : null);
    });
  });
}

/** Local bundled binary first, then whatever is on PATH (global install). */
async function resolveTool(name, local, versionArgs) {
  for (const candidate of local) {
    if (!fs.existsSync(candidate)) continue;
    const version = await binaryVersion(candidate, versionArgs);
    if (version) return { command: candidate, version, source: 'local' };
  }

  const names = process.platform === 'win32' ? [name, `${name}.exe`] : [name];
  for (const command of names) {
    const version = await binaryVersion(command, versionArgs);
    if (version) return { command, version, source: 'global' };
  }
  return null;
}

async function resolveTools() {
  const [ytdlp, ffmpeg, ffprobe] = await Promise.all([
    resolveTool('yt-dlp', LOCAL_CANDIDATES.ytdlp, ['--version']),
    resolveTool('ffmpeg', LOCAL_CANDIDATES.ffmpeg, ['-version']),
    resolveTool('ffprobe', LOCAL_CANDIDATES.ffprobe, ['-version']),
  ]);
  return { ytdlp, ffmpeg, ffprobe };
}

const tools = await resolveTools();

/* ---------------- helpers ---------------- */

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function parseTarget(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw));
  } catch {
    throw new Error('That does not look like a URL.');
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Only http(s) links are supported.');
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const allowed = PLATFORM_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!allowed) {
    throw new Error('Unsupported host. Paste a Twitch, YouTube, Kick, TikTok or Instagram video link — or download the file and drop it in.');
  }
  return parsed;
}

function hms(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function cleanError(text) {
  const lines = text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const errorLine = lines.find((line) => /^ERROR:/i.test(line));
  return (errorLine || lines[lines.length - 1] || '').slice(0, 300);
}

function safeName(value) {
  return (
    String(value || '')
      .replace(/[^\w\s.-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'streamclip'
  );
}

function runYtDlp(args, { timeoutMs = 120000, onProgress, collectStdout = false, onStart } = {}) {
  if (!tools.ytdlp) return Promise.reject(new Error(MISSING_YTDLP));

  return new Promise((resolve, reject) => {
    const child = spawn(tools.ytdlp.command, args, { windowsHide: true });
    onStart?.(child);
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(reject, new Error('The download timed out.'));
    }, timeoutMs);

    const scan = (text) => {
      if (!onProgress) return;
      const matches = [...text.matchAll(/\[download\]\s+(\d+(?:\.\d+)?)%/g)];
      if (matches.length) {
        const value = Number.parseFloat(matches[matches.length - 1][1]);
        if (Number.isFinite(value)) return onProgress(value);
      }
      const ffmpegTime = [...text.matchAll(/time=(\d+):(\d+):(\d+)(?:\.\d+)?/g)];
      if (ffmpegTime.length) {
        const last = ffmpegTime[ffmpegTime.length - 1];
        const secs = Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
        if (Number.isFinite(secs) && secs > 0) {
          onProgress(Math.min(96, Math.max(8, Math.round((secs / 60) * 100))));
        }
      }
    };

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (collectStdout && stdout.length < 80 * 1024 * 1024) stdout += text;
      scan(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr = (stderr + text).slice(-20000);
      scan(text);
    });
    child.on('error', (error) => finish(reject, error));
    child.on('close', (code) => {
      if (code === 0) finish(resolve, { stdout, stderr });
      else finish(reject, new Error(cleanError(stderr) || `yt-dlp exited with code ${code}.`));
    });
  });
}

function probe(file) {
  if (!tools.ffprobe) return Promise.resolve({ width: 0, height: 0, duration: 0 });

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(
        tools.ffprobe.command,
        ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
      );
    } catch {
      resolve({ width: 0, height: 0, duration: 0 });
      return;
    }

    let stdout = '';
    child.stdout.on('data', (chunk) => {
      if (stdout.length < 4 * 1024 * 1024) stdout += chunk;
    });
    child.on('close', () => {
      try {
        const data = JSON.parse(stdout);
        const video = (data.streams || []).find((stream) => stream.codec_type === 'video');
        resolve({
          width: Number(video?.width) || 0,
          height: Number(video?.height) || 0,
          duration: Number(data.format?.duration) || 0,
        });
      } catch {
        resolve({ width: 0, height: 0, duration: 0 });
      }
    });
    child.on('error', () => resolve({ width: 0, height: 0, duration: 0 }));
  });
}

function streamFile(res, file, start, end, headers) {
  const stream = fs.createReadStream(file, start === undefined ? undefined : { start, end });
  stream.on('error', () => {
    if (!res.headersSent) json(res, 500, { error: 'Could not read the clip file.' });
    else res.destroy();
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

function serveMedia(req, res, rawName) {
  let name;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    name = rawName;
  }
  // Only UUID-named mp4s produced by a download job live here; this also blocks traversal.
  if (!MEDIA_NAME_RE.test(name)) return json(res, 404, { error: 'Unknown clip.' });

  return sendFileWithRange(req, res, path.join(CACHE_DIR, name), 'video/mp4', 'That download is no longer on disk.');
}

/** Maps a served media URL back to the local file, without accepting arbitrary paths. */
function resolveMediaPath(mediaUrl) {
  const value = String(mediaUrl || '');
  const upload = /^\/api\/uploads\/([^/]+)$/.exec(value);
  if (upload) {
    const name = decodeURIComponent(upload[1]);
    if (!UPLOAD_NAME_RE.test(name)) throw new Error('Unsupported media URL.');
    const file = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(file)) throw new Error('The uploaded video is no longer on disk.');
    return file;
  }
  const clip = /^\/api\/media\/([^/]+)$/.exec(value);
  if (clip) {
    const name = decodeURIComponent(clip[1]);
    if (!MEDIA_NAME_RE.test(name)) throw new Error('Unsupported media URL.');
    const file = path.join(CACHE_DIR, name);
    if (!fs.existsSync(file)) throw new Error('That downloaded segment is no longer on disk. Re-import the source.');
    return file;
  }
  throw new Error('Unsupported media URL.');
}

function serveUpload(req, res, rawName) {
  let name;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    name = rawName;
  }
  if (!UPLOAD_NAME_RE.test(name)) return json(res, 404, { error: 'Unknown upload.' });
  return sendFileWithRange(req, res, path.join(UPLOAD_DIR, name), 'video/mp4', 'That uploaded video is no longer on disk.');
}

function sendFileWithRange(req, res, file, contentType, missingMessage) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return json(res, 404, { error: missingMessage });
  }

  const total = stat.size;
  const range = req.headers.range;
  const headers = { 'Content-Type': contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` });
      return res.end();
    }
    const start = match[1] ? Number.parseInt(match[1], 10) : 0;
    const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : total - 1;
    const end = Math.min(requestedEnd, total - 1);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return streamFile(res, file, start, end);
  }

  res.writeHead(200, { ...headers, 'Content-Length': total });
  if (req.method === 'HEAD') return res.end();
  return streamFile(res, file, undefined, undefined);
}

/* ---------------- link jobs ---------------- */

function startSliceJob(url, start, length, title) {
  const id = randomUUID();
  const file = path.join(CACHE_DIR, `${id}.mp4`);
  const job = {
    id,
    status: 'running',
    percent: 0,
    createdAt: Date.now(),
    finishedAt: null,
    title: title || 'stream clip',
    start,
    length,
  };
  jobs.set(id, job);

  const ffmpegArgs =
    tools.ffmpeg?.source === 'local' ? ['--ffmpeg-location', path.dirname(tools.ffmpeg.command)] : [];

  const args = [
    '-f',
    'bv*[height<=1080]+ba/b[height<=1080]',
    '--merge-output-format',
    'mp4',
    '--download-sections',
    `*${hms(start)}-${hms(start + length)}`,
    '--force-keyframes-at-cuts',
    '--no-part',
    '--no-playlist',
    '--no-warnings',
    '--newline',
    ...ffmpegArgs,
    '-o',
    file,
    url,
  ];

  (async () => {
    try {
      await runYtDlp(args, {
        timeoutMs: 20 * 60 * 1000,
        onProgress: (percent) => {
          job.percent = Math.min(99, Math.round(percent));
        },
        onStart: (child) => {
          job.child = child;
        },
      });
      const meta = await probe(file);
      const size = fs.statSync(file).size;
      job.status = 'done';
      job.percent = 100;
      job.finishedAt = Date.now();
      job.mediaUrl = `/api/media/${id}.mp4`;
      job.fileName = `${safeName(job.title)}-${Math.floor(start)}s.mp4`;
      job.width = meta.width;
      job.height = meta.height;
      job.duration = meta.duration || length;
      job.size = size;
      console.log(`[link] ready: ${job.fileName} (${(size / 1048576).toFixed(1)} MB, ${meta.width}x${meta.height})`);
    } catch (error) {
      job.status = 'error';
      job.finishedAt = Date.now();
      job.error = error.message || 'Download failed.';
      try {
        fs.unlinkSync(file);
      } catch {
        /* nothing to clean */
      }
      console.error(`[link] failed: ${job.error}`);
    }
  })();

  return job;
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    percent: job.percent,
    error: job.error,
    mediaUrl: job.mediaUrl,
    fileName: job.fileName,
    width: job.width,
    height: job.height,
    duration: job.duration,
    size: job.size,
  };
}

function pruneCache() {
  const now = Date.now();
  let removed = 0;

  try {
    for (const name of fs.readdirSync(CACHE_DIR)) {
      const file = path.join(CACHE_DIR, name);
      try {
        const stat = fs.statSync(file);
        if (stat.isFile() && now - stat.mtimeMs > CLIP_TTL_MS) {
          fs.unlinkSync(file);
          removed += 1;
        }
      } catch {
        /* file vanished while scanning */
      }
    }
  } catch {
    /* cache dir missing */
  }

  for (const [id, job] of jobs) {
    const age = now - (job.finishedAt ?? job.createdAt);
    if (job.status === 'running' ? age > RUNNING_JOB_MAX_MS : age > JOB_TTL_MS) jobs.delete(id);
  }

  return removed;
}

/* ---------------- channel connections ---------------- */

const CHANNELS_FILE = path.join(ROOT, '.cache', 'channels.json');
const CONNECT_PLATFORMS = ['twitch', 'youtube', 'kick'];

function readChannels() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
    return Array.isArray(parsed.channels) ? parsed.channels : [];
  } catch {
    return [];
  }
}

function writeChannels(channels) {
  const temp = `${CHANNELS_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify({ channels }, null, 2));
  fs.renameSync(temp, CHANNELS_FILE);
}

/** Turns a channel link or bare handle into canonical channel + videos URLs. */
function normalizeChannel(platform, rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) throw new Error('Paste a channel link or handle.');

  let target = input;
  if (!/^(https?:\/\/|www\.)/i.test(target)) {
    const handle = target.replace(/^@/, '').replace(/^\/+/, '');
    if (platform === 'twitch') target = `https://www.twitch.tv/${handle}`;
    else if (platform === 'youtube') target = input.startsWith('@') ? `https://www.youtube.com/${input}` : `https://www.youtube.com/@${handle}`;
    else target = `https://kick.com/${handle}`;
  }
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

  let url;
  try {
    url = new URL(target);
  } catch {
    throw new Error('That does not look like a channel link.');
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (platform === 'twitch') {
    if (!(host === 'twitch.tv' || host.endsWith('.twitch.tv'))) throw new Error('That is not a Twitch channel link.');
    const name = url.pathname.split('/').filter(Boolean)[0] || '';
    if (!name || ['videos', 'directory', 'settings', 'subscriptions', 'search'].includes(name.toLowerCase())) {
      throw new Error('Use a channel page, e.g. https://www.twitch.tv/yourname');
    }
    return { platform, handle: name, rootUrl: `https://www.twitch.tv/${name}`, videosUrl: `https://www.twitch.tv/${name}/videos` };
  }

  if (platform === 'youtube') {
    if (host === 'youtu.be') throw new Error('That is a video link — use your channel page instead.');
    if (!(host === 'youtube.com' || host.endsWith('.youtube.com'))) throw new Error('That is not a YouTube channel link.');
    const pathname = url.pathname.replace(/\/+$/, '').replace(/\/(videos|streams|shorts|live|featured)$/i, '');
    if (!pathname || pathname === '/' || /^\/(watch|playlist)$/i.test(pathname)) {
      throw new Error('Use a channel page, e.g. https://www.youtube.com/@yourname');
    }
    return {
      platform,
      handle: pathname.replace(/^\//, ''),
      rootUrl: `https://www.youtube.com${pathname}`,
      videosUrl: `https://www.youtube.com${pathname}/videos`,
    };
  }

  if (!(host === 'kick.com' || host.endsWith('.kick.com'))) throw new Error('That is not a Kick channel link.');
  const name = url.pathname.split('/').filter(Boolean)[0] || '';
  if (!name) throw new Error('Use a channel page, e.g. https://kick.com/yourname');
  return { platform, handle: name, rootUrl: `https://kick.com/${name}`, videosUrl: `https://kick.com/${name}/videos` };
}

async function flatPlaylist(url) {
  const { stdout } = await runYtDlp(['--flat-playlist', '-J', '--playlist-end', '1', '--no-warnings', url], {
    timeoutMs: 90000,
    collectStdout: true,
  });
  return JSON.parse(stdout);
}

async function resolveChannel(platform, input) {
  const normalized = normalizeChannel(platform, input);

  let data;
  try {
    data = await flatPlaylist(normalized.videosUrl);
  } catch (error) {
    data = await flatPlaylist(normalized.rootUrl).catch(() => {
      throw error;
    });
  }

  let root = null;
  if ((!data.channel && !data.uploader) || platform === 'youtube') {
    root = await flatPlaylist(normalized.rootUrl).catch(() => null);
  }

  const titlePrefix = String(data.title || '').split(' - ')[0].trim();
  const name = data.channel || root?.channel || data.uploader || root?.uploader || titlePrefix || normalized.handle;
  const avatar =
    platform === 'youtube' ? ((root?.thumbnails || data.thumbnails || []).slice(-1)[0]?.url || '') : '';

  return { platform, name, handle: normalized.handle, url: normalized.videosUrl, avatar };
}

function cleanVodUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return value;
  }
}

async function listChannelVods(channel) {
  const { stdout } = await runYtDlp(
    ['--flat-playlist', '-J', '--playlist-end', '24', '--no-warnings', channel.url],
    { timeoutMs: 90000, collectStdout: true },
  );
  const data = JSON.parse(stdout);
  const entries = Array.isArray(data.entries) ? data.entries : [];

  return entries
    .map((entry) => {
      const rawUrl = entry.webpage_url || entry.url || '';
      let url = '';
      if (/^https?:\/\//i.test(rawUrl)) url = rawUrl;
      else if (channel.platform === 'youtube' && entry.id) url = `https://www.youtube.com/watch?v=${entry.id}`;
      else if (channel.platform === 'twitch' && entry.id) url = `https://www.twitch.tv/videos/${String(entry.id).replace(/^v/, '')}`;
      else if (channel.platform === 'kick' && entry.id) url = `https://kick.com/video/${entry.id}`;

      const thumbnails = entry.thumbnails || [];
      return {
        id: String(entry.id || url),
        title: entry.title || 'Untitled stream',
        url: cleanVodUrl(url),
        duration: Number(entry.duration) || 0,
        thumbnail: entry.thumbnail || thumbnails[thumbnails.length - 1]?.url || '',
        platform: channel.platform,
        uploader: entry.uploader || channel.name,
      };
    })
    .filter((vod) => vod.url);
}

/* ---------------- workspace store ---------------- */

const DEFAULT_SETTINGS = {
  workspaceName: 'My workspace',
  defaultAspect: '9:16',
  defaultClipLength: 30,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

function defaultStore() {
  return { projects: [], schedules: [], templates: [], settings: { ...DEFAULT_SETTINGS } };
}

function readStore() {
  try {
    const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return {
      projects: Array.isArray(data.projects) ? data.projects : [],
      schedules: Array.isArray(data.schedules) ? data.schedules : [],
      templates: Array.isArray(data.templates) ? data.templates : [],
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    };
  } catch {
    return defaultStore();
  }
}

function writeStore(data) {
  const temp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, STORE_FILE);
}

function makeProject(body) {
  const now = Date.now();
  const source = body.source && typeof body.source === 'object' ? body.source : null;
  return {
    id: randomUUID(),
    name: String(body.name || source?.name || 'Untitled project').slice(0, 140),
    source,
    clips: Array.isArray(body.clips) ? body.clips : [],
    style: body.style && typeof body.style === 'object' ? body.style : null,
    cues: Array.isArray(body.cues) ? body.cues : [],
    aspect: ASPECTS.includes(body.aspect) ? body.aspect : '9:16',
    status: String(body.status || 'draft'),
    createdAt: now,
    updatedAt: now,
  };
}

function makeSchedule(body) {
  const now = Date.now();
  return {
    id: randomUUID(),
    projectId: body.projectId ? String(body.projectId) : null,
    clipId: body.clipId ? String(body.clipId) : null,
    title: String(body.title || 'Untitled post').slice(0, 140),
    caption: String(body.caption || '').slice(0, 4000),
    hashtags: String(body.hashtags || '').slice(0, 600),
    when: String(body.when || ''),
    timezone: String(body.timezone || readStore().settings.timezone),
    destinations: Array.isArray(body.destinations) ? body.destinations.map(String) : [],
    status: ['draft', 'scheduled', 'published', 'failed'].includes(body.status) ? body.status : 'draft',
    note: String(body.note || ''),
    createdAt: now,
    updatedAt: now,
  };
}

/* ---------------- API ---------------- */

async function handleApi(req, res, url) {
  const route = url.pathname;

  if (route === '/api/health') {
    return json(res, 200, {
      ok: true,
      ytdlp: Boolean(tools.ytdlp),
      ytdlpVersion: tools.ytdlp?.version ?? null,
      ytdlpSource: tools.ytdlp?.source ?? null,
      ffmpeg: Boolean(tools.ffmpeg),
      ffprobe: Boolean(tools.ffprobe),
    });
  }

  if (route.startsWith('/api/media/')) {
    return serveMedia(req, res, route.slice('/api/media/'.length));
  }

  if (route === '/api/link/info' && req.method === 'POST') {
    if (!tools.ytdlp) return json(res, 503, { error: MISSING_YTDLP });

    const body = await readBody(req);
    let target;
    try {
      target = parseTarget(body.url);
    } catch (error) {
      return json(res, 400, { error: error.message || 'Paste a supported public VOD link.' });
    }
    const { stdout } = await runYtDlp(['-J', '--no-playlist', '--no-warnings', target.toString()], {
      timeoutMs: 120000,
      collectStdout: true,
    });

    let meta;
    try {
      meta = JSON.parse(stdout);
    } catch {
      throw new Error('yt-dlp could not read that link.');
    }
    return json(res, 200, {
      title: meta.title || 'Untitled stream',
      duration: Number(meta.duration) || 0,
      uploader: meta.uploader || meta.channel || '',
      thumbnail: meta.thumbnail || '',
      extractor: String(meta.extractor_key || meta.extractor || '').replace(':', ' '),
      webpage: meta.webpage_url || target.toString(),
    });
  }

  if (route === '/api/captions' && req.method === 'POST') {
    if (!tools.ytdlp) return json(res, 503, { error: MISSING_YTDLP });

    const body = await readBody(req);
    let target;
    try {
      target = parseTarget(body.url);
    } catch (error) {
      return json(res, 400, { error: error.message || 'Paste a supported public VOD link.' });
    }
    const languages = /** @type {Record<string, { label: string; pattern: string }>} */ ({
      en: { label: 'English', pattern: 'en.*,en' },
      hi: { label: 'Hindi', pattern: 'hi.*,hi' },
      es: { label: 'Spanish', pattern: 'es.*,es' },
      fr: { label: 'French', pattern: 'fr.*,fr' },
      de: { label: 'German', pattern: 'de.*,de' },
      ja: { label: 'Japanese', pattern: 'ja.*,ja' },
      pt: { label: 'Portuguese', pattern: 'pt.*,pt' },
    });
    const language = languages[String(body.language || 'en').toLowerCase()];
    if (!language) return json(res, 400, { error: 'Choose a supported caption language.' });

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streamcut-captions-'));
    try {
      const output = path.join(tempDir, '%(id)s.%(ext)s');
      await runYtDlp(
        [
          '--skip-download',
          '--no-playlist',
          '--no-warnings',
          '--write-subs',
          '--write-auto-subs',
          '--sub-langs',
          language.pattern,
          '--sub-format',
          'vtt/best',
          '--convert-subs',
          'vtt',
          '--output',
          output,
          target.toString(),
        ],
        { timeoutMs: 120000 },
      );

      const tracks = fs.readdirSync(tempDir).filter((name) => name.toLowerCase().endsWith('.vtt'));
      if (!tracks.length) {
        return json(res, 422, { error: `No ${language.label} subtitle track is available for this VOD.` });
      }
      const preferred = tracks.find((name) => name.toLowerCase().includes(`.${String(body.language || 'en').toLowerCase()}.`));
      const file = path.join(tempDir, preferred || tracks[0]);
      const size = fs.statSync(file).size;
      if (size > 8 * 1024 * 1024) return json(res, 413, { error: 'The subtitle track is too large to import.' });
      const trackLanguage = path.basename(file).match(/\.([a-z]{2,3}(?:-[a-z0-9]+)?)\.vtt$/i)?.[1];
      return json(res, 200, { vtt: fs.readFileSync(file, 'utf8'), language: trackLanguage || String(body.language || 'en') });
    } catch (error) {
      const reason = String((error && error.message) || '');
      const message = /\b429\b|too many requests|rate limit/i.test(reason)
        ? 'The video host is temporarily rate-limiting subtitle downloads. Try again later, or import an SRT/VTT file.'
        : `Could not read captions from this VOD. ${reason}`.trim();
      return json(res, 422, { error: message });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  if (route === '/api/link/download' && req.method === 'POST') {
    if (!tools.ytdlp) return json(res, 503, { error: MISSING_YTDLP });
    if (!tools.ffmpeg) return json(res, 503, { error: MISSING_FFMPEG });

    const body = await readBody(req);
    const target = parseTarget(body.url);
    const start = Math.max(0, Math.min(86400, Number(body.start) || 0));
    const length = Math.max(5, Math.min(600, Number(body.length) || 60));
    const job = startSliceJob(target.toString(), start, length, String(body.title || ''));
    return json(res, 200, { id: job.id });
  }

  if (route === '/api/link/job' && req.method === 'GET') {
    const job = jobs.get(url.searchParams.get('id') || '');
    if (!job) return json(res, 404, { error: 'Unknown job.' });
    return json(res, 200, publicJob(job));
  }

  if (route === '/api/channels' && req.method === 'GET') {
    return json(res, 200, { channels: readChannels() });
  }

  if (route === '/api/channels' && req.method === 'POST') {
    if (!tools.ytdlp) return json(res, 503, { error: MISSING_YTDLP });

    const body = await readBody(req);
    const platform = String(body.platform || '').toLowerCase();
    if (!CONNECT_PLATFORMS.includes(platform)) throw new Error('Choose Twitch, YouTube or Kick.');

    const resolved = await resolveChannel(platform, body.input);
    const channels = readChannels();
    const existing = channels.find(
      (channel) =>
        channel.platform === resolved.platform && channel.handle.toLowerCase() === resolved.handle.toLowerCase(),
    );
    const record = { id: existing?.id || randomUUID(), ...resolved, addedAt: existing?.addedAt || Date.now() };
    writeChannels(
      existing ? channels.map((channel) => (channel.id === record.id ? record : channel)) : [...channels, record],
    );
    return json(res, 200, record);
  }

  const vodMatch = /^\/api\/channels\/([^/]+)\/vods$/.exec(route);
  if (vodMatch && req.method === 'GET') {
    if (!tools.ytdlp) return json(res, 503, { error: MISSING_YTDLP });
    const channel = readChannels().find((entry) => entry.id === decodeURIComponent(vodMatch[1]));
    if (!channel) return json(res, 404, { error: 'Unknown channel.' });
    return json(res, 200, { vods: await listChannelVods(channel) });
  }

  if (route.startsWith('/api/channels/') && req.method === 'DELETE') {
    const id = decodeURIComponent(route.slice('/api/channels/'.length));
    const channels = readChannels();
    const next = channels.filter((channel) => channel.id !== id);
    if (next.length === channels.length) return json(res, 404, { error: 'Unknown channel.' });
    writeChannels(next);
    return json(res, 200, { ok: true });
  }

  if (route === '/api/uploads' && req.method === 'POST') {
    const original = String(req.headers['x-file-name'] || '').trim();
    if (!original) throw new Error('Missing file name — send it in the x-file-name header.');
    const ext = path.extname(original).toLowerCase();
    if (!['.mp4', '.webm', '.mov', '.m4v', '.mkv'].includes(ext)) {
      throw new Error('Upload an MP4, WebM, MOV, M4V or MKV file.');
    }
    const name = `${randomUUID()}${ext}`;
    const file = path.join(UPLOAD_DIR, name);
    try {
      await pipeline(req, fs.createWriteStream(file));
    } catch {
      fs.rm(file, { force: true }, () => {});
      throw new Error('The upload was interrupted.');
    }
    const size = fs.statSync(file).size;
    if (!size) {
      fs.rm(file, { force: true }, () => {});
      throw new Error('That upload was empty.');
    }
    return json(res, 200, { url: `/api/uploads/${name}`, name: original, size });
  }

  if (route.startsWith('/api/uploads/') && (req.method === 'GET' || req.method === 'HEAD')) {
    return serveUpload(req, res, route.slice('/api/uploads/'.length));
  }

  if (route === '/api/link/cancel' && req.method === 'POST') {
    const body = await readBody(req);
    const job = jobs.get(String(body.id || ''));
    if (!job) return json(res, 404, { error: 'Unknown job.' });
    if (job.status === 'running') {
      job.status = 'error';
      job.error = 'Cancelled.';
      job.finishedAt = Date.now();
      try {
        job.child?.kill();
      } catch {
        /* already gone */
      }
    }
    return json(res, 200, publicJob(job));
  }

  if (route === '/api/ai/status' && req.method === 'GET') {
    const store = readStore();
    return json(res, 200, await aiStatus({ fresh: url.searchParams.get('fresh') === '1', settings: store.settings }));
  }

  if (route === '/api/ai/job' && req.method === 'POST') {
    if (!tools.ffmpeg) return json(res, 503, { error: MISSING_FFMPEG });
    const store = readStore();
    const status = await aiStatus({ fresh: true, settings: store.settings });
    if (!status.ready) {
      return json(res, 503, {
        error: status.stt.detail || status.llm.detail || 'The AI engine is not ready yet.',
        status,
      });
    }

    const body = await readBody(req);
    const mediaPath = resolveMediaPath(body.mediaUrl);
    let duration = Number(body.duration) || 0;
    if (!duration) {
      const meta = await probe(mediaPath);
      duration = meta.duration;
    }
    if (!duration) return json(res, 400, { error: 'Could not read the media duration.' });
    if (duration > MAX_ANALYSIS_SECONDS) {
      return json(res, 400, {
        error: `AI analysis covers up to ${Math.round(MAX_ANALYSIS_SECONDS / 60)} minutes at a time. Trim the source or analyze a shorter segment.`,
      });
    }

    const job = startAiJob({
      mediaPath,
      duration,
      count: body.count,
      minLength: body.minLength,
      maxLength: body.maxLength,
      focus: body.focus,
      language: body.language,
      chatContext: Array.isArray(body.chatContext) ? body.chatContext : [],
      tools: { ffmpeg: tools.ffmpeg.command },
      engineType: (body.engineType || store.settings?.aiEngine) === 'gemini' && status.gemini?.ready ? 'gemini' : 'ollama',
      settings: store.settings,
    });
    return json(res, 200, job);
  }

  if (route === '/api/ai/jobs' && req.method === 'GET') {
    return json(res, 200, listAiJobs());
  }

  if (route === '/api/ai/job' && req.method === 'GET') {
    const job = getAiJob(url.searchParams.get('id'));
    if (!job) return json(res, 404, { error: 'Unknown AI job.' });
    return json(res, 200, job);
  }

  if (route === '/api/ai/cancel' && req.method === 'POST') {
    const body = await readBody(req);
    const job = cancelAiJob(body.id);
    if (!job) return json(res, 404, { error: 'Unknown AI job.' });
    return json(res, 200, job);
  }

  if (route === '/api/transcription/job' && req.method === 'POST') {
    if (!tools.ffmpeg) return json(res, 503, { error: MISSING_FFMPEG });
    const status = await aiStatus({ fresh: true });
    if (!status.stt.ready) return json(res, 503, { error: status.stt.detail || 'The local Whisper speech-to-text engine is not ready.' });
    const body = await readBody(req);
    const mediaPath = resolveMediaPath(body.mediaUrl);
    let duration = Number(body.duration) || 0;
    if (!duration) duration = (await probe(mediaPath)).duration;
    if (!duration) return json(res, 400, { error: 'Could not read the media duration.' });
    if (duration > MAX_ANALYSIS_SECONDS) return json(res, 400, { error: `Automatic captions support videos up to ${Math.round(MAX_ANALYSIS_SECONDS / 60)} minutes. Trim this video or caption a shorter version.` });
    return json(res, 200, startTranscriptionJob({
      mediaPath,
      duration,
      language: body.language,
      tools: { ffmpeg: tools.ffmpeg.command },
    }));
  }

  if (route === '/api/transcription/job' && req.method === 'GET') {
    const job = getTranscriptionJob(url.searchParams.get('id'));
    if (!job) return json(res, 404, { error: 'Unknown transcription job.' });
    return json(res, 200, job);
  }

  if (route === '/api/transcription/cancel' && req.method === 'POST') {
    const body = await readBody(req);
    const job = cancelTranscriptionJob(body.id);
    if (!job) return json(res, 404, { error: 'Unknown transcription job.' });
    return json(res, 200, job);
  }

  if (route === '/api/gemini/status' && req.method === 'GET') {
    const store = readStore();
    return json(res, 200, geminiStatus(store.settings));
  }

  if (route === '/api/ollama/hardware' && req.method === 'GET') {
    const info = await getOllamaHardwareInfo();
    return json(res, 200, info);
  }

  if (route === '/api/ollama/pull' && req.method === 'POST') {
    const body = await readBody(req);
    const model = body.model || 'qwen3:8b';
    const status = await startOllamaPull(model);
    return json(res, 200, status);
  }

  if (route === '/api/ollama/pull' && req.method === 'GET') {
    return json(res, 200, getOllamaPullStatus() || { status: 'idle' });
  }

  if (route === '/api/gemini/package' && req.method === 'POST') {
    const body = await readBody(req);
    const store = readStore();
    try {
      const viral = await generateViralPackage({
        clipTitle: body.clipTitle || 'Untitled Clip',
        excerpt: body.excerpt || '',
        cues: Array.isArray(body.cues) ? body.cues : [],
        duration: Number(body.duration) || 30,
        platform: String(body.platform || 'shorts'),
        tone: String(body.tone || 'high-energy'),
        settings: store.settings,
      });
      return json(res, 200, viral);
    } catch (err) {
      return json(res, 400, { error: err.message || 'Failed to generate viral package with Gemini.' });
    }
  }

  if (route === '/api/projects') {
    if (req.method === 'GET') {
      const projects = readStore().projects.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
      return json(res, 200, { projects });
    }
    if (req.method === 'POST') {
      const store = readStore();
      const project = makeProject(await readBody(req));
      store.projects.push(project);
      writeStore(store);
      return json(res, 200, project);
    }
  }

  if (route.startsWith('/api/projects/')) {
    const id = decodeURIComponent(route.slice('/api/projects/'.length));
    const store = readStore();
    const index = store.projects.findIndex((project) => project.id === id);
    if (index === -1) return json(res, 404, { error: 'Unknown project.' });
    if (req.method === 'GET') return json(res, 200, store.projects[index]);

    if (req.method === 'DELETE') {
      store.projects.splice(index, 1);
      store.schedules = store.schedules.filter((schedule) => schedule.projectId !== id);
      writeStore(store);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const next = { ...store.projects[index], updatedAt: Date.now() };
      for (const key of ['name', 'source', 'clips', 'cues', 'aspect', 'status']) {
        if (body[key] !== undefined) next[key] = body[key];
      }
      if (body.style && typeof body.style === 'object') next.style = body.style;
      if (!ASPECTS.includes(next.aspect)) next.aspect = '9:16';
      next.name = String(next.name || 'Untitled project').slice(0, 140);
      next.status = String(next.status || 'draft');
      store.projects[index] = next;
      writeStore(store);
      return json(res, 200, next);
    }
  }

  if (route === '/api/schedules') {
    if (req.method === 'GET') {
      const schedules = readStore().schedules.sort((a, b) => String(a.when).localeCompare(String(b.when)));
      return json(res, 200, { schedules });
    }
    if (req.method === 'POST') {
      const store = readStore();
      const schedule = makeSchedule(await readBody(req));
      store.schedules.push(schedule);
      writeStore(store);
      return json(res, 200, schedule);
    }
  }

  if (route.startsWith('/api/schedules/')) {
    const id = decodeURIComponent(route.slice('/api/schedules/'.length));
    const store = readStore();
    const index = store.schedules.findIndex((schedule) => schedule.id === id);
    if (index === -1) return json(res, 404, { error: 'Unknown scheduled post.' });
    if (req.method === 'DELETE') {
      store.schedules.splice(index, 1);
      writeStore(store);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const next = { ...store.schedules[index], updatedAt: Date.now() };
      for (const key of ['title', 'caption', 'hashtags', 'when', 'timezone', 'destinations', 'status', 'note', 'projectId', 'clipId']) {
        if (body[key] !== undefined) next[key] = body[key];
      }
      if (!['draft', 'scheduled', 'published', 'failed'].includes(next.status)) next.status = 'draft';
      store.schedules[index] = next;
      writeStore(store);
      return json(res, 200, next);
    }
  }

  if (route === '/api/templates') {
    if (req.method === 'GET') return json(res, 200, { templates: readStore().templates });
    if (req.method === 'POST') {
      const body = await readBody(req);
      const store = readStore();
      const template = {
        id: randomUUID(),
        name: String(body.name || 'Untitled template').slice(0, 80),
        style: body.style && typeof body.style === 'object' ? body.style : null,
        createdAt: Date.now(),
      };
      store.templates.push(template);
      writeStore(store);
      return json(res, 200, template);
    }
  }

  if (route.startsWith('/api/templates/') && req.method === 'DELETE') {
    const id = decodeURIComponent(route.slice('/api/templates/'.length));
    const store = readStore();
    const next = store.templates.filter((template) => template.id !== id);
    if (next.length === store.templates.length) return json(res, 404, { error: 'Unknown template.' });
    store.templates = next;
    writeStore(store);
    return json(res, 200, { ok: true });
  }

  if (route === '/api/settings') {
    if (req.method === 'GET') return json(res, 200, readStore().settings);
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const store = readStore();
      const settings = { ...store.settings };
      if (body.workspaceName !== undefined) settings.workspaceName = String(body.workspaceName).slice(0, 80);
      if (ASPECTS.includes(body.defaultAspect)) settings.defaultAspect = body.defaultAspect;
      if (Number.isFinite(Number(body.defaultClipLength))) {
        settings.defaultClipLength = Math.min(600, Math.max(5, Math.round(Number(body.defaultClipLength))));
      }
      if (body.timezone !== undefined) settings.timezone = String(body.timezone).slice(0, 60);
      if (body.geminiApiKey !== undefined) settings.geminiApiKey = String(body.geminiApiKey).trim();
      if (body.geminiModel !== undefined) settings.geminiModel = String(body.geminiModel).trim();
      if (body.aiEngine !== undefined) settings.aiEngine = String(body.aiEngine).trim();
      store.settings = settings;
      writeStore(store);
      return json(res, 200, settings);
    }
  }

  return json(res, 404, { error: 'Unknown endpoint.' });
}

/* ---------------- server ---------------- */

pruneCache();
const housekeeping = setInterval(() => {
  const removed = pruneCache();
  pruneAiJobs();
  if (removed) console.log(`[cache] removed ${removed} expired slice(s)`);
}, 15 * 60 * 1000);
housekeeping.unref();

// ---- production static serving ----
// Every non-/api request used to go through a Vite server in middleware mode,
// including inside containers. So a Docker image that ran `npm run build` and
// shipped dist/ still served un-bundled source to browsers, plus a live
// /@vite/client HMR websocket. Gated on NODE_ENV so `npm run dev` keeps hot
// reload; only production builds switch to the static bundle.
const DIST = path.join(ROOT, 'dist');
const SERVE_DIST = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(DIST, 'index.html'));

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveStatic(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const rel = decoded.replace(/^\/+/, '');
  const file = path.resolve(DIST, rel || 'index.html');
  // Confine reads to dist/ — reject ../ traversal and absolute escapes.
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return null;
  try {
    const stat = fs.statSync(file);
    if (stat.isDirectory()) return resolveStatic(path.join(rel, 'index.html'));
    return stat.isFile() ? file : null;
  } catch {
    return null;
  }
}

function serveStatic(req, res, file) {
  const type = STATIC_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const stat = fs.statSync(file);
  const immutable = file.startsWith(path.join(DIST, 'assets') + path.sep);
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    // Vite hashes filenames under assets/, so those are safe forever; index.html
    // has to revalidate or a redeploy goes unnoticed.
    'Cache-Control': immutable
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=0, must-revalidate',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer();

server.on('request', async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, url);
    } catch (error) {
      if (!res.headersSent) json(res, 500, { error: error.message || 'Server error.' });
      else res.end();
    }
    return;
  }

  if (SERVE_DIST) {
    const file = resolveStatic(url.pathname);
    if (file) return serveStatic(req, res, file);
    // Hash router: unknown paths still boot the SPA rather than 404.
    const index = path.join(DIST, 'index.html');
    if (fs.existsSync(index)) return serveStatic(req, res, index);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }

  vite.middlewares(req, res, () => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process, or run: PORT=5174 npm run dev`);
    process.exit(1);
  }
  console.error('[server] error', error);
  process.exit(1);
});

const vite = SERVE_DIST ? null : await createViteServer({
  root: ROOT,
  appType: 'spa',
  configLoader: 'runner',
  server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
});

server.listen(PORT, LAN ? '0.0.0.0' : '127.0.0.1', () => {
  const ytdlp = tools.ytdlp ? `yt-dlp ${tools.ytdlp.version} (${tools.ytdlp.source})` : 'yt-dlp MISSING';
  const ffmpeg = tools.ffmpeg ? `ffmpeg ${tools.ffmpeg.source}` : 'ffmpeg MISSING';
  const ffprobe = tools.ffprobe ? `ffprobe ${tools.ffprobe.source}` : 'ffprobe MISSING';
  console.log(`StreamCut running at http://127.0.0.1:${PORT}`);
  if (LAN) {
    const addresses = Object.values(os.networkInterfaces())
      .flatMap((entries) => entries || [])
      .filter((entry) => entry.family === 'IPv4' && !entry.internal)
      .map((entry) => entry.address);
    for (const address of addresses) console.log(`On your phone (same Wi-Fi): http://${address}:${PORT}`);
  } else {
    console.log(`Phone access: run "npm run dev:lan", then open the Wi-Fi URL it prints.`);
  }
  console.log(`Link import: ${ytdlp} · ${ffmpeg} · ${ffprobe}`);
  if (process.env.NODE_ENV === 'production' && !SERVE_DIST) {
    console.log('  WARNING: NODE_ENV=production but dist/index.html is missing.');
    console.log('  Falling back to the Vite dev server. Run `npm run build` first.');
  } else if (SERVE_DIST) {
    console.log('  Serving the production bundle from dist/.');
  }
  if (!tools.ytdlp) console.log(`  ${MISSING_YTDLP}`);
  if (!tools.ffmpeg) console.log(`  ${MISSING_FFMPEG}`);
});

process.on('unhandledRejection', (error) => {
  console.error('[server] unhandled rejection', error);
});
