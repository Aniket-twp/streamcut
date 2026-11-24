import { useEffect, useRef, useState } from 'react';
import { computeEnergy, findHighlights } from '../lib/analyze';
import { fmt, fmtTenths, parseClock, uid } from '../lib/format';
import { probeVideo } from '../lib/media';
import { readJson } from '../lib/api';
import { api, uploadVideo } from '../lib/store';
import {
  DEFAULT_STYLE,
  type AiJob,
  type AiStatus,
  type Aspect,
  type Clip,
  type Cue,
  type ProjectSource,
  type Suggestion,
  type TranscriptSegment,
  type WorkspaceSettings,
} from '../types';
import { StatusPill } from './ui';

type Props = {
  initialUrl?: string;
  initialPlatform?: 'twitch' | 'youtube' | 'kick';
  settings: WorkspaceSettings | null;
  onOpenProject: (id: string) => void;
  notify: (message: string) => void;
};

type Info = { title: string; duration: number; uploader: string; thumbnail: string; extractor: string };
type ChatMessage = { time: number; user?: string; message: string };

const PLATFORMS = [
  { id: 'twitch', label: 'Twitch', host: 'twitch.tv' },
  { id: 'youtube', label: 'YouTube', host: 'youtube.com' },
  { id: 'kick', label: 'Kick', host: 'kick.com' },
] as const;

const LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function hostMatches(value: string, domain: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

function chatTime(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value / 1000 : value;
  const raw = String(value ?? '').trim().replace(/^\[|\]$/g, '');
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  const clock = /\d+(?::\d+){1,2}(?:\.\d+)?/.exec(raw)?.[0];
  if (!clock) return Number.NaN;
  const parts = clock.split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function parseChatLog(raw: string): ChatMessage[] {
  const fromObject = (value: unknown): ChatMessage[] => {
    const rows = Array.isArray(value)
      ? value
      : value && typeof value === 'object'
        ? Object.values(value as Record<string, unknown>).find((entry) => Array.isArray(entry)) as unknown[] | undefined
        : undefined;
    if (!rows) return [];
    return rows.flatMap((row): ChatMessage[] => {
      if (!row || typeof row !== 'object') return [];
      const item = row as Record<string, unknown>;
      const nested = item.message && typeof item.message === 'object' ? item.message as Record<string, unknown> : {};
      const text = [nested.body, item.text, item.body, item.comment, typeof item.message === 'string' ? item.message : '']
        .find((candidate) => typeof candidate === 'string' && candidate.trim());
      const userValue = item.commenter && typeof item.commenter === 'object'
        ? (item.commenter as Record<string, unknown>).display_name
        : item.user ?? item.username ?? item.author;
      const time = chatTime(item.content_offset_seconds ?? item.offset ?? item.video_offset_time ?? item.time ?? item.timestamp);
      const message = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
      return Number.isFinite(time) && time >= 0 && message
        ? [{ time, user: String(userValue || '').slice(0, 32), message }]
        : [];
    });
  };

  try {
    const parsed = JSON.parse(raw) as unknown;
    const direct = fromObject(parsed);
    if (direct.length) return direct.sort((a, b) => a.time - b.time).slice(0, 5000);
    if (parsed && typeof parsed === 'object') {
      const root = parsed as Record<string, unknown>;
      for (const key of ['comments', 'messages', 'chat', 'data']) {
        const nested = fromObject(root[key]);
        if (nested.length) return nested.sort((a, b) => a.time - b.time).slice(0, 5000);
      }
    }
  } catch {
    // TwitchDownloader and JSON replay logs are preferred; accept simple timestamped CSV/TXT too.
  }

  return raw.split(/\r?\n/).flatMap((line): ChatMessage[] => {
    const clean = line.trim();
    if (!clean || /^(time|timestamp|offset|content_offset_seconds)\s*[,;]/i.test(clean)) return [];
    const match = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)(?:\])?\s*(?:[,;|\t]\s*|\s+)(.+)$/.exec(clean);
    if (!match) return [];
    const time = chatTime(match[1]);
    let message = match[2].replace(/^['"]|['"]$/g, '').trim();
    let user: string | undefined;
    const author = /^([^:,]{1,32})[:,]\s*(.*)$/.exec(message);
    if (author) { user = author[1].trim(); message = author[2].trim(); }
    return Number.isFinite(time) && message ? [{ time, user, message: message.slice(0, 180) }] : [];
  }).sort((a, b) => a.time - b.time).slice(0, 5000);
}

function viralityColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function viralityLabel(score: number): string {
  if (score >= 80) return 'Viral potential';
  if (score >= 60) return 'Strong clip';
  if (score >= 40) return 'Decent clip';
  return 'Might work';
}

/** Extract cues (caption segments) from transcript that overlap a given time range. */
function cuesForClip(segments: TranscriptSegment[], clipStart: number, clipEnd: number): Cue[] {
  return segments
    .filter((seg) => seg.end > clipStart && seg.start < clipEnd)
    .map((seg) => ({
      id: uid('cue'),
      start: Math.max(clipStart, seg.start),
      end: Math.min(clipEnd, seg.end),
      text: seg.text,
    }));
}

export default function AiClipsScreen({ initialUrl, initialPlatform, settings, onOpenProject, notify }: Props) {
  const [mode, setMode] = useState<'link' | 'file'>('link');
  const [platform, setPlatform] = useState<'twitch' | 'youtube' | 'kick'>(
    initialPlatform && PLATFORMS.some((entry) => entry.id === initialPlatform) ? initialPlatform : 'twitch',
  );
  const [url, setUrl] = useState(initialUrl ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [start, setStart] = useState('0:00');
  const [segmentLength, setSegmentLength] = useState(120);
  const [count, setCount] = useState(5);
  const [minLength, setMinLength] = useState(15);
  const [maxLength, setMaxLength] = useState(45);
  const [aspect, setAspect] = useState<Aspect>(settings?.defaultAspect ?? '9:16');
  const [focus, setFocus] = useState('');
  const [language, setLanguage] = useState('auto');
  const [sourceInfo, setSourceInfo] = useState<Info | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'working' | 'results' | 'error'>('setup');
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [media, setMedia] = useState<{
    url: string;
    name: string;
    duration: number;
    width: number;
    height: number;
    kind: 'url' | 'upload';
    segmentStart: number;
  } | null>(null);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [chatContext, setChatContext] = useState<ChatMessage[]>([]);
  const [chatFileName, setChatFileName] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Suggestion | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [aiEngine, setAiEngine] = useState<string | null>(null);
  const [aiDetail, setAiDetail] = useState('');
  const [resultEngine, setResultEngine] = useState('');

  const runRef = useRef(0);
  const cancelledRef = useRef(false);
  const jobRef = useRef<string | null>(null);
  const aiJobRef = useRef<string | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);

  const activePlatform = PLATFORMS.find((entry) => entry.id === platform)!;
  const busy = phase === 'working';

  // Check AI engine status on mount.
  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => readJson<AiStatus>(r))
      .then((s) => {
        setAiReady(s.ready);
        setAiEngine(s.engine);
        if (!s.ready) {
          setAiDetail(s.stt.detail || s.llm.detail || 'AI engine is not ready.');
        }
      })
      .catch(() => {
        setAiReady(false);
        setAiDetail('Could not reach the local server.');
      });
  }, []);

  useEffect(() => {
    if (initialPlatform && PLATFORMS.some((entry) => entry.id === initialPlatform)) setPlatform(initialPlatform);
    if (!initialUrl) return;
    setMode('link');
    setUrl(initialUrl);
    setInfoLoading(true);
    fetch('/api/link/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: initialUrl }),
    })
      .then((response) => readJson<Info>(response))
      .then((data) => {
        setSourceInfo(data);
        setProjectName((current) => current || data.title);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setInfoLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl, initialPlatform]);

  useEffect(() => {
    setAspect(settings?.defaultAspect ?? '9:16');
  }, [settings?.defaultAspect]);

  useEffect(() => {
    const video = previewRef.current;
    if (!video || !preview) return;
    video.currentTime = preview.start;
    void video.play().catch(() => {});
  }, [preview]);

  const loadInfo = async () => {
    const value = url.trim();
    if (!value) return;
    setInfoLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/link/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value }),
      });
      const data = await readJson<Info>(response);
      setSourceInfo(data);
      setProjectName((current) => current || data.title);
    } catch (err) {
      setSourceInfo(null);
      setError((err as Error).message);
    } finally {
      setInfoLoading(false);
    }
  };

  const cancel = async () => {
    cancelledRef.current = true;
    runRef.current += 1;
    if (jobRef.current) await api.cancelJob(jobRef.current).catch(() => undefined);
    if (aiJobRef.current) {
      await fetch('/api/ai/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: aiJobRef.current }),
      }).catch(() => undefined);
    }
    jobRef.current = null;
    aiJobRef.current = null;
    if (projectId) await api.updateProject(projectId, { status: 'failed' }).catch(() => undefined);
    setPhase('setup');
    setStage('');
    setStatus('');
    setProgress(0);
    notify('Analysis cancelled.');
  };

  const startJob = async () => {
    if (busy) return;

    if (mode === 'link') {
      const value = url.trim();
      if (!value) {
        setError('Paste a stream or VOD link first.');
        return;
      }
      if (!hostMatches(value, activePlatform.host)) {
        setError(`That does not look like a ${activePlatform.label} link.`);
        return;
      }
    } else if (!file) {
      setError('Choose a video file first.');
      return;
    }

    if (maxLength <= minLength) {
      setError('Maximum clip length must be greater than the minimum.');
      return;
    }

    const startSeconds = parseClock(start);
    if (mode === 'link' && Number.isNaN(startSeconds)) {
      setError('Start time must look like 90, 12:30 or 1:12:30.');
      return;
    }

    runRef.current += 1;
    const run = runRef.current;
    cancelledRef.current = false;
    setPhase('working');
    setError(null);
    setResults([]);
    setTranscript([]);
    setProjectId(null);
    setMedia(null);
    setProgress(0);

    let createdProject: string | null = null;
    try {
      let mediaUrl = '';
      let mediaName = '';
      let width = 0;
      let height = 0;
      let duration = 0;
      let segmentStart = 0;

      if (mode === 'file' && file) {
        setStage('Uploading your video');
        setStatus('Saving the video into your local workspace…');
        const uploaded = await uploadVideo(file, (value) => setProgress(value * 0.15));
        if (cancelledRef.current || runRef.current !== run) return;
        mediaUrl = uploaded.url;
        mediaName = uploaded.name;
        setProgress(0.18);
        const info = await probeVideo(mediaUrl);
        width = info.width;
        height = info.height;
        duration = info.duration;
      } else {
        setStage('Reading stream details');
        setStatus('Asking yt-dlp about the stream…');
        const response = await fetch('/api/link/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim() }),
        });
        const info = await readJson<Info>(response);
        setSourceInfo(info);
        const startSeconds = 0;
        const length = Math.min(1800, Math.max(10, info.duration || 1800));

        setStage('Downloading stream audio for analysis');
        setStatus(`ClipGPT is analyzing the full stream (${fmt(length)}) for viral moments…`);
        const jobResponse = await fetch('/api/link/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim(), start: startSeconds, length, title: info.title }),
        });
        const job = await readJson<{ id: string }>(jobResponse);
        jobRef.current = job.id;

        for (let attempt = 0; attempt < 900; attempt++) {
          await sleep(1200);
          if (cancelledRef.current || runRef.current !== run) return;
          const poll = await readJson<{
            status: string;
            percent?: number;
            error?: string;
            mediaUrl?: string;
            fileName?: string;
            width?: number;
            height?: number;
            duration?: number;
          }>(await fetch(`/api/link/job?id=${encodeURIComponent(job.id)}`));
          if (poll.status === 'error') throw new Error(poll.error || 'The download failed.');
          if (poll.status === 'done' && poll.mediaUrl) {
            mediaUrl = poll.mediaUrl;
            mediaName = poll.fileName || `${info.title}.mp4`;
            width = poll.width || 0;
            height = poll.height || 0;
            duration = poll.duration || length;
            segmentStart = startSeconds;
            setProgress(0.2);
            break;
          }
          setProgress(0.02 + Math.min(0.16, (poll.percent ?? 0) * 0.0016));
          setStatus(poll.percent ? `Downloading segment… ${poll.percent}%` : 'Downloading segment…');
        }
        if (!mediaUrl) throw new Error('The segment download did not finish in time.');
        jobRef.current = null;
      }

      if (cancelledRef.current || runRef.current !== run) return;

      setMedia({ url: mediaUrl, name: mediaName, duration, width, height, kind: mode === 'link' ? 'url' : 'upload', segmentStart });

      const name = (projectName.trim() || mediaName.replace(/\.[a-z0-9]+$/i, '') || 'AI clip project').slice(0, 140);
      const source: ProjectSource = {
        kind: mode === 'link' ? 'url' : 'upload',
        url: mediaUrl,
        captionSource: mode === 'link' ? url.trim() : undefined,
        name: mediaName,
        platform: mode === 'link' ? platform : undefined,
        duration,
        width,
        height,
        segmentStart: segmentStart || undefined,
      };

      const project = await api.createProject({
        name,
        source,
        status: 'processing',
        aspect,
        style: DEFAULT_STYLE,
        clips: [],
        cues: [],
      });
      createdProject = project.id;
      setProjectId(project.id);

      // Decide: use full AI pipeline (Whisper + LLM) or fallback to audio peaks.
      const useAi = aiReady === true;

      if (useAi) {
        // ── Full AI pipeline: Whisper transcription → LLM clip selection ──
        setStage('Starting AI analysis');
        setStatus(`Transcribing audio with Whisper, then ${aiEngine || 'LLM'} selects the best moments…`);
        setProgress(0.22);

        const aiResponse = await fetch('/api/ai/job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaUrl,
            duration,
            count,
            minLength,
            maxLength,
            focus: focus.trim() || undefined,
            language: language === 'auto' ? undefined : language,
            chatContext: chatContext
              .map((message) => ({ ...message, time: message.time - segmentStart }))
              .filter((message) => message.time >= 0 && message.time <= duration),
          }),
        });
        const aiJob = await readJson<AiJob>(aiResponse);
        aiJobRef.current = aiJob.id;

        // Poll the AI job.
        for (let attempt = 0; attempt < 1200; attempt++) {
          await sleep(1500);
          if (cancelledRef.current || runRef.current !== run) return;
          const poll = await readJson<AiJob>(await fetch(`/api/ai/job?id=${encodeURIComponent(aiJob.id)}`));

          if (poll.status === 'error') throw new Error(poll.error || 'The AI analysis failed.');

          // Map server percent (0-100) into our progress range (0.22 – 0.95).
          const aiPercent = (poll.percent ?? 0) / 100;
          setProgress(0.22 + aiPercent * 0.73);
          setStage(poll.stage || 'Analyzing');

          // Update status with more detail.
          if (poll.stage?.includes('Transcribing')) {
            setStatus('Whisper is converting speech to text…');
          } else if (poll.stage?.includes('reading')) {
            setStatus('Sending the transcript to the AI for analysis…');
          } else if (poll.stage?.includes('choosing')) {
            setStatus(`${poll.model || 'AI'} is finding the most viral moments…`);
          } else if (poll.stage?.includes('Verifying')) {
            setStatus('Validating timestamps and building clips…');
          }

          if (poll.status === 'done' && poll.result) {
            aiJobRef.current = null;
            const aiResult = poll.result;

            setResultEngine(aiResult.engine);
            setTranscript(aiResult.segments || []);

            // Convert AI clips into Suggestion format.
            const suggestions: Suggestion[] = aiResult.clips.map((clip, i) => ({
              id: uid('sug'),
              start: clip.start,
              end: clip.end,
              title: clip.title,
              score: clip.score,
              hook: clip.hook,
              reason: clip.reason,
              excerpt: clip.excerpt,
              hashtags: clip.hashtags,
              aiGenerated: true,
            }));

            // Build real Clip objects for the project.
            const clips: Clip[] = suggestions.map((s, i) => ({
              id: uid('clip'),
              title: s.title || `Clip ${i + 1}`,
              start: s.start,
              end: s.end,
              pan: 0.5,
              zoom: 1,
              autoReframe: false,
              score: s.score,
            }));

            // Build auto-captions from transcript segments.
            const allCues: Cue[] = [];
            for (const clip of clips) {
              const clipCues = cuesForClip(aiResult.segments || [], clip.start, clip.end);
              allCues.push(...clipCues);
            }

            await api.updateProject(project.id, { clips, cues: allCues, status: 'ready' });
            setProgress(1);
            setResults(suggestions);
            setPhase('results');
            notify(`ClipGPT found ${suggestions.length} viral moments. Captions auto-generated from transcript.`);
            setStage('');
            setStatus('');
            return;
          }
        }
        throw new Error('The AI analysis did not finish in time.');
      } else {
        // ── Fallback: audio-only peak detection ──
        setStage('Scanning the audio');
        setStatus('AI engine is not available — falling back to audio peak detection…');
        const energy = await computeEnergy(mediaUrl, duration, (value) => setProgress(0.22 + value * 0.7));
        if (cancelledRef.current || runRef.current !== run) return;

        setStage('Finding moments');
        const found = findHighlights(energy, duration, count, { minLength, maxLength });
        if (!found.length) {
          throw new Error('No clear audio peaks were found in this segment. Try a longer or louder section.');
        }

        const suggestions: Suggestion[] = found.map((s) => ({ ...s, aiGenerated: false }));

        const clips: Clip[] = suggestions.map((s, i) => ({
          id: uid('clip'),
          title: s.title || `Clip ${i + 1}`,
          start: s.start,
          end: s.end,
          pan: 0.5,
          zoom: 1,
          autoReframe: false,
          score: s.score,
        }));

        await api.updateProject(project.id, { clips, status: 'ready' });
        setProgress(1);
        setResults(suggestions);
        setPhase('results');
        notify(`Found ${found.length} moments via audio peaks. For better results, set up Whisper + Ollama.`);
        setStage('');
        setStatus('');
      }
    } catch (err) {
      if (cancelledRef.current || runRef.current !== run) return;
      if (createdProject) await api.updateProject(createdProject, { status: 'failed' }).catch(() => undefined);
      setError((err as Error).message);
      setPhase('error');
      setStage('');
    }
  };

  const openProject = () => {
    if (projectId) onOpenProject(projectId);
  };

  const loadChatFile = async (picked: File) => {
    setChatError(null);
    try {
      const parsed = parseChatLog(await picked.text());
      if (!parsed.length) throw new Error('No timestamped chat messages found. Use TwitchDownloader JSON or timestamped TXT/CSV.');
      setChatContext(parsed);
      setChatFileName(picked.name);
      notify(`Loaded ${parsed.length.toLocaleString()} timestamped chat messages.`);
    } catch (err) {
      setChatContext([]);
      setChatFileName('');
      setChatError((err as Error).message);
    }
  };

  const addTranscriptClip = async (segment: TranscriptSegment) => {
    if (!projectId || !media) return;
    try {
      const length = Math.min(media.duration, Math.max(minLength, Math.min(maxLength, 30)));
      const midpoint = (segment.start + segment.end) / 2;
      const clipStart = Math.max(0, Math.min(Math.max(0, media.duration - length), midpoint - length / 2));
      const clipEnd = Math.min(media.duration, clipStart + length);
      const project = await api.project(projectId);
      const text = segment.text.trim();
      const clip: Clip = {
        id: uid('clip'),
        title: text.split(/\s+/).slice(0, 6).join(' ').slice(0, 80) || `Transcript moment ${fmt(segment.start)}`,
        start: clipStart,
        end: clipEnd,
        pan: 0.5,
        zoom: 1,
        autoReframe: false,
      };
      const cues = cuesForClip(transcript, clipStart, clipEnd);
      await api.updateProject(projectId, { clips: [...project.clips, clip], cues: [...project.cues, ...cues], status: 'ready' });
      notify(`Added a ${fmtTenths(clipEnd - clipStart)} clip from ${fmt(segment.start)} to the project.`);
    } catch (err) {
      notify((err as Error).message || 'Could not add the transcript moment to the project.');
    }
  };

  const reset = () => {
    setPhase('setup');
    setResults([]);
    setTranscript([]);
    setMedia(null);
    setProjectId(null);
    setProgress(0);
    setError(null);
    setTranscriptSearch('');
  };

  const transcriptMatches = transcriptSearch.trim()
    ? transcript.filter((segment) => segment.text.toLocaleLowerCase().includes(transcriptSearch.trim().toLocaleLowerCase())).slice(0, 40)
    : [];

  return (
    <div className="page ai-page">
      <div className="ai-head">
        <div>
          <h2>AI Clips</h2>
          <p>
            {aiReady
              ? 'Paste a stream link or upload a video. ClipGPT transcribes the audio, finds the most viral moments, generates hooks and hashtags, and auto-adds captions.'
              : 'Find the loudest moments in a stream segment using audio peak analysis. Set up Whisper + Ollama for full AI transcript analysis.'}
          </p>
        </div>
        <span className={`pill${aiReady ? ' pill-ready' : ''}`}>
          {aiReady ? `✦ ${aiEngine || 'AI ready'}` : 'Audio-only fallback'}
        </span>
      </div>

      {(phase === 'setup' || phase === 'error') && (
        <div className="ai-grid">
          <section className="panel-card">
            <h3>1 · Source</h3>
            <div className="seg">
              <button className={mode === 'link' ? 'on' : ''} onClick={() => setMode('link')} disabled={busy}>
                Stream link
              </button>
              <button className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')} disabled={busy}>
                Upload file
              </button>
            </div>

            {mode === 'link' ? (
              <>
                <div className="platform-row">
                  {PLATFORMS.map((entry) => (
                    <button
                      key={entry.id}
                      className={`platform-pick${platform === entry.id ? ' active' : ''}`}
                      onClick={() => {
                        setPlatform(entry.id);
                        setSourceInfo(null);
                      }}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
                <div className="connect-row">
                  <input
                    className="input"
                    placeholder={`https://www.${activePlatform.host}/…`}
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    onBlur={() => {
                      if (url.trim() && hostMatches(url, activePlatform.host)) void loadInfo();
                    }}
                  />
                  <button className="btn" onClick={() => void loadInfo()} disabled={!url.trim() || infoLoading}>
                    {infoLoading ? 'Checking…' : 'Check link'}
                  </button>
                </div>
                {sourceInfo && (
                  <div className="source-summary">
                    <b>{sourceInfo.title}</b>
                    <span>
                      {sourceInfo.uploader || activePlatform.label} · {fmt(sourceInfo.duration)}
                    </span>
                  </div>
                )}
                <div className="sl-stream-analysis-badge">
                  <div className="sl-badge-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <div>
                    <b>Full Stream Clipping Enabled</b>
                    <p>ClipGPT automatically scans the full stream to detect the highest-retention moments and viral hooks.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <label className="upload-box">
                  <input
                    type="file"
                    accept="video/*"
                    hidden
                    onChange={(event) => {
                      const picked = event.target.files?.[0] ?? null;
                      setFile(picked);
                      if (picked) setProjectName((current) => current || picked.name.replace(/\.[a-z0-9]+$/i, ''));
                      event.target.value = '';
                    }}
                  />
                  <b>{file ? file.name : 'Choose a video file'}</b>
                  <span>{file ? `${(file.size / 1048576).toFixed(0)} MB · stored locally` : 'MP4, WebM, MOV, M4V or MKV'}</span>
                </label>
              </>
            )}

            <label className="field">
              <span>Project name</span>
              <input
                className="input"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Friday stream highlights"
              />
            </label>
          </section>

          <section className="panel-card">
            <h3>2 · Clip settings</h3>
            <label className="field">
              <span>
                How many clips <b className="value">{count}</b>
              </span>
              <input
                className="slider"
                type="range"
                min={2}
                max={10}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </label>
            <div className="grid2">
              <label className="field">
                <span>Min length</span>
                <select className="input" value={minLength} onChange={(event) => setMinLength(Number(event.target.value))}>
                  {[10, 15, 20, 30, 45, 60].map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Max length</span>
                <select className="input" value={maxLength} onChange={(event) => setMaxLength(Number(event.target.value))}>
                  {[20, 30, 45, 60, 90, 120].map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Output aspect</span>
              <select className="input" value={aspect} onChange={(event) => setAspect(event.target.value as Aspect)}>
                <option value="9:16">9:16 · Shorts &amp; Reels</option>
                <option value="16:9">16:9 · Landscape</option>
                <option value="1:1">1:1 · Square</option>
              </select>
            </label>

            {aiReady && (
              <>
                <label className="field">
                  <span>What to look for <span className="optional">(optional)</span></span>
                  <input
                    className="input"
                    value={focus}
                    onChange={(event) => setFocus(event.target.value)}
                    placeholder="funny reactions, clutch plays, hot takes, tips…"
                  />
                  <span className="hint" style={{ marginTop: 4 }}>Describe the kind of moments you want. Leave empty to let the AI decide.</span>
                </label>
                <label className="field">
                  <span>Stream language</span>
                  <select className="input" value={language} onChange={(event) => setLanguage(event.target.value)}>
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field">
                  <span>Chat replay context <span className="optional">(optional)</span></span>
                  <input
                    ref={chatFileRef}
                    type="file"
                    accept=".json,.txt,.csv,application/json,text/plain,text/csv"
                    hidden
                    onChange={(event) => {
                      const picked = event.target.files?.[0];
                      if (picked) void loadChatFile(picked);
                      event.target.value = '';
                    }}
                  />
                  <div className="row">
                    <button className="btn btn-ghost" type="button" onClick={() => chatFileRef.current?.click()} disabled={busy}>
                      {chatFileName ? 'Replace chat replay' : 'Add chat replay'}
                    </button>
                    {chatFileName && (
                      <button className="btn btn-ghost" type="button" onClick={() => { setChatContext([]); setChatFileName(''); }} disabled={busy}>
                        Remove
                      </button>
                    )}
                  </div>
                  <span className="hint" style={{ marginTop: 4 }}>
                    {chatFileName
                      ? `${chatFileName} · ${chatContext.length.toLocaleString()} messages loaded. Timestamps are matched to the selected segment.`
                      : 'Load a timestamped TwitchDownloader JSON, TXT or CSV replay. Messages are matched to the segment and help the AI understand reactions.'}
                  </span>
                  {chatError && <div className="error-banner">{chatError}</div>}
                </div>
              </>
            )}

            {aiReady === false && (
              <div className="notice">
                <b>AI engine offline</b>
                <p>{aiDetail || 'Whisper and/or Ollama are not available. Audio peak detection will be used as a fallback.'}</p>
              </div>
            )}

            {error && <div className="error-banner">{error}</div>}

            <button className="btn btn-lime btn-lg btn-block" onClick={() => void startJob()} disabled={busy}>
              {busy ? 'Working…' : aiReady ? '✦ Find viral moments' : 'Find clip moments'}
            </button>
            <p className="hint">Your project is saved before analysis starts, so it appears in the library even if you leave.</p>
          </section>
        </div>
      )}

      {phase === 'working' && (
        <section className="panel-card working-card">
          <div className="working-head">
            <span className="spinner" />
            <div>
              <h3>{stage || 'Working'}</h3>
              <p>{status}</p>
            </div>
            <button className="btn btn-sm" onClick={() => void cancel()}>
              Cancel
            </button>
          </div>
          <div className="progress">
            <span style={{ width: `${Math.max(2, progress * 100)}%` }} />
          </div>
          <p className="hint">{Math.round(progress * 100)}% · {aiReady ? 'AI analysis runs on your machine' : 'analysis happens in this browser tab'}; keep it open.</p>
        </section>
      )}

      {phase === 'results' && (
        <section className="results-block">
          <div className="results-head">
            <div>
              <h3>
                {results[0]?.aiGenerated ? '✦ ' : ''}
                {results.length} {results[0]?.aiGenerated ? 'viral moments' : 'moments'} found
              </h3>
              <p>
                {results[0]?.aiGenerated
                  ? `Ranked by AI virality score. Engine: ${resultEngine || 'local AI'}. Captions auto-generated from transcript.`
                  : `Ranked by relative audio peak. Scores are from audio energy, not a virality model.`}
                {media?.segmentStart ? ` Source segment starts at ${fmt(media.segmentStart)}.` : ''}
              </p>
            </div>
            <div className="results-actions">
              <button className="btn" onClick={reset}>
                New analysis
              </button>
              <button className="btn btn-lime" onClick={openProject}>
                Open in editor
              </button>
            </div>
          </div>

          {transcript.length > 0 && (
            <section className="transcript-search panel-card">
              <div className="transcript-search-head">
                <div>
                  <h3>Search the transcript</h3>
                  <p>{transcript.length.toLocaleString()} timestamped speech segments · search for an exact phrase, name, or topic.</p>
                </div>
                <span className="pill">Whisper transcript</span>
              </div>
              <input
                className="input"
                type="search"
                value={transcriptSearch}
                onChange={(event) => setTranscriptSearch(event.target.value)}
                placeholder="Search spoken words, like ‘one more try’…"
                aria-label="Search the transcript"
              />
              {transcriptSearch.trim() ? (
                <div className="transcript-match-list">
                  <span className="hint">Showing {transcriptMatches.length} match{transcriptMatches.length === 1 ? '' : 'es'} (up to 40)</span>
                  {transcriptMatches.length ? transcriptMatches.map((segment, index) => {
                    const previewStart = Math.max(0, segment.start - 3);
                    const previewEnd = Math.min(media?.duration ?? segment.end + 3, segment.end + 3);
                    return (
                      <article className="transcript-match" key={`${segment.start}-${index}`}>
                        <div className="transcript-match-time">
                          <b>{fmt(segment.start)}</b>
                          {media?.segmentStart ? <span>Source {fmt(media.segmentStart + segment.start)}</span> : null}
                        </div>
                        <p>{segment.text}</p>
                        <div className="row">
                          <button className="btn btn-sm" onClick={() => setPreview({ id: uid('transcript-preview'), start: previewStart, end: Math.max(previewStart + 0.5, previewEnd), title: 'Transcript match', score: 0, excerpt: segment.text })}>Preview</button>
                          <button className="btn btn-sm btn-lime" onClick={() => void addTranscriptClip(segment)}>Create clip</button>
                        </div>
                      </article>
                    );
                  }) : <p className="hint">No transcript lines contain that search.</p>}
                </div>
              ) : <p className="hint">Search scans the full transcript. Choose a match to preview it or make a new clip around that moment.</p>}
            </section>
          )}

          <div className="result-grid">
            {results.map((suggestion, index) => {
              const viralScore = Math.round(suggestion.score * 100);
              const isAi = suggestion.aiGenerated;

              return (
                <article className="result-card" key={suggestion.id}>
                  <div className="result-thumb">
                    <span className="result-index">{String(index + 1).padStart(2, '0')}</span>
                    <button
                      className="result-play"
                      onClick={() => setPreview(suggestion)}
                      aria-label={`Preview ${suggestion.title}`}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                    <span className="result-duration">{fmtTenths(suggestion.end - suggestion.start)}</span>
                  </div>
                  <div className="result-body">
                    <b>{suggestion.title}</b>

                    {isAi && suggestion.hook && (
                      <p className="result-hook">{suggestion.hook}</p>
                    )}

                    <span className="result-times">
                      {fmt(suggestion.start)} → {fmt(suggestion.end)}
                      {media?.segmentStart ? ` · ${fmt(media.segmentStart + suggestion.start)} in source` : ''}
                    </span>

                    <div className="score-row">
                      <span className="score-label">{isAi ? 'Virality' : 'Audio peak'}</span>
                      <span className="score-bar">
                        <span
                          style={{
                            width: `${viralScore}%`,
                            background: isAi ? viralityColor(viralScore) : undefined,
                          }}
                        />
                      </span>
                      <b style={isAi ? { color: viralityColor(viralScore) } : undefined}>
                        {viralScore}
                      </b>
                    </div>

                    {isAi && (
                      <span className="virality-tag" style={{ color: viralityColor(viralScore) }}>
                        {viralityLabel(viralScore)}
                      </span>
                    )}

                    {isAi && suggestion.excerpt && (
                      <blockquote className="result-excerpt">"{suggestion.excerpt}"</blockquote>
                    )}

                    {isAi && suggestion.reason && (
                      <p className="result-reason">{suggestion.reason}</p>
                    )}

                    {isAi && suggestion.hashtags && (
                      <p className="result-hashtags">{suggestion.hashtags}</p>
                    )}

                    {!isAi && (
                      <p className="result-note">Set up Whisper + Ollama for transcript analysis, hooks, and virality scoring.</p>
                    )}

                    <div className="result-buttons">
                      <button className="btn btn-sm" onClick={() => setPreview(suggestion)}>
                        Preview
                      </button>
                      <button className="btn btn-sm btn-lime" onClick={openProject}>
                        Open in editor
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="results-foot">
            <StatusPill status="ready" />
            <span>
              The project is saved with {results.length} clips
              {results[0]?.aiGenerated ? ' and auto-generated captions' : ''}.
              Opening it keeps every result in the clip rail.
            </span>
            <button className="btn btn-sm" onClick={() => onOpenProject(projectId!)} disabled={!projectId}>
              Go to project
            </button>
          </div>
        </section>
      )}

      {preview && media && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreview(null);
          }}
        >
          <div className="modal preview-modal" role="dialog" aria-modal="true" aria-label="Moment preview">
            <div className="modal-head">
              <div>
                <h2>{preview.title}</h2>
                <p>
                  {fmt(preview.start)} → {fmt(preview.end)}
                  {preview.hook && <> · {preview.hook}</>}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setPreview(null)} title="Close">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <video
                ref={previewRef}
                className="preview-video"
                src={media.url}
                controls
                playsInline
                onTimeUpdate={(event) => {
                  if (event.currentTarget.currentTime >= preview.end) event.currentTarget.pause();
                }}
              />
              <div className="preview-meta">
                <span>
                  {media.name} · {media.width}×{media.height}
                  {preview.hashtags && <> · {preview.hashtags}</>}
                </span>
                <button className="btn btn-sm btn-lime" onClick={openProject}>
                  Open project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
