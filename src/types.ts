export type PanPoint = { t: number; x: number };

export type MediaInfo = {
  name: string;
  url: string;
  duration: number;
  width: number;
  height: number;
  size: number;
};

export type Clip = {
  id: string;
  title: string;
  start: number;
  end: number;
  /** Horizontal crop position when not auto-tracking, 0 (left) .. 1 (right). */
  pan: number;
  /** Crop zoom, 1 = tightest 9:16 crop that fits the source height. */
  zoom: number;
  autoReframe: boolean;
  /** Sampled centres of motion/attention, absolute video times. */
  panTrack?: PanPoint[];
  score?: number;
  tracked?: boolean;
  /** Facecam tracking mode: 'auto' (detects webcam & action) | 'facecam' | 'action' */
  reframeMode?: 'auto' | 'facecam' | 'action';
  /** Detected facecam location in the source video */
  facecamDetected?: boolean;
  facecamPosition?: { x: number; y: number; w: number; h: number };
  /** Facecam crop pan position for split layout, 0 (left) .. 1 (right) */
  camPan?: number;
  /** Facecam crop zoom for split layout, 1 .. 3 */
  camZoom?: number;
  /** Split point between top (cam) and bottom (game), percentage of canvas height e.g. 0.38 */
  splitRatio?: number;
};

export type Cue = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export type CaptionStyle = {
  enabled: boolean;
  font: 'anton' | 'inter' | 'mono';
  /** Font size as a percentage of canvas height. */
  size: number;
  color: string;
  accent: string;
  uppercase: boolean;
  box: boolean;
  boxOpacity: number;
  /** Vertical centre of the caption block, 0..1 of canvas height. */
  y: number;
  /** Max line width, 0..1 of canvas width. */
  maxWidth: number;
  stroke: boolean;
};

export type Layout = 'fill' | 'split' | 'blur' | 'gradient' | 'solid';
export type FilterId = 'none' | 'vivid' | 'cinematic' | 'noir';

export type Style = {
  layout: Layout;
  bgA: string;
  bgB: string;
  /** Padding around the video card, percentage of canvas width. */
  padding: number;
  /** Corner radius in px at 1920px tall. */
  radius: number;
  filter: FilterId;
  progress: boolean;
  progressColor: string;
  handle: string;
  captions: CaptionStyle;
};

export type Suggestion = {
  id: string;
  start: number;
  end: number;
  title: string;
  score: number;
  hook?: string;
  reason?: string;
  excerpt?: string;
  hashtags?: string;
  /** true when this result came from the AI transcript pipeline, false for audio-only fallback. */
  aiGenerated?: boolean;
};

/** A single Whisper transcript segment. */
export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type AiStatus = {
  ready: boolean;
  engine: string | null;
  stt: { ready: boolean; python: string | null; model: string; detail: string };
  llm: { ready: boolean; model: string | null; models: string[]; detail: string };
  limits: { maxSeconds: number };
  checkedAt: number;
};

export type AiMoment = {
  start: number;
  end: number;
  title: string;
  hook: string;
  reason: string;
  excerpt: string;
  score: number;
  hashtags?: string;
};

export type AiJob = {
  id: string;
  status: 'running' | 'done' | 'error';
  stage: string;
  percent: number;
  error: string | null;
  model: string;
  result: {
    clips: AiMoment[];
    language: string;
    languageProbability: number;
    /** Full transcript segments for auto-captioning. */
    segments: TranscriptSegment[];
    transcriptSegments: number;
    words: number;
    engine: string;
    truncated: boolean;
    duration: number;
  } | null;
  createdAt: number;
  finishedAt: number | null;
  llmStartedAt: number | null;
};

export type TranscriptionJob = {
  id: string;
  status: 'running' | 'done' | 'error';
  stage: string;
  percent: number;
  error: string | null;
  result: { segments: TranscriptSegment[]; language: string; languageProbability: number; duration: number; engine: string } | null;
};

export type ConnectPlatform = 'twitch' | 'youtube' | 'kick';

export type Channel = {
  id: string;
  platform: ConnectPlatform;
  name: string;
  handle: string;
  url: string;
  avatar?: string;
  addedAt: number;
};

export type ChannelVod = {
  id: string;
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
  platform: ConnectPlatform;
  uploader?: string;
};

export type Aspect = '9:16' | '16:9' | '1:1';

export type ProjectStatus = 'draft' | 'processing' | 'ready' | 'scheduled' | 'published' | 'failed';

export type ProjectSource = {
  kind: 'url' | 'upload';
  url: string;
  /** Original platform VOD URL used to fetch its caption track, when available. */
  captionSource?: string;
  name: string;
  platform?: string;
  duration: number;
  width: number;
  height: number;
  /** When the source is a downloaded segment, where it starts in the original VOD. */
  segmentStart?: number;
};

export type Project = {
  id: string;
  name: string;
  source: ProjectSource | null;
  clips: Clip[];
  style: Style | null;
  cues: Cue[];
  aspect: Aspect;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
};

export type DestinationId = 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'x';

export type ScheduleStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export type SchedulePost = {
  id: string;
  projectId: string | null;
  clipId: string | null;
  title: string;
  caption: string;
  hashtags: string;
  when: string;
  timezone: string;
  destinations: DestinationId[];
  status: ScheduleStatus;
  note: string;
  createdAt: number;
  updatedAt: number;
};

export type CaptionTemplate = {
  id: string;
  name: string;
  style: Style | null;
  createdAt: number;
};

export type WorkspaceSettings = {
  workspaceName: string;
  defaultAspect: Aspect;
  defaultClipLength: number;
  timezone: string;
  geminiApiKey?: string;
  geminiModel?: string;
  aiEngine?: 'ollama' | 'gemini' | 'openai' | 'claude' | 'deepseek';
  openaiApiKey?: string;
  openaiModel?: string;
  claudeApiKey?: string;
  claudeModel?: string;
  deepseekApiKey?: string;
  deepseekModel?: string;
};

export type ViralPackage = {
  titles: string[];
  hook: string;
  caption: string;
  hashtags: string[];
  viralityScore: number;
  retentionTip: string;
  modelUsed?: string;
};

export type GeminiStatus = {
  ready: boolean;
  configured: boolean;
  source: 'env' | 'settings' | null;
  model: string;
  models: { id: string; label: string }[];
  detail: string;
};

export type Health = {
  ok: boolean;
  ytdlp: boolean;
  ytdlpVersion?: string;
  ytdlpSource?: string;
  ffmpeg: boolean;
  ffprobe: boolean;
};

export const DEFAULT_STYLE: Style = {
  layout: 'blur',
  bgA: '#1a1033',
  bgB: '#3b1d6e',
  padding: 4,
  radius: 34,
  filter: 'vivid',
  progress: true,
  progressColor: '#c4b5fd',
  handle: '@yourhandle',
  captions: {
    enabled: true,
    font: 'anton',
    size: 5.2,
    color: '#ffffff',
    accent: '#fde047',
    uppercase: true,
    box: false,
    boxOpacity: 0.55,
    y: 0.82,
    maxWidth: 0.86,
    stroke: true,
  },
};
