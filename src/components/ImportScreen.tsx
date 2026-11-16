import { useEffect, useRef, useState } from 'react';
import { fmt, parseClock } from '../lib/format';
import { readJson } from '../lib/api';
import type { ChannelVod } from '../types';
import platformData from '../../shared/platforms.json';

type LinkInfo = {
  title: string;
  duration: number;
  uploader: string;
  thumbnail: string;
  extractor: string;
};

type Props = {
  loading: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onUrl: (url: string, name?: string, meta?: { platform?: string; segmentStart?: number; captionSource?: string }) => void;
  onOpenConnections: () => void;
  pendingVod: ChannelVod | null;
  initialUrl?: string;
  compact?: boolean;
};

const PLATFORM_HOSTS: string[] = platformData.hosts;

function isPlatformLink(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return PLATFORM_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ImportScreen({
  loading,
  error,
  onFile,
  onUrl,
  onOpenConnections,
  pendingVod,
  initialUrl,
  compact,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<'idle' | 'info' | 'ready' | 'downloading' | 'error'>('idle');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [start, setStart] = useState('0:00');
  const [length, setLength] = useState(60);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);

  // Abandon any in-flight poll when the screen closes or another video is chosen.
  useEffect(() => {
    return () => {
      runRef.current += 1;
    };
  }, []);

  // A VOD picked in the Connections dialog pre-fills the slice form.
  useEffect(() => {
    if (!pendingVod) return;
    setUrl(pendingVod.url);
    setInfo({
      title: pendingVod.title,
      duration: pendingVod.duration,
      uploader: pendingVod.uploader ?? '',
      thumbnail: pendingVod.thumbnail,
      extractor: pendingVod.platform,
    });
    setPhase('ready');
    setLinkError(null);
    setStatus('');
    setStart('0:00');
    const suggested = Math.min(120, Math.max(30, Math.round(pendingVod.duration || 60)));
    setLength([30, 60, 120].find((option) => option >= suggested) ?? 120);
  }, [pendingVod]);

  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      runRef.current += 1;
      onFile(file);
    }
  };

  const fetchInfo = async (value: string) => {
    setPhase('info');
    setLinkError(null);
    setInfo(null);
    setStatus('');
    try {
      const response = await fetch('/api/link/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value }),
      });
      const data = await readJson<LinkInfo>(response);
      setInfo(data);
      setStart('0:00');
      const suggested = Math.min(120, Math.max(30, Math.round(data.duration || 60)));
      setLength([30, 60, 120].find((option) => option >= suggested) ?? 120);
      setPhase('ready');
    } catch (err) {
      setPhase('error');
      setLinkError((err as Error).message);
    }
  };

  // Deep links from Home / AI Clips preload the URL and resolve platform links.
  useEffect(() => {
    if (!initialUrl) return;
    setUrl(initialUrl);
    if (isPlatformLink(initialUrl)) void fetchInfo(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  const submitUrl = () => {
    const value = url.trim();
    if (!value) return;
    if (isPlatformLink(value)) void fetchInfo(value);
    else onUrl(value);
  };

  const download = async () => {
    if (!info) return;
    const startSeconds = parseClock(start);
    if (Number.isNaN(startSeconds)) {
      setPhase('error');
      setLinkError('Start time must look like 90, 12:30 or 1:12:30.');
      return;
    }
    if (info.duration > 0 && startSeconds >= info.duration) {
      setPhase('error');
      setLinkError('That start time is past the end of this video.');
      return;
    }

    const run = ++runRef.current;
    setPhase('downloading');
    setLinkError(null);
    setProgress(0);
    setStatus('Asking yt-dlp for the slice…');

    try {
      const response = await fetch('/api/link/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), start: startSeconds, length, title: info.title }),
      });
      const { id } = await readJson<{ id: string }>(response);
      const sourcePlatform = (() => {
        try {
          const host = new URL(url).hostname.toLowerCase();
          if (host.includes('twitch')) return 'twitch';
          if (host.includes('kick')) return 'kick';
          if (host.includes('youtu')) return 'youtube';
        } catch {
          return undefined;
        }
        return undefined;
      })();
      const startedAt = Date.now();

      for (let attempt = 0; attempt < 1050; attempt++) {
        await sleep(1200);
        if (runRef.current !== run) return;
        const poll = await fetch(`/api/link/job?id=${encodeURIComponent(id)}`);
        const job = await readJson<{
          status: string;
          error?: string;
          mediaUrl?: string;
          fileName?: string;
          percent?: number;
        }>(poll);
        if (job.status === 'error') throw new Error(job.error || 'The download failed.');
        if (job.status === 'done' && job.mediaUrl) {
          setProgress(100);
          setStatus('Downloaded.');
          setPhase('ready');
          onUrl(job.mediaUrl, job.fileName || `${info.title}.mp4`, {
            platform: sourcePlatform,
            segmentStart: startSeconds,
            captionSource: url.trim(),
          });
          return;
        }
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        setProgress(job.percent ?? 0);
        setStatus(
          job.percent
            ? `Downloading slice… ${job.percent}%`
            : `Downloading slice… ${elapsed}s (progress is only reported for the whole file)`,
        );
      }
      throw new Error('The download took too long and was abandoned.');
    } catch (err) {
      if (runRef.current !== run) return;
      setPhase('error');
      setLinkError((err as Error).message);
    }
  };

  const busy = phase === 'downloading' || loading;

  return (
    <div className={compact ? 'page import-compact' : 'import'}>
      {!compact && <div className="import-glow" aria-hidden />}
      <div className={compact ? 'import-inner compact' : 'import-inner'}>
        {!compact && (
          <>
            <div className="brand brand-lg">
              <span className="brand-mark" aria-hidden>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                </svg>
              </span>
              <span className="brand-name">StreamCut</span>
              <span className="pill">clip studio</span>
            </div>

            <div className="hero">
              <h1>
                Turn your streams into
                <br />
                <span className="grad">Shorts &amp; Reels</span>
              </h1>
              <p className="lede">
                Drop in a stream, VOD or any video. StreamCut scans the audio for hype moments, reframes them to 9:16
                with a crop that follows the action, adds captions and renders a ready-to-post clip.
              </p>
            </div>
          </>
        )}

        <div
          className={`dropzone${dragging ? ' is-drag' : ''}${loading ? ' is-loading' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                runRef.current += 1;
                onFile(file);
              }
              e.target.value = '';
            }}
          />
          <div className="dz-icon" aria-hidden>
            {loading ? (
              <span className="spinner" />
            ) : (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div className="dz-title">{loading ? 'Reading video…' : 'Drop a video here, or click to browse'}</div>
          <div className="dz-sub">MP4, WebM, MOV — processed on your device, never uploaded</div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="channel-strip">
          <div>
            <b>Your channels</b>
            <span>Connect Twitch, YouTube or Kick to pull your recent streams.</span>
          </div>
          <button className="btn btn-sm" onClick={onOpenConnections}>
            Connections
          </button>
        </div>

        <div className="url-row">
          <input
            className="input"
            placeholder="Paste a Twitch / YouTube / Kick link, or a direct .mp4 URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitUrl();
            }}
            disabled={phase === 'downloading'}
          />
          <button className="btn" onClick={submitUrl} disabled={!url.trim() || busy}>
            {isPlatformLink(url) ? 'Fetch link' : 'Load URL'}
          </button>
        </div>

        {phase !== 'idle' && (
          <div className="link-card">
            {info ? (
              <>
                <div className="link-head">
                  {info.thumbnail && (
                    <img
                      className="link-thumb"
                      src={info.thumbnail}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="link-meta">
                    <b>{info.title}</b>
                    <span>
                      {info.uploader ? `${info.uploader} · ` : ''}
                      {fmt(info.duration)}
                      {info.extractor ? ` · ${info.extractor.replace(/_/g, ' ')}` : ''}
                    </span>
                  </div>
                </div>

                <div className="link-grid">
                  <label className="stack">
                    <span>Start in the video</span>
                    <input
                      className="input"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      placeholder="1:12:30"
                      disabled={phase === 'downloading'}
                    />
                  </label>
                  <label className="stack">
                    <span>Slice length</span>
                    <select
                      className="input"
                      value={length}
                      onChange={(e) => setLength(Number(e.target.value))}
                      disabled={phase === 'downloading'}
                    >
                      {[30, 60, 120, 300, 600].map((seconds) => (
                        <option key={seconds} value={seconds}>
                          {seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minutes`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {phase === 'downloading' && (
                  <div className={`progress${progress > 0 ? '' : ' indeterminate'}`}>
                    <span style={{ width: `${Math.max(3, progress)}%` }} />
                  </div>
                )}
                {status && <p className="hint">{status}</p>}

                <div className="row">
                  <button className="btn btn-primary flex1" onClick={() => void download()} disabled={phase === 'downloading'}>
                    {phase === 'downloading' ? 'Downloading…' : 'Download this slice & edit'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setPhase('idle');
                      setInfo(null);
                      setLinkError(null);
                      setStatus('');
                    }}
                    disabled={phase === 'downloading'}
                  >
                    Cancel
                  </button>
                </div>

                <p className="hint">
                  Only this slice is downloaded (via yt-dlp + ffmpeg) — a 35-hour VOD is never pulled in full. Start time
                  accepts <code>90</code>, <code>12:30</code> or <code>1:12:30</code>.
                </p>
              </>
            ) : (
              <div className="link-loading">
                {phase === 'info' ? (
                  <>
                    <span className="spinner sm" /> Reading the link with yt-dlp…
                  </>
                ) : (
                  <span>{linkError || 'That link could not be read.'}</span>
                )}
              </div>
            )}
            {linkError && info && <div className="error-banner">{linkError}</div>}
          </div>
        )}

        <p className="footnote">
          Twitch, YouTube and Kick links are resolved on this machine by the local server, then only the slice you pick
          is downloaded at up to 1080p. Direct <code>.mp4</code>/<code>.webm</code> URLs load straight into the editor,
          and files you drop in are processed entirely on-device.
        </p>

        {!compact && (
          <div className="features">
          <div className="feature">
            <div className="feature-icon">⚡</div>
            <div>
              <b>AI moment finder</b>
              <p>Whisper transcribes the speech, then Qwen3 picks complete moments with a hook and payoff.</p>
            </div>
          </div>
          <div className="feature">
            <div className="feature-icon">🎯</div>
            <div>
              <b>Auto reframe</b>
              <p>Samples frames to keep the action inside the 9:16 crop instead of black bars.</p>
            </div>
          </div>
          <div className="feature">
            <div className="feature-icon">💬</div>
            <div>
              <b>Caption studio</b>
              <p>Import SRT/VTT, or type a script and time it across the clip automatically.</p>
            </div>
          </div>
            <div className="feature">
              <div className="feature-icon">📱</div>
              <div>
                <b>One-click 9:16 export</b>
                <p>Renders 1080×1920 MP4/WebM with your background, captions and progress bar.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
