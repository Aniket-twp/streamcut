import { useEffect, useState, type ReactNode } from 'react';
import { navigate, type Screen } from '../lib/router';
import { api } from '../lib/store';
import type { Health, WorkspaceSettings } from '../types';
import LiquidBackground from './LiquidBackground';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type NavItem = { screen: Screen; label: string; icon: ReactNode };

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);

const MAIN_NAV: NavItem[] = [
  { screen: 'home', label: 'Home', icon: icon(<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />) },
  { screen: 'ai-clips', label: 'ClipGPT', icon: icon(<path d="m12 6 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" stroke="currentColor" fill="none" />) },
  { screen: 'editor', label: 'Editor', icon: icon(<><rect x="6" y="2" width="12" height="20" rx="3" /><polygon points="10 8 16 12 10 16" fill="none" /></>) },
  { screen: 'library', label: 'Library', icon: icon(<><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m9.5 8.5 5 3.5-5 3.5z" /></>) },
  { screen: 'publisher', label: 'Scheduler', icon: icon(<><rect x="3" y="4" width="18" height="18" rx="3" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>) },
];

const SECONDARY_NAV: NavItem[] = [
  { screen: 'analytics', label: 'Analytics', icon: icon(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>) },
  { screen: 'connections', label: 'Connections', icon: icon(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>) },
  { screen: 'settings', label: 'Settings', icon: icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>) },
];

const DOCK_ITEMS: NavItem[] = [
  { screen: 'home', label: 'Home', icon: icon(<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />) },
  { screen: 'ai-clips', label: 'ClipGPT', icon: icon(<path d="m12 6 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" stroke="currentColor" fill="none" />) },
  { screen: 'editor', label: 'Editor', icon: icon(<><rect x="6" y="2" width="12" height="20" rx="3" /><polygon points="10 8 16 12 10 16" fill="none" /></>) },
  { screen: 'library', label: 'Library', icon: icon(<><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m9.5 8.5 5 3.5-5 3.5z" /></>) },
  { screen: 'publisher', label: 'Scheduler', icon: icon(<><rect x="3" y="4" width="18" height="18" rx="3" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>) },
  { screen: 'settings', label: 'Settings', icon: icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>) },
];

export default function AppShell({
  screen,
  title,
  subtitle,
  actions,
  saveState = 'idle',
  settings,
  bare,
  children,
}: {
  screen: Screen;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  saveState?: SaveState;
  settings: WorkspaceSettings | null;
  bare?: boolean;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [activeJob, setActiveJob] = useState<{ id: string; stage: string; percent: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const pollJobs = () => {
      api
        .aiJobs()
        .then((jobs) => {
          if (!alive) return;
          const running = jobs?.find((j) => j.status === 'running');
          setActiveJob(running ? { id: running.id, stage: running.stage, percent: running.percent } : null);
        })
        .catch(() => {
          if (!alive) return;
          setActiveJob(null);
        });
    };
    pollJobs();
    const timer = window.setInterval(pollJobs, 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const check = () => {
      api
        .health()
        .then((value) => {
          if (!alive) return;
          setHealth(value);
          setHealthError(false);
        })
        .catch(() => {
          if (!alive) return;
          setHealth(null);
          setHealthError(true);
        });
    };
    check();
    const timer = window.setInterval(check, 60000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => setDrawer(false), [screen]);

  const go = (target: Screen) => {
    if (target === 'editor') {
      const last = window.localStorage.getItem('streamcut:lastProject');
      navigate(last ? `/editor/${last}` : '/library');
      return;
    }
    navigate(target === 'home' ? '/' : `/${target}`);
  };

  const navGroup = (label: string, items: NavItem[]) => (
    <div className="nav-group">
      <span className="nav-label">{label}</span>
      {items.map((item) => (
        <button
          key={item.screen}
          className={`nav-item${screen === item.screen ? ' active' : ''}`}
          onClick={() => go(item.screen)}
          aria-current={screen === item.screen ? 'page' : undefined}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  const engineReady = Boolean(health?.ok);
  const engineLabel = healthError
    ? 'Cloud server reconnecting'
    : '☁️ Cloud Engine Ready';

  return (
    <div className="shell">
      <LiquidBackground />
      <aside className={`sidebar${drawer ? ' open' : ''}`}>
        <div className="sidebar-head">
          <button className="sidebar-brand" onClick={() => navigate('/')} aria-label="StreamCut home">
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
              </svg>
            </span>
            <span className="brand-name">StreamCut</span>
          </button>
          <button className="icon-btn sidebar-close-btn" onClick={() => setDrawer(false)} aria-label="Close navigation">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <button className="btn btn-lime sidebar-create" onClick={() => go('new')}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create clip
        </button>

        <nav className="sidebar-nav">
          {navGroup('Tools', MAIN_NAV)}
          {navGroup('Workspace', SECONDARY_NAV)}
        </nav>

        <div className="sidebar-foot">
          <div className="workspace-card">
            <span className="workspace-avatar">{(settings?.workspaceName || 'W').slice(0, 1).toUpperCase()}</span>
            <div>
              <b>{settings?.workspaceName || 'My workspace'}</b>
              <span>Cloud workspace</span>
            </div>
          </div>
        </div>
      </aside>

      {drawer && <div className="sidebar-scrim" onClick={() => setDrawer(false)} />}

      <div className="shell-main">
        <header className="shell-top">
          <button className="icon-btn shell-menu" onClick={() => setDrawer((value) => !value)} aria-label="Open navigation">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          {/* Forward and Backward Browser-Style Navigation Buttons */}
          <div className="nav-history-controls" aria-label="Page navigation">
            <button
              className="icon-btn nav-history-btn"
              onClick={() => window.history.back()}
              title="Go back (Back)"
              aria-label="Go back"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              className="icon-btn nav-history-btn"
              onClick={() => window.history.forward()}
              title="Go forward (Forward)"
              aria-label="Go forward"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="shell-title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <div className="shell-actions">
            {activeJob && (
              <button
                className="global-job-pill"
                onClick={() => navigate('/ai-clips')}
                title={`ClipGPT is active: ${activeJob.stage} (${activeJob.percent}%) — click to view`}
              >
                <span className="job-pulse-dot" />
                <span>Clipping: {activeJob.stage} ({activeJob.percent}%)</span>
                <div className="job-progress-mini">
                  <div className="job-progress-mini-bar" style={{ width: `${Math.max(5, activeJob.percent)}%` }} />
                </div>
              </button>
            )}
            {saveState !== 'idle' && (
              <span className={`save-state ${saveState}`}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save failed'}
              </span>
            )}
            {actions}
            <button
              className={`engine-chip${engineReady ? ' ready' : ''}`}
              title={
                health
                  ? `yt-dlp ${health.ytdlpVersion || 'missing'} (${health.ytdlpSource || '—'}) · ffmpeg ${health.ffmpeg ? 'ready' : 'missing'}`
                  : 'Local server status'
              }
              onClick={() => navigate('/settings')}
            >
              <span className="dot" />
              {engineLabel}
            </button>
            <button className="workspace-menu" onClick={() => navigate('/settings')} title="Workspace settings">
              {(settings?.workspaceName || 'W').slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        <main className={`shell-content${bare ? ' bare' : ''}`}>{children}</main>

        {/* Clean, Stable Native Mobile Bottom Navigation */}
        <nav className="mobile-tab-bar" aria-label="Mobile navigation">
          {DOCK_ITEMS.map((item) => {
            const isActive = screen === item.screen;
            return (
              <button
                key={item.screen}
                className={`mobile-tab-btn${isActive ? ' active' : ''}`}
                onClick={() => go(item.screen)}
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
              >
                <div className="tab-icon">{item.icon}</div>
                <span className="tab-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
