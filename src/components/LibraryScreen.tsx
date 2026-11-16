import { useMemo, useState } from 'react';
import { fmt } from '../lib/format';
import { relativeTime, api } from '../lib/store';
import { navigate } from '../lib/router';
import type { Project, ProjectStatus } from '../types';
import { EmptyState, ConfirmDialog, StatusPill } from './ui';

type Props = {
  projects: Project[];
  loading: boolean;
  onOpenProject: (id: string) => void;
  onChanged: () => void;
  notify: (message: string) => void;
};

const FILTERS: { id: 'all' | ProjectStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'processing', label: 'Processing' },
  { id: 'ready', label: 'Ready' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Failed' },
];

export default function LibraryScreen({ projects, loading, onOpenProject, onChanged, notify }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ProjectStatus>('all');
  const [sort, setSort] = useState<'recent' | 'oldest' | 'name' | 'duration'>('recent');
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const list = projects.filter((project) => {
      if (filter !== 'all' && project.status !== filter) return false;
      if (!text) return true;
      return `${project.name} ${project.source?.name || ''} ${project.source?.platform || ''}`.toLowerCase().includes(text);
    });
    return list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'duration') return (b.source?.duration || 0) - (a.source?.duration || 0);
      if (sort === 'oldest') return a.updatedAt - b.updatedAt;
      return b.updatedAt - a.updatedAt;
    });
  }, [projects, query, filter, sort]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteProject(deleting.id);
      notify(`Deleted “${deleting.name}”.`);
      setDeleting(null);
      onChanged();
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-actions">
        <div className="seg">
          {FILTERS.map((entry) => (
            <button key={entry.id} className={filter === entry.id ? 'on' : ''} onClick={() => setFilter(entry.id)}>
              {entry.label}
            </button>
          ))}
        </div>
        <button className="btn btn-lime" onClick={() => navigate('/new')}>
          New project
        </button>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Search projects…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="input toolbar-select" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
          <option value="recent">Recently updated</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="duration">Longest source</option>
        </select>
      </div>

      {loading ? (
        <div className="card-loading">
          <span className="spinner sm" /> Loading projects…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="4" y="4" width="7" height="7" rx="1.6" />
              <rect x="13" y="4" width="7" height="7" rx="1.6" />
              <rect x="4" y="13" width="7" height="7" rx="1.6" />
              <rect x="13" y="13" width="7" height="7" rx="1.6" />
            </svg>
          }
          title={projects.length ? 'No projects match those filters' : 'Your library is empty'}
          action={
            <button className="btn btn-lime btn-sm" onClick={() => navigate('/new')}>
              Create a clip
            </button>
          }
        >
          {projects.length ? 'Try a different search or status.' : 'Projects you import or analyze are saved here automatically.'}
        </EmptyState>
      ) : (
        <div className="library-grid">
          {filtered.map((project) => (
            <article className="library-card" key={project.id}>
              <button className="library-thumb" onClick={() => onOpenProject(project.id)} aria-label={`Open ${project.name}`}>
                <span className="thumb-glow" />
                <span className="library-play" aria-hidden>
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="project-duration">{fmt(project.source?.duration || 0)}</span>
              </button>
              <div className="library-body">
                <div className="library-top">
                  <b>{project.name}</b>
                  <StatusPill status={project.status} />
                </div>
                <span className="library-source">
                  {project.source?.platform ? `${project.source.platform} · ` : ''}
                  {project.source?.name || 'No source'}
                </span>
                <div className="library-meta">
                  <span>{project.clips.length} clips</span>
                  <span>{project.aspect}</span>
                  <span>{relativeTime(project.updatedAt)}</span>
                </div>
                <div className="library-buttons">
                  <button className="btn btn-sm" onClick={() => onOpenProject(project.id)}>
                    Open editor
                  </button>
                  <button className="icon-btn danger" title="Delete project" onClick={() => setDeleting(project)}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete project?"
        body={
          <p>
            “{deleting?.name}” and its clip edits will be removed. The source video file stays on this computer if it was
            uploaded.
          </p>
        }
        confirmLabel={busy ? 'Deleting…' : 'Delete project'}
        danger
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
