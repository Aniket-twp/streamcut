import { useRef, useState } from 'react';
import { fmt, fmtTenths } from '../lib/format';
import { relativeTime } from '../lib/store';
import { navigate } from '../lib/router';
import type { Channel, Project, SchedulePost, WorkspaceSettings } from '../types';
import { EmptyState, SectionHead, StatusPill } from './ui';

type Props = {
  settings: WorkspaceSettings | null;
  projects: Project[];
  schedules: SchedulePost[];
  channels: Channel[];
  loading: boolean;
  onImportUrl: (url: string) => void;
  onUpload: (file: File) => void;
  onOpenProject: (id: string) => void;
};

const STREAM_TOOLS = [
  {
    id: 'clipgpt',
    title: 'ClipGPT',
    desc: 'DeepSeek V4.1 & Gemini auto-find viral hooks',
    path: '/ai-clips',
    color: '#38bdf8',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="3" />
        <path d="m12 6 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" stroke="#38bdf8" fill="rgba(56, 189, 248, 0.2)" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'clip-editor',
    title: 'Clip Editor',
    desc: 'Edit portrait clips for TikTok & Reels',
    path: '/editor',
    color: '#4ade80',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="2" width="12" height="20" rx="3" stroke="#4ade80" />
        <polygon points="10 8 16 12 10 16" fill="rgba(74, 222, 128, 0.25)" stroke="#4ade80" />
      </svg>
    ),
  },
  {
    id: 'video-editor',
    title: 'Video Editor',
    desc: 'Edit landscape clips for YouTube',
    path: '/editor',
    color: '#f472b6',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="15" rx="3" stroke="#f472b6" />
        <polygon points="10 8.5 16 12 10 15.5" fill="rgba(244, 114, 182, 0.25)" stroke="#f472b6" />
      </svg>
    ),
  },
  {
    id: 'scheduler',
    title: 'Scheduler',
    desc: 'Schedule posts across platforms',
    path: '/publisher',
    color: '#facc15',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="3" stroke="#facc15" />
        <line x1="16" y1="2" x2="16" y2="6" stroke="#facc15" />
        <line x1="8" y1="2" x2="8" y2="6" stroke="#facc15" />
        <line x1="3" y1="10" x2="21" y2="10" stroke="#facc15" />
        <path d="m9 16 2 2 4-4" stroke="#facc15" />
      </svg>
    ),
  },
  {
    id: 'montage-maker',
    title: 'Montage Maker',
    desc: 'Stitch exported clips into one video',
    path: '/library',
    color: '#c084fc',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="9" height="16" rx="2" stroke="#c084fc" />
        <rect x="13" y="4" width="9" height="16" rx="2" stroke="#c084fc" />
        <line x1="7" y1="12" x2="17" y2="12" stroke="#c084fc" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    id: 'schedule-maker',
    title: 'Schedule Maker',
    desc: 'Create stream schedules',
    path: '/publisher',
    color: '#60a5fa',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="3" stroke="#60a5fa" />
        <line x1="8" y1="7" x2="16" y2="7" stroke="#60a5fa" />
        <line x1="8" y1="12" x2="16" y2="12" stroke="#60a5fa" />
        <line x1="8" y1="17" x2="13" y2="17" stroke="#60a5fa" />
      </svg>
    ),
  },
];

const PUBLISHING_DESTINATIONS = [
  { id: 'tiktok', name: 'TikTok', color: '#00f2fe', icon: 'T' },
  { id: 'youtube', name: 'YouTube / Shorts', color: '#ff0000', icon: 'Y' },
  { id: 'instagram', name: 'Instagram Reels', color: '#e1306c', icon: 'I' },
  { id: 'facebook', name: 'Facebook Reels', color: '#1877f2', icon: 'F' },
  { id: 'x', name: 'X', color: '#f5f5f5', icon: 'X' },
];

function detectPlatform(val: string): 'youtube' | 'twitch' | 'kick' | 'generic' {
  const lower = val.toLowerCase();
  if (lower.includes('twitch.tv')) return 'twitch';
  if (lower.includes('kick.com')) return 'kick';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  return 'generic';
}

