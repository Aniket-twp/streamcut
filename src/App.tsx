import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_STYLE,
  type Aspect,
  type Channel,
  type Clip,
  type Cue,
  type MediaInfo,
  type Project,
  type ProjectSource,
  type SchedulePost,
  type Style,
  type WorkspaceSettings,
} from './types';
import { clamp, fmt, fmtTenths, uid } from './lib/format';
import { computeEnergy, trackMotion, type Energy } from './lib/analyze';
import { probeVideo } from './lib/media';
import { api, aspectDimensions, uploadVideo } from './lib/store';
import { navigate, useRoute } from './lib/router';
import AppShell from './components/AppShell';
import ImportScreen from './components/ImportScreen';
import HomeScreen from './components/HomeScreen';
import AiClipsScreen from './components/AiClipsScreen';
import LibraryScreen from './components/LibraryScreen';
import PublisherScreen from './components/PublisherScreen';
import AnalyticsScreen from './components/AnalyticsScreen';
import ConnectionsScreen from './components/ConnectionsScreen';
import SettingsScreen from './components/SettingsScreen';
import ClipRail from './components/ClipRail';
import Preview from './components/Preview';
import TrimBar from './components/TrimBar';
import StylePanel from './components/StylePanel';
import CaptionsPanel from './components/CaptionsPanel';
import ExportPanel from './components/ExportPanel';

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  home: { title: 'Home', subtitle: 'Your clip workspace' },
  new: { title: 'New clip', subtitle: 'Import a stream or a local video' },
  'ai-clips': { title: 'AI Clips', subtitle: 'Find moments with local audio analysis' },
  editor: { title: 'Clip editor' },
  library: { title: 'Library', subtitle: 'Projects saved on this computer' },
  publisher: { title: 'Publisher', subtitle: 'Plan and track posts' },
  analytics: { title: 'Analytics', subtitle: 'Platform performance' },
  connections: { title: 'Connections', subtitle: 'Sources and publishing destinations' },
  settings: { title: 'Settings', subtitle: 'Workspace defaults and storage' },
};

function firstClip(duration: number, length = 30): Clip {
  return {
    id: uid('clip'),
    title: 'First clip',
    start: 0,
    end: Math.min(length, Math.max(1, duration)),
    pan: 0.5,
    zoom: 1,
    autoReframe: false,
  };
}

