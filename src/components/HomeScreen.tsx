import { useEffect, useRef, useState } from 'react';
import { fmt } from '../lib/format';
import { relativeTime, api } from '../lib/store';
import { navigate } from '../lib/router';
import type { AiJob, Project, SchedulePost, WorkspaceSettings } from '../types';
import { StatusPill } from './ui';

type Props = {
  settings: WorkspaceSettings | null;
  projects: Project[];
  schedules: SchedulePost[];
  channels: { id: string; platform: string; name: string }[];
  loading: boolean;
  onImportUrl: (url: string) => void;
  onUpload: (file: File) => void;
  onOpenProject: (id: string) => void;
};

const PLATFORM_OF = (val: string) => {
  const lower = val.toLowerCase();
  if (lower.includes('twitch.tv')) return 'twitch';
  if (lower.includes('kick.com')) return 'kick';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  return null;
};

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
  const [job, setJob] = useState<AiJob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      api
        .aiJobs()
        .then((jobs) => alive && setJob(jobs?.find((j) => j.status === 'running') ?? null))
        .catch(() => alive && setJob(null));
    tick();
    const timer = window.setInterval(tick, 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const recent = projects.slice(0, 6);
  const platform = PLATFORM_OF(url);
  const clipCount = projects.reduce((total, p) => total + p.clips.length, 0);
  const queued = schedules.filter((s) => s.status === 'scheduled').length;
  const resume = projects.find((p) => p.status === 'ready') ?? null;

  const submit = () => {
    const value = url.trim();
    if (!value) {
      setError('Paste a stream or VOD link to start.');
      inputRef.current?.focus();
      return;
    }
    if (!/^https?:\/\//i.test(value)) {
      setError('Needs a full URL — e.g. https://www.twitch.tv/videos/123');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    navigate(`/ai-clips?url=${encodeURIComponent(value)}&platform=${platform ?? 'youtube'}`);
  };

  return (
    <div className="page home">
      {/* ---------- NOW ---------- */}
      <section className="hm-now">
        <div className="hm-now-state">
          <span className={`hm-led${job ? ' live' : ''}`} />
          <div>
            <div className="hm-now-kicker">{job ? 'CLIPPING NOW' : 'ENGINE IDLE'}</div>
            <div className="hm-now-line">
              {job ? (
                <>
                  <span className="hm-now-stage">{job.stage}</span>
                  <span className="hm-now-pct">{Math.round(job.percent)}%</span>
                  <span className="hm-now-bar">
                    <span style={{ width: `${Math.max(2, job.percent)}%` }} />
                  </span>
                </>
              ) : (
                <span className="hm-now-rest">
                  {loading ? 'reading workspace…' : 'nothing rendering — paste a link below'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="hm-stats">
          <div className="hm-stat">
            <b>{projects.length}</b>
            <span>projects</span>
          </div>
          <div className="hm-stat">
            <b>{clipCount}</b>
            <span>clips</span>
          </div>
          <div className="hm-stat">
            <b>{queued}</b>
            <span>queued</span>
          </div>
          <div className="hm-stat">
            <b>{channels.length}</b>
            <span>sources</span>
          </div>
        </div>
      </section>

      {/* ---------- INTAKE + SIDE ---------- */}
      <div className="hm-cols">
        <section className="hm-intake">
          <div className="hm-kicker">
            <span>Intake</span>
            <em>YouTube · Twitch · Kick · file</em>
          </div>
          <h2>
            Turn a stream into
            <br />
            clips worth posting.
          </h2>

          <div className={`hm-field${error ? ' bad' : ''}${url ? ' filled' : ''}`}>
            <span className="hm-field-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
                <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
              </svg>
            </span>
            <input
              ref={inputRef}
              className="hm-input"
              placeholder="https://www.twitch.tv/videos/…"
              value={url}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {platform && <span className={`hm-tag hm-tag-${platform}`}>{platform}</span>}
            {url && !platform && <span className="hm-tag hm-tag-generic">generic</span>}
            {url && (
              <button className="hm-clear" onClick={() => setUrl('')} aria-label="Clear link">
                ✕
              </button>
            )}
            <button className="hm-go" onClick={submit}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3 1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" />
              </svg>
              Auto-clip
            </button>
          </div>
          {error && <p className="hm-error">{error}</p>}

          <div className="hm-intake-foot">
            <button className="hm-textbtn" onClick={() => fileRef.current?.click()}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 16V5m0 0L8 9m4-4 4 4" />
                <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
              </svg>
              or drop a local file
            </button>
            <span className="hm-dot-sep" />
            <span className="hm-hint">
              {settings?.aiEngine === 'ollama' ? 'local model' : (settings?.aiEngine ?? 'no model configured')}
            </span>
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

          <ol className="hm-steps">
            <li>
              <b>01</b>
              <span>pull the VOD</span>
              <em>yt-dlp + ffmpeg</em>
            </li>
            <li>
              <b>02</b>
              <span>transcribe</span>
              <em>word-level cues</em>
            </li>
            <li>
              <b>03</b>
              <span>score moments</span>
              <em>hooks, punchlines</em>
            </li>
            <li>
              <b>04</b>
              <span>reframe 9:16</span>
              <em>export ready to post</em>
            </li>
          </ol>
        </section>

        <aside className="hm-side">
          {resume && (
            <div className="hm-block">
              <div className="hm-kicker"><span>Resume</span></div>
              <button className="hm-resume" onClick={() => onOpenProject(resume.id)}>
                <span className="hm-resume-name">{resume.name}</span>
                <span className="hm-resume-meta">
                  {resume.clips.length} clips · {fmt(resume.source?.duration ?? 0)}
                </span>
                <span className="hm-resume-go">open editor →</span>
              </button>
            </div>
          )}

          <div className="hm-block">
            <div className="hm-kicker">
              <span>Publishing</span>
              <em>{queued ? `${queued} queued` : 'manual plans'}</em>
            </div>
            <p className="hm-block-body">
              OAuth isn't wired up, so the Publisher writes plans you post yourself. Link import and
              rendering work without it.
            </p>
            <button className="hm-textbtn" onClick={() => navigate('/publisher')}>
              open scheduler →
            </button>
          </div>

          <div className="hm-block">
            <div className="hm-kicker"><span>Also here</span></div>
            <div className="hm-links">
              <button onClick={() => navigate('/library')}>Montage — stitch exports</button>
              <button onClick={() => navigate('/analytics')}>Clip performance</button>
              <button onClick={() => navigate('/connections')}>Channel sources</button>
              <button onClick={() => navigate('/settings')}>Engine &amp; keys</button>
            </div>
          </div>
        </aside>
      </div>

      {/* ---------- RECENT ---------- */}
      <section className="hm-recent">
        <div className="hm-kicker">
          <span>Recent</span>
          {recent.length > 0 && <button className="hm-more" onClick={() => navigate('/library')}>all projects →</button>}
        </div>

        {loading ? (
          <div className="hm-loading"><span className="spinner sm" /> loading projects…</div>
        ) : recent.length === 0 ? (
          <div className="hm-empty">
            <p>Nothing here yet.</p>
            <span>
              Paste a stream link above — StreamCut pulls the VOD, transcribes it, and scores the
              moments worth cutting.
            </span>
          </div>
        ) : (
          <div className="hm-grid">
            {recent.map((project) => (
              <button className="hm-card" key={project.id} onClick={() => onOpenProject(project.id)}>
                <div className="hm-card-thumb">
                  <span className="hm-card-dur">{fmt(project.source?.duration ?? 0)}</span>
                  <span className="hm-card-play">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
                <div className="hm-card-body">
                  <span className="hm-card-name">{project.name}</span>
                  <div className="hm-card-meta">
                    <StatusPill status={project.status} />
                    <span>{project.clips.length}c</span>
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
