import { useEffect, useState } from 'react';
import type { Aspect, Clip, Cue, MediaInfo, Style, ViralPackage } from '../types';
import { bytes, fmtTenths, safeFileName } from '../lib/format';
import { api, aspectDimensions } from '../lib/store';
import { exportClip, pickMime, supportsMp4, type ExportFormat } from '../lib/exporter';

type Props = {
  clip: Clip;
  style: Style;
  cues: Cue[];
  media: MediaInfo;
  aspect: Aspect;
  videoRef: React.RefObject<HTMLVideoElement>;
  exportCanvasRef: React.RefObject<HTMLCanvasElement>;
  ensureAudio: () => Promise<MediaStream | null>;
  notify: (message: string) => void;
  onRendering: (rendering: boolean) => void;
};

type Result = { url: string; name: string; size: number; ext: string };

export default function ExportPanel({
  clip,
  style,
  cues,
  media,
  aspect,
  videoRef,
  exportCanvasRef,
  ensureAudio,
  notify,
  onRendering,
}: Props) {
  const mp4 = supportsMp4();
  const [width, setWidth] = useState(1080);
  const [fps, setFps] = useState<30 | 60>(60);
  const [format, setFormat] = useState<ExportFormat>(mp4 ? 'mp4' : 'webm');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [caption, setCaption] = useState('');
  const [copied, setCopied] = useState(false);
  const [viralPkg, setViralPkg] = useState<ViralPackage | null>(null);
  const [viralLoading, setViralLoading] = useState(false);
  const [viralError, setViralError] = useState<string | null>(null);

  useEffect(() => {
    setCaption(`${clip.title}\n\n#shorts #reels #stream #clips`);
    setResult(null);
    setError(null);
    setProgress(0);
    setViralPkg(null);
    setViralError(null);
  }, [clip.id, clip.title]);

  const generateViral = async () => {
    setViralLoading(true);
    setViralError(null);
    try {
      const clipCues = cues.filter((c) => c.start >= clip.start - 0.5 && c.end <= clip.end + 0.5);
      const pkg = await api.generateViralPackage({
        clipTitle: clip.title,
        duration: clip.end - clip.start,
        cues: clipCues,
        platform: 'shorts',
      });
      setViralPkg(pkg);
      if (pkg.caption) {
        const topTitle = pkg.titles[0] || clip.title;
        setCaption(`${topTitle}\n\n${pkg.caption}\n\n${pkg.hashtags.join(' ')}`);
      }
      notify(`Gemini generated viral package! (Score: ${pkg.viralityScore}/100)`);
    } catch (err) {
      const msg = (err as Error).message;
      setViralError(msg);
      notify(msg);
    } finally {
      setViralLoading(false);
    }
  };

  useEffect(() => {
    if (!result) return;
    return () => URL.revokeObjectURL(result.url);
  }, [result]);

  const dims = aspectDimensions(aspect, width);
  const height = dims.height;
  const label = (quality: number) => {
    const value = aspectDimensions(aspect, quality);
    return `${value.width} × ${value.height}`;
  };
  const length = clip.end - clip.start;

  const run = async () => {
    const video = videoRef.current;
    const canvas = exportCanvasRef.current;
    if (!video || !canvas) return;

    setBusy(true);
    onRendering(true);
    setError(null);
    setProgress(0);

    try {
      const audio = await ensureAudio();
      if (document.fonts?.ready) await document.fonts.ready;

      const { blob, ext } = await exportClip({
        video,
        canvas,
        clip,
        style,
        cues,
        width,
        height,
        format,
        fps,
        audioStream: audio,
        onProgress: setProgress,
      });

      const name = `${safeFileName(clip.title)}.${ext}`;
      const url = URL.createObjectURL(blob);
      const next: Result = { url, name, size: blob.size, ext };
      setResult(next);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();

      notify(`Rendered ${name} — saved to your downloads.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      onRendering(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      notify('Clipboard is blocked — select the text and copy it manually.');
    }
  };

  return (
    <div className="panel">
      <div className="field">
        <label>Export resolution</label>
        <div className="seg" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          <button className={width === 2160 ? 'on' : ''} onClick={() => setWidth(2160)}>
            4K Ultra
          </button>
          <button className={width === 1440 ? 'on' : ''} onClick={() => setWidth(1440)}>
            2K QHD
          </button>
          <button className={width === 1080 ? 'on' : ''} onClick={() => setWidth(1080)}>
            1080p FHD
          </button>
          <button className={width === 720 ? 'on' : ''} onClick={() => setWidth(720)}>
            720p HD
          </button>
        </div>
        <p className="hint" style={{ marginTop: 4 }}>
          Rendering dimensions: {dims.width} × {dims.height}
        </p>
      </div>

      <div className="field">
        <label>Frame rate</label>
        <div className="seg">
          <button className={fps === 60 ? 'on' : ''} onClick={() => setFps(60)}>
            60 FPS (Ultra Smooth)
          </button>
          <button className={fps === 30 ? 'on' : ''} onClick={() => setFps(30)}>
            30 FPS (Standard)
          </button>
        </div>
      </div>

      <div className="field">
        <label>Format</label>
        <div className="seg">
          <button className={format === 'mp4' ? 'on' : ''} onClick={() => setFormat('mp4')}>
            MP4
          </button>
          <button className={format === 'webm' ? 'on' : ''} onClick={() => setFormat('webm')}>
            WebM
          </button>
        </div>
        <p className="hint">
          {pickMime(format)
            ? `This browser will record ${pickMime(format)?.mime.split(';')[0]}.`
            : 'Recording is unavailable in this browser.'}{' '}
          {!mp4 && 'MP4 recording is not supported here, so exports fall back to WebM.'}
        </p>
      </div>

      <div className="export-summary">
        <div>
          <span>Clip</span>
          <b>{fmtTenths(length)}</b>
        </div>
        <div>
          <span>Output</span>
          <b>
            {width}×{height}
          </b>
        </div>
        <div>
          <span>Source</span>
          <b>{media.width}×{media.height}</b>
        </div>
      </div>

      <button className="btn btn-primary btn-block btn-lg" onClick={run} disabled={busy}>
        {busy ? `Rendering… ${Math.round(progress * 100)}%` : 'Render & download clip'}
      </button>

      {busy && (
        <div className="progress">
          <span style={{ width: `${Math.max(2, progress * 100)}%` }} />
        </div>
      )}
      <p className="hint">
        Rendering happens in real time ({Math.round(length)}s) because the browser records the canvas frame by frame.
        Keep this tab in the foreground and the audio will play while it records.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="result">
          <div className="result-main">
            <b>{result.name}</b>
            <span>
              {result.ext.toUpperCase()} · {bytes(result.size)}
            </span>
          </div>
          <a className="btn btn-sm" href={result.url} download={result.name}>
            Download
          </a>
        </div>
      )}

      <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: 12, padding: 14, margin: '14px 0', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.1rem' }}>✨</span>
            <b style={{ fontSize: '0.95rem' }}>Gemini AI Viral Packaging</b>
          </div>
          {viralPkg && (
            <span style={{
              background: 'rgba(250, 204, 21, 0.15)',
              color: '#fde047',
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: '0.8rem',
              fontWeight: 600,
            }}>
              🔥 {viralPkg.viralityScore}/100 Virality
            </span>
          )}
        </div>

        {!viralPkg && (
          <p className="hint" style={{ margin: '0 0 10px 0', fontSize: '0.85rem' }}>
            Generate high-CTR titles, opening 3-second hook overlays, and platform-tailored social copy with Gemini 4 Hydrogen.
          </p>
        )}

        {viralError && (
          <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: 8 }}>
            {viralError}
          </div>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => void generateViral()}
          disabled={viralLoading}
          style={{ marginBottom: viralPkg ? 12 : 0 }}
        >
          {viralLoading ? '✨ Analyzing clip with Gemini…' : viralPkg ? '🔄 Regenerate with Gemini' : '✨ Generate Viral Package (Gemini)'}
        </button>

        {viralPkg && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Viral Title Options (Click to use):
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {viralPkg.titles.map((title, idx) => (
                  <button
                    key={idx}
                    type="button"
                    style={{
                      textAlign: 'left',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      color: '#f1f5f9',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setCaption(`${title}\n\n${viralPkg.caption}\n\n${viralPkg.hashtags.join(' ')}`);
                      notify(`Selected title: "${title}"`);
                    }}
                  >
                    🎯 {title}
                  </button>
                ))}
              </div>
            </div>

            {viralPkg.hook && (
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600, display: 'block' }}>
                  FIRST 3-SECOND HOOK OVERLAY:
                </span>
                <span style={{ fontSize: '0.88rem', color: '#e0e7ff', fontWeight: 500 }}>
                  "{viralPkg.hook}"
                </span>
              </div>
            )}

            {viralPkg.retentionTip && (
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', background: 'rgba(255, 255, 255, 0.03)', padding: 8, borderRadius: 6 }}>
                💡 <b>Retention Tip:</b> {viralPkg.retentionTip}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="field">
        <div className="section-head">
          <label>Post caption</label>
          <button className="link" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        <textarea className="input textarea" rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} />
        <p className="hint">
          Instagram Reels: 9:16, up to 90s. YouTube Shorts: 9:16, up to 3 min. Upload the file from your downloads,
          then paste this caption.
        </p>
      </div>
    </div>
  );
}