export default function App() {
  const route = useRoute();
  const videoRef = useRef<HTMLVideoElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode; gain: GainNode } | null>(null);
  const analyzedRef = useRef<string | null>(null);
  const loopRef = useRef(true);
  const hydratedRef = useRef(false);

  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [schedules, setSchedules] = useState<SchedulePost[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectSource, setProjectSource] = useState<ProjectSource | null>(null);
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [cues, setCues] = useState<Cue[]>([]);
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [energy, setEnergy] = useState<Energy[]>([]);
  const [tracking, setTracking] = useState(false);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(true);
  const [tab, setTab] = useState<'style' | 'captions' | 'export'>('style');
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [opening, setOpening] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const selected = clips.find((clip) => clip.id === currentId) ?? null;

  const refreshData = useCallback(async () => {
    try {
      const [nextSettings, nextProjects, nextSchedules, nextChannels] = await Promise.all([
        api.settings(),
        api.projects(),
        api.schedules(),
        api.channels(),
      ]);
      setSettings(nextSettings);
      setProjects(nextProjects);
      setSchedules(nextSchedules);
      setChannels(nextChannels);
    } catch {
      // The shell surfaces server problems; keep whatever data is already loaded.
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!['home', 'library', 'publisher', 'connections'].includes(route.screen)) return;
    void refreshData();
  }, [route.screen, refreshData]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
    if (audioRef.current) audioRef.current.gain.gain.value = muted ? 0 : 1;
  }, [muted]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const canvas = exportCanvasRef.current;
    if (!canvas) return;
    const dims = aspectDimensions(aspect, 1080);
    canvas.width = dims.width;
    canvas.height = dims.height;
  }, [aspect]);

  const ensureAudio = useCallback(async (): Promise<MediaStream | null> => {
    const video = videoRef.current;
    if (!video) return null;
    try {
      if (!audioRef.current) {
        const Ctx: typeof AudioContext =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        const ctx = new Ctx();
        const source = ctx.createMediaElementSource(video);
        const gain = ctx.createGain();
        const dest = ctx.createMediaStreamDestination();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(ctx.destination);
        gain.connect(dest);
        audioRef.current = { ctx, dest, gain };
      }
      if (audioRef.current.ctx.state === 'suspended') await audioRef.current.ctx.resume();
      return audioRef.current.dest.stream;
    } catch {
      return null;
    }
  }, []);

  /** Builds the waveform only. Moment finding now lives in AI Clips. */
  const runAnalysis = useCallback(async (info: MediaInfo) => {
    if (info.size > 600 * 1024 * 1024 || info.duration > 4 * 3600) return;
    try {
      setEnergy(await computeEnergy(info.url, info.duration));
    } catch {
      setNotice('No readable audio track for the waveform. AI Clips needs speech to find moments.');
    }
  }, []);

  const openProject = useCallback(async (id: string) => {
    setOpening(true);
    setSessionError(null);
    try {
      const project = await api.project(id);
      if (!project.source?.url) throw new Error('This project has no source video attached.');
      const info = await probeVideo(project.source.url);
      videoRef.current?.pause();

      const projectClips = project.clips.length ? project.clips : [firstClip(info.duration)];
      setMedia({ ...info, url: project.source.url, name: project.source.name || 'source', size: 0 });
      setClips(projectClips);
      setCurrentId(projectClips[0].id);
      setStyle(project.style ?? DEFAULT_STYLE);
      setCues(project.cues ?? []);
      setAspect(project.aspect ?? '9:16');
      setProjectId(project.id);
      setProjectSource(project.source);
      setTab('style');
      setNow(0);
      setEnergy([]);
      analyzedRef.current = project.source.url;
      hydratedRef.current = true;
      setSaveState('saved');
      window.localStorage.setItem('streamcut:lastProject', project.id);
      if (project.clips.length === 0) {
        await api.updateProject(project.id, { clips: projectClips });
      }
    } catch (err) {
      setSessionError((err as Error).message);
    } finally {
      setOpening(false);
    }
  }, []);

  useEffect(() => {
    if (route.screen !== 'editor') return;
    if (!route.id) {
      navigate('/library');
      return;
    }
    if (projectId === route.id) return;
    void openProject(route.id);
  }, [route.screen, route.id, projectId, openProject]);

  const importSource = useCallback(
    async (source: { file?: File; url?: string; name?: string; segmentStart?: number; platform?: string; captionSource?: string }) => {
      setLoadingMedia(true);
      setLoadError(null);
      try {
        let url = source.url ?? '';
        let name = source.name ?? 'source';
        if (source.file) {
          const uploaded = await uploadVideo(source.file);
          url = uploaded.url;
          name = source.name ?? uploaded.name;
        }
        const info = await probeVideo(url);
        const chosenAspect = settings?.defaultAspect ?? '9:16';
        const clip = firstClip(info.duration, settings?.defaultClipLength ?? 30);
        const project = await api.createProject({
          name: name.replace(/\.[a-z0-9]+$/i, '') || 'New project',
          source: {
            kind: source.file ? 'upload' : 'url',
            url,
            captionSource: source.captionSource,
            name,
            platform: source.platform,
            duration: info.duration,
            width: info.width,
            height: info.height,
            segmentStart: source.segmentStart,
          },
          status: 'ready',
          aspect: chosenAspect,
          style: DEFAULT_STYLE,
          clips: [clip],
          cues: [],
        });

        videoRef.current?.pause();
        setMedia({ ...info, url, name, size: 0 });
        setClips([clip]);
        setCurrentId(clip.id);
        setStyle(DEFAULT_STYLE);
        setCues([]);
        setAspect(chosenAspect);
        setProjectId(project.id);
        setProjectSource(project.source);
        setTab('style');
        setNow(0);
        setEnergy([]);
        analyzedRef.current = null;
        hydratedRef.current = true;
        setSaveState('saved');
        window.localStorage.setItem('streamcut:lastProject', project.id);
        navigate(`/editor/${project.id}`);
        void refreshData();
      } catch (err) {
        setLoadError((err as Error).message);
      } finally {
        setLoadingMedia(false);
      }
    },
    [settings, refreshData],
  );

  // Autosave clip edits back into the project.
  useEffect(() => {
    if (!projectId || !hydratedRef.current || route.screen !== 'editor') return;
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      api
        .updateProject(projectId, { clips, style, cues, aspect })
        .then(() => {
          setSaveState('saved');
          setProjects((prev) =>
            prev.map((project) =>
              project.id === projectId ? { ...project, clips, style, cues, aspect, updatedAt: Date.now() } : project,
            ),
          );
        })
        .catch(() => setSaveState('error'));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [projectId, clips, style, cues, aspect, route.screen]);

  useEffect(() => {
    if (!media || route.screen !== 'editor') return;
    if (analyzedRef.current === media.url) return;
    analyzedRef.current = media.url;
    void runAnalysis(media);
  }, [media, route.screen, runAnalysis]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setNow(video.currentTime);
    const onError = () => setNotice('This browser could not decode that video.');
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('seeked', onTime);
    video.addEventListener('error', onError);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('seeked', onTime);
      video.removeEventListener('error', onError);
    };
  }, [media]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selected) return;
    video.pause();
    if (Math.abs(video.currentTime - selected.start) > 0.05) video.currentTime = selected.start;
    setNow(selected.start);
  }, [currentId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selected || rendering) return;
    let raf = 0;
    let last = 0;

    const tick = (time: number) => {
      raf = requestAnimationFrame(tick);
      if (time - last < 80) return;
      last = time;
      setNow(video.currentTime);
      if (!video.paused && video.currentTime >= selected.end - 0.03) {
        if (loopRef.current) {
          video.currentTime = selected.start;
        } else {
          video.pause();
          video.currentTime = selected.end;
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentId, selected?.start, selected?.end, rendering, media]);

  useEffect(() => {
    return () => {
      if (audioRef.current) void audioRef.current.ctx.close();
    };
  }, []);

  const updateClip = (patch: Partial<Clip>) => {
    if (!currentId) return;
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === currentId
          ? { ...clip, ...patch, ...(patch.pan !== undefined ? { autoReframe: false } : {}) }
          : clip,
      ),
    );
  };

  const setTrim = useCallback(
    (start: number, end: number) => {
      if (!media) return;
      const safeStart = clamp(start, 0, Math.max(0, media.duration - 1));
      const safeEnd = clamp(end, safeStart + 1, media.duration);
      setClips((prev) =>
        prev.map((clip) => (clip.id === currentId ? { ...clip, start: safeStart, end: safeEnd } : clip)),
      );
    },
    [media, currentId],
  );

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = clamp(time, 0, video.duration || 0);
    setNow(video.currentTime);
  }, []);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !selected) return;
    if (video.paused) {
      await ensureAudio();
      if (video.currentTime < selected.start || video.currentTime >= selected.end - 0.05) {
        video.currentTime = selected.start;
      }
      try {
        await video.play();
      } catch {
        setNotice('The browser blocked playback — press play again.');
      }
    } else {
      video.pause();
    }
  }, [selected, ensureAudio]);

  useEffect(() => {
    if (route.screen !== 'editor') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        void togglePlay();
      }
      if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        const video = videoRef.current;
        if (!video) return;
        video.pause();
        seek(video.currentTime + (event.code === 'ArrowLeft' ? -0.2 : 0.2));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seek, route.screen]);

  const addClip = (start?: number, end?: number, title?: string, score?: number) => {
    if (!media) return;
    const rawStart = clamp(start ?? videoRef.current?.currentTime ?? 0, 0, Math.max(0, media.duration - 2));
    const safeEnd = clamp(end ?? rawStart + 30, rawStart + 2, media.duration);
    const safeStart = Math.min(rawStart, Math.max(0, safeEnd - 2));
    const clip: Clip = {
      id: uid('clip'),
      title: title ?? `Clip ${clips.length + 1}`,
      start: safeStart,
      end: safeEnd,
      pan: 0.5,
      zoom: 1,
      autoReframe: false,
      score,
    };
    setClips((prev) => [...prev, clip]);
    setCurrentId(clip.id);
    setTab('style');
  };

  const deleteClip = (id: string) => {
    const remaining = clips.filter((clip) => clip.id !== id);
    setClips(remaining);
    if (id === currentId) setCurrentId(remaining[0]?.id ?? null);
  };

  const autoReframe = async (mode?: 'auto' | 'facecam' | 'action') => {
    if (!selected || !media) return;
    setTracking(true);
    try {
      const selectedMode = mode ?? selected.reframeMode ?? 'auto';
      const track = await trackMotion(media.url, selected.start, selected.end, { mode: selectedMode });
      if (!track.length) {
        setNotice('Could not track this clip — adjust the crop by dragging instead.');
        updateClip({ autoReframe: false });
        return;
      }
      const hasFace = Boolean(track.facecam?.hasFacecam);
      const camPos = track.facecam?.box;
      setClips((prev) =>
        prev.map((clip) =>
          clip.id === selected.id
            ? {
                ...clip,
                panTrack: track,
                autoReframe: true,
                tracked: true,
                reframeMode: selectedMode,
                facecamDetected: hasFace,
                facecamPosition: camPos,
                camPan: clip.camPan ?? (hasFace ? camPos?.x : undefined),
              }
            : clip,
        ),
      );
      if (hasFace) {
        setNotice(`Facecam detected (${Math.round((track.facecam?.confidence ?? 0.85) * 100)}% match) — framed on streamer!`);
      } else {
        setNotice('Auto-reframe ready — the crop follows the action.');
      }
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setTracking(false);
    }
  };

  const bars = useMemo(() => {
    if (!energy.length) return [];
    const count = 220;
    const step = energy.length / count;
    const values: number[] = [];
    let max = 0;
    for (let i = 0; i < count; i++) {
      let peak = 0;
      for (let j = Math.floor(i * step); j < Math.max(Math.floor(i * step) + 1, Math.floor((i + 1) * step)); j++) {
        peak = Math.max(peak, energy[j]?.v ?? 0);
      }
      values.push(peak);
      max = Math.max(max, peak);
    }
    return values.map((value) => (max > 0 ? Math.sqrt(value / max) : 0));
  }, [energy]);

  const resetMedia = () => {
    videoRef.current?.pause();
    setMedia(null);
    setClips([]);
    setCurrentId(null);
    setCues([]);
    setEnergy([]);
    analyzedRef.current = null;
    hydratedRef.current = false;
    setProjectId(null);
    setProjectSource(null);
    setLoadError(null);
    setSessionError(null);
    setSaveState('idle');
    navigate('/new');
  };

  const meta = TITLES[route.screen] ?? { title: 'StreamCut' };
  const activeProject = projects.find((project) => project.id === projectId) ?? null;
  const header =
    route.screen === 'editor'
      ? {
          title: media ? media.name : 'Clip editor',
          subtitle: activeProject
            ? `${activeProject.name} · ${aspect} · saved locally`
            : 'Open a project from the library',
        }
      : meta;

  const shellActions =
    route.screen === 'editor' && media ? (
      <>
        <select
          className="input aspect-select"
          value={aspect}
          onChange={(event) => setAspect(event.target.value as Aspect)}
          aria-label="Output aspect ratio"
        >
          <option value="9:16">9:16</option>
          <option value="16:9">16:9</option>
          <option value="1:1">1:1</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={resetMedia}>
          New video
        </button>
      </>
    ) : (
      <button className="btn btn-lime btn-sm" onClick={() => navigate('/new')}>
        New clip
      </button>
    );

  let content: React.ReactNode = null;

  if (route.screen === 'home') {
    content = (
      <HomeScreen
        settings={settings}
        projects={projects}
        schedules={schedules}
        channels={channels}
        loading={dataLoading}
        onImportUrl={(url) => {
          const platform = url.includes('twitch')
            ? 'twitch'
            : url.includes('kick')
              ? 'kick'
              : url.includes('youtu')
                ? 'youtube'
                : undefined;
          navigate(`/ai-clips?url=${encodeURIComponent(url)}${platform ? `&platform=${platform}` : ''}`);
        }}
        onUpload={(file) => void importSource({ file })}
        onOpenProject={(id) => navigate(`/editor/${id}`)}
      />
    );
  } else if (route.screen === 'new') {
    content = (
      <ImportScreen
        loading={loadingMedia}
        error={loadError}
        onFile={(file) => void importSource({ file })}
        onUrl={(url, name, meta) => void importSource({
          url,
          name,
          segmentStart: meta?.segmentStart,
          platform: meta?.platform,
          captionSource: meta?.captionSource,
        })}
        onOpenConnections={() => navigate('/connections')}
        pendingVod={null}
        initialUrl={route.query.get('url') ?? undefined}
        compact
      />
    );
  } else if (route.screen === 'ai-clips') {
    content = (
      <AiClipsScreen
        initialUrl={route.query.get('url') ?? undefined}
        initialPlatform={(route.query.get('platform') as 'twitch' | 'youtube' | 'kick' | null) ?? undefined}
        settings={settings}
        onOpenProject={(id) => {
          navigate(`/editor/${id}`);
        }}
        notify={setNotice}
      />
    );
  } else if (route.screen === 'library') {
    content = (
      <LibraryScreen
        projects={projects}
        loading={dataLoading}
        onOpenProject={(id) => navigate(`/editor/${id}`)}
        onChanged={() => void refreshData()}
        notify={setNotice}
      />
    );
  } else if (route.screen === 'publisher') {
    content = (
      <PublisherScreen
        schedules={schedules}
        projects={projects}
        settings={settings}
        loading={dataLoading}
        onChanged={() => void refreshData()}
        notify={setNotice}
      />
    );
  } else if (route.screen === 'analytics') {
    content = <AnalyticsScreen schedules={schedules} />;
  } else if (route.screen === 'connections') {
    content = <ConnectionsScreen />;
  } else if (route.screen === 'settings') {
    content = (
      <SettingsScreen
        settings={settings}
        projects={projects}
        onSaved={(value) => setSettings(value)}
        notify={setNotice}
      />
    );
  } else if (route.screen === 'editor') {
    if (opening) {
      content = (
        <div className="page">
          <div className="card-loading">
            <span className="spinner sm" /> Opening project…
          </div>
        </div>
      );
    } else if (sessionError) {
      content = (
        <div className="page">
          <div className="error-banner">{sessionError}</div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn btn-lime" onClick={() => navigate('/library')}>
              Back to library
            </button>
            {route.id && (
              <button className="btn" onClick={() => void openProject(route.id!)}>
                Try again
              </button>
            )}
          </div>
        </div>
      );
    } else if (!media) {
      content = (
        <div className="page">
          <div className="card-loading">
            <span className="spinner sm" /> Loading source…
          </div>
        </div>
      );
    } else {
      content = (
        <div className="workspace editor-workspace">
          <ClipRail
            media={media}
            clips={clips}
            currentId={currentId}
            onSelect={(id) => setCurrentId(id)}
            onAdd={() => addClip()}
            onDelete={deleteClip}
            onOpenAi={() => navigate('/ai-clips')}
            onChangeSource={resetMedia}
          />

          <main className="stage">
            <div className="stage-head">
              <input
                className="title-input"
                value={selected?.title ?? ''}
                onChange={(event) => updateClip({ title: event.target.value })}
                placeholder="Clip title"
                disabled={!selected}
              />
              <div className="stage-tags">
                <span className="chip subtle">Clip start {fmt(selected?.start ?? 0)}</span>
                <span className="chip subtle">{aspect}</span>
                {selected?.autoReframe && <span className="chip accent">auto crop</span>}
              </div>
              <button className="btn btn-lime btn-sm" onClick={() => setTab('export')}>
                Export
              </button>
            </div>

            {selected ? (
              <Preview
                videoRef={videoRef}
                clip={selected}
                style={style}
                cues={cues}
                aspect={aspect}
                playing={playing}
                now={now}
                onTogglePlay={() => void togglePlay()}
                onUpdate={updateClip}
              />
            ) : (
              <div className="preview-wrap">
                <div className="empty-stage">Add a clip to start editing.</div>
              </div>
            )}

            {selected ? (
              <TrimBar
                duration={media.duration}
                start={selected.start}
                end={selected.end}
                current={now}
                bars={bars}
                onTrim={setTrim}
                onSeek={seek}
              />
            ) : (
              <div />
            )}

            <div className="playbar">
              <button className="icon-btn big" onClick={() => void togglePlay()} disabled={!selected} title="Play / pause (space)">
                {playing ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
                    <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M8 4.8v14.4L20 12z" />
                  </svg>
                )}
              </button>
              <span className="time">
                {fmtTenths(selected ? Math.max(0, now - selected.start) : 0)} /{' '}
                {fmtTenths(selected ? selected.end - selected.start : 0)}
              </span>

              <div className="playbar-right">
                <button className="btn btn-ghost btn-sm" disabled={!selected} onClick={() => selected && setTrim(now, selected.end)}>
                  Set in
                </button>
                <button className="btn btn-ghost btn-sm" disabled={!selected} onClick={() => selected && setTrim(selected.start, now)}>
                  Set out
                </button>
                <button className={`icon-btn${muted ? ' off' : ''}`} onClick={() => setMuted((value) => !value)} title="Mute">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
                    {!muted && <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8 8 0 0 1 0 12" strokeLinecap="round" />}
                    {muted && <path d="M17 9l4 6M21 9l-4 6" strokeLinecap="round" />}
                  </svg>
                </button>
                <button className={`icon-btn${loop ? ' on' : ''}`} onClick={() => setLoop((value) => !value)} title="Loop clip">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 11a7 7 0 0 1 12-4l3 3M20 13a7 7 0 0 1-12 4l-3-3" strokeLinecap="round" />
                    <path d="M19 4v6h-6M5 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </main>

          <aside className="inspector">
            <div className="tabs">
              <button className={tab === 'style' ? 'on' : ''} onClick={() => setTab('style')}>
                Style
              </button>
              <button className={tab === 'captions' ? 'on' : ''} onClick={() => setTab('captions')}>
                Captions
              </button>
              <button className={tab === 'export' ? 'on' : ''} onClick={() => setTab('export')}>
                Export
              </button>
            </div>

            {selected ? (
              <>
                {tab === 'style' && (
                  <StylePanel
                    style={style}
                    clip={selected}
                    onStyle={(patch) => setStyle((prev) => ({ ...prev, ...patch }))}
                    onClip={updateClip}
                    onAutoReframe={(mode) => void autoReframe(mode)}
                    tracking={tracking}
                    notify={setNotice}
                  />
                )}
                {tab === 'captions' && (
                  <CaptionsPanel
                    style={style}
                    clip={selected}
                    source={projectSource ?? activeProject?.source ?? null}
                    cues={cues}
                    setCues={setCues}
                    onStyle={(patch) => setStyle((prev) => ({ ...prev, ...patch }))}
                    notify={setNotice}
                  />
                )}
                {tab === 'export' && (
                  <ExportPanel
                    clip={selected}
                    style={style}
                    cues={cues}
                    media={media}
                    aspect={aspect}
                    videoRef={videoRef}
                    exportCanvasRef={exportCanvasRef}
                    ensureAudio={ensureAudio}
                    notify={setNotice}
                    onRendering={setRendering}
                  />
                )}
              </>
            ) : (
              <div className="panel">
                <p className="hint">Create or select a clip to start editing.</p>
              </div>
            )}
          </aside>
        </div>
      );
    }
  }

  return (
    <>
      <AppShell
        screen={route.screen}
        title={header.title}
        subtitle={header.subtitle}
        actions={shellActions}
        saveState={route.screen === 'editor' ? saveState : 'idle'}
        settings={settings}
        bare={route.screen === 'editor'}
      >
        {content}
      </AppShell>

      {media && (
        <video
          ref={videoRef}
          className="hidden-video"
          src={media.url}
          playsInline
          preload="auto"
          crossOrigin="anonymous"
        />
      )}
      <canvas ref={exportCanvasRef} className="export-canvas" width={1080} height={1920} aria-hidden />

      {notice && <div className="toast">{notice}</div>}
    </>
  );
}