export default function HomeScreen({
  settings,
  projects,
  schedules,
  channels,
  loading,
  onImportUrl,
  onUpload,
  onOpenProject,
}: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const detected = detectPlatform(url);
  const recent = projects.slice(0, 4);
  const processing = projects.filter((project) => project.status === 'processing');
  const continues = projects.find((project) => project.status === 'ready') ?? null;

  const submit = () => {
    const value = url.trim();
    if (!value) {
      setError('Paste a YouTube, Twitch, or Kick stream link first.');
      return;
    }
    if (!/^https?:\/\//i.test(value)) {
      setError('Use a full link (e.g. https://www.twitch.tv/videos/123 or https://youtube.com/watch?v=...).');
      return;
    }
    setError(null);
    const plat = detected === 'generic' ? 'youtube' : detected;
    navigate(`/ai-clips?url=${encodeURIComponent(value)}&platform=${plat}`);
  };

  return (
    <div className="page home-page sl-dashboard">
      {/* StreamLadder TOOLS Carousel Section */}
      <section className="sl-section">
        <div className="sl-section-head">
          <span className="sl-section-title">TOOLS</span>
          <div className="sl-carousel-arrows">
            <button className="sl-arrow-btn" aria-label="Previous tools">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button className="sl-arrow-btn" aria-label="Next tools">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="sl-tools-grid">
          {STREAM_TOOLS.map((tool) => (
            <button key={tool.id} className="sl-tool-card" onClick={() => navigate(tool.path)}>
              <div className="sl-tool-icon-wrap" style={{ color: tool.color }}>
                {tool.icon}
              </div>
              <div className="sl-tool-info">
                <span className="sl-tool-title">{tool.title}</span>
                <span className="sl-tool-desc">{tool.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* StreamLadder Unified Stream Link Composer */}
      <section className="sl-composer-card">
        <div className="sl-composer-header">
          <div className="sl-platform-badges">
            <span className={`sl-badge${detected === 'twitch' ? ' active' : ''}`}>
              <span className="dot" style={{ background: '#a855f7' }} /> Twitch
            </span>
            <span className={`sl-badge${detected === 'youtube' ? ' active' : ''}`}>
              <span className="dot" style={{ background: '#ef4444' }} /> YouTube
            </span>
            <span className={`sl-badge${detected === 'kick' ? ' active' : ''}`}>
              <span className="dot" style={{ background: '#22c55e' }} /> Kick
            </span>
          </div>
          <h2>Turn streams into viral TikTok, Shorts & Reels</h2>
        </div>

        <div className="sl-input-wrapper">
          <div className="sl-input-box">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sl-link-icon">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <input
              className="sl-main-input"
              placeholder="Paste a Twitch, YouTube, or Kick stream / VOD link…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
            {url && (
              <button className="sl-clear-btn" onClick={() => setUrl('')}>
                ✕
              </button>
            )}
          </div>
          <button className="sl-cta-btn" onClick={submit}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3 1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" />
            </svg>
            Auto-clip with AI
          </button>
        </div>
        {error && <div className="sl-error-notice">{error}</div>}

        <div className="sl-composer-foot">
          <button className="sl-upload-trigger" onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5" />
              <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
            </svg>
            Or upload video file from computer
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      {/* StreamLadder Publishing Destinations Section */}
      <section className="sl-section">
        <div className="sl-section-head">
          <div className="sl-dest-head-title">
            <span className="sl-section-title">Publishing destinations</span>
            <p className="sl-section-sub">Required before the Publisher can send posts automatically.</p>
          </div>
          <span className="sl-setup-badge">SETUP REQUIRED</span>
        </div>

        <div className="sl-dest-grid">
          {PUBLISHING_DESTINATIONS.map((dest) => (
            <div key={dest.id} className="sl-dest-card">
              <div className="sl-dest-top">
                <div className="sl-dest-avatar" style={{ background: dest.color }}>
                  {dest.icon}
                </div>
                <div className="sl-dest-meta">
                  <span className="sl-dest-name">{dest.name}</span>
                  <span className="sl-dest-status">Not connected · last checked never</span>
                </div>
              </div>
              <div className="sl-dest-actions">
                <button className="sl-dest-connect-btn" onClick={() => navigate('/connections')}>
                  Connect
                </button>
                <button className="sl-dest-setup-link" onClick={() => navigate('/connections')}>
                  Credential setup
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="sl-dest-footnote">
          Until OAuth is configured, the Publisher saves manual plans only. URL and file import keep working without any of these connections.
        </p>
      </section>

      {/* Recent projects */}
      <section className="sl-section">
        <div className="sl-section-head">
          <span className="sl-section-title">Recent projects</span>
          {recent.length > 0 && (
            <button className="sl-link-btn" onClick={() => navigate('/library')}>
              View all in library →
            </button>
          )}
        </div>

        {loading ? (
          <div className="card-loading">
            <span className="spinner sm" /> Loading projects…
          </div>
        ) : recent.length === 0 ? (
          <div className="sl-empty-projects">
            <p>No projects yet. Paste a stream link above or click ClipGPT to get started.</p>
          </div>
        ) : (
          <div className="sl-project-grid">
            {recent.map((project) => (
              <button className="sl-project-card" key={project.id} onClick={() => onOpenProject(project.id)}>
                <div className="sl-project-thumb">
                  <span className="sl-project-duration">{fmt(project.source?.duration ?? 0)}</span>
                  <span className="sl-thumb-play">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
                <div className="sl-project-body">
                  <span className="sl-project-name">{project.name}</span>
                  <div className="sl-project-meta">
                    <StatusPill status={project.status} />
                    <span>{project.clips.length} clip{project.clips.length === 1 ? '' : 's'}</span>
                    <span>{relativeTime(project.updatedAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
