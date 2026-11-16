import { useMemo, useState } from 'react';
import { navigate } from '../lib/router';
import { api } from '../lib/store';
import type { DestinationId, Project, SchedulePost, WorkspaceSettings } from '../types';
import { ConfirmDialog, EmptyState, SectionHead, StatusPill } from './ui';

const DESTINATIONS: { id: DestinationId; label: string; color: string; upload: string }[] = [
  { id: 'tiktok', label: 'TikTok', color: '#25f4ee', upload: 'https://www.tiktok.com/tiktokstudio/upload' },
  { id: 'youtube', label: 'YouTube Shorts', color: '#ff4e45', upload: 'https://studio.youtube.com' },
  { id: 'instagram', label: 'Instagram Reels', color: '#e1306c', upload: 'https://www.instagram.com/' },
  { id: 'facebook', label: 'Facebook Reels', color: '#1877f2', upload: 'https://www.facebook.com/reels/create' },
  { id: 'x', label: 'X', color: '#e7e9ea', upload: 'https://x.com/compose/post' },
];

type Props = {
  schedules: SchedulePost[];
  projects: Project[];
  settings: WorkspaceSettings | null;
  loading: boolean;
  onChanged: () => void;
  notify: (message: string) => void;
};

type Form = {
  id: string | null;
  projectId: string;
  clipId: string;
  title: string;
  caption: string;
  hashtags: string;
  when: string;
  destinations: DestinationId[];
};

const emptyForm: Form = {
  id: null,
  projectId: '',
  clipId: '',
  title: '',
  caption: '',
  hashtags: '#shorts #reels #stream',
  when: '',
  destinations: [],
};

export default function PublisherScreen({ schedules, projects, settings, loading, onChanged, notify }: Props) {
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SchedulePost | null>(null);
  const [publishing, setPublishing] = useState<SchedulePost | null>(null);

  const project = projects.find((entry) => entry.id === form.projectId) ?? null;
  const timezone = settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const upcoming = useMemo(
    () =>
      [...schedules]
        .filter((schedule) => schedule.status !== 'published' && schedule.status !== 'failed')
        .sort((a, b) => String(a.when).localeCompare(String(b.when))),
    [schedules],
  );
  const history = schedules.filter((schedule) => schedule.status === 'published' || schedule.status === 'failed');

  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  const pickProject = (projectId: string) => {
    const selected = projects.find((entry) => entry.id === projectId);
    set({
      projectId,
      clipId: selected?.clips[0]?.id ?? '',
      title: selected?.clips[0]?.title ?? selected?.name ?? '',
    });
  };

  const pickClip = (clipId: string) => {
    const clip = project?.clips.find((entry) => entry.id === clipId);
    set({ clipId, title: clip?.title ?? form.title });
  };

  const toggleDestination = (id: DestinationId) => {
    set({
      destinations: form.destinations.includes(id)
        ? form.destinations.filter((entry) => entry !== id)
        : [...form.destinations, id],
    });
  };

  const reset = () => {
    setForm(emptyForm);
    setError(null);
  };

  const generateWithGemini = async () => {
    if (!form.projectId) {
      notify('Please choose a project first.');
      return;
    }
    setAiGenerating(true);
    try {
      const selectedClip = project?.clips.find((c) => c.id === form.clipId);
      const pkg = await api.generateViralPackage({
        clipTitle: selectedClip?.title || form.title || project?.name || 'Untitled Clip',
        duration: selectedClip ? selectedClip.end - selectedClip.start : 30,
        platform: form.destinations[0] || 'shorts',
      });
      set({
        title: pkg.titles[0] || form.title,
        caption: pkg.caption,
        hashtags: pkg.hashtags.join(' '),
      });
      notify(`✨ Gemini generated viral post! (Score: ${pkg.viralityScore}/100)`);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setAiGenerating(false);
    }
  };

  const save = async () => {
    setError(null);
    if (!form.title.trim()) {
      setError('Give the post a title.');
      return;
    }
    if (!form.destinations.length) {
      setError('Choose at least one destination for the plan.');
      return;
    }
    setBusy(true);
    try {
      const payload: Partial<SchedulePost> = {
        projectId: form.projectId || null,
        clipId: form.clipId || null,
        title: form.title.trim(),
        caption: form.caption,
        hashtags: form.hashtags,
        when: form.when ? new Date(form.when).toISOString() : '',
        timezone,
        destinations: form.destinations,
        status: 'draft',
        note: 'Manual plan — no publishing API is connected in this build.',
      };
      if (form.id) await api.updateSchedule(form.id, payload);
      else await api.createSchedule(payload);
      notify(form.id ? 'Plan updated.' : 'Post planned. Nothing will publish automatically.');
      reset();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const edit = (schedule: SchedulePost) => {
    setForm({
      id: schedule.id,
      projectId: schedule.projectId || '',
      clipId: schedule.clipId || '',
      title: schedule.title,
      caption: schedule.caption,
      hashtags: schedule.hashtags,
      when: schedule.when ? new Date(schedule.when).toISOString().slice(0, 16) : '',
      destinations: schedule.destinations,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteSchedule(deleting.id);
      if (form.id === deleting.id) reset();
      setDeleting(null);
      notify('Plan removed.');
      onChanged();
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const markPublished = async () => {
    if (!publishing) return;
    setBusy(true);
    try {
      await api.updateSchedule(publishing.id, { status: 'published' });
      setPublishing(null);
      notify('Marked as published in this workspace. Platform metrics are not verified.');
      onChanged();
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page publisher-page">
      <div className="publisher-grid">
        <section className="panel-card">
          <h3>{form.id ? 'Edit planned post' : 'Plan a post'}</h3>
          <div className="notice">
            <b>Manual publishing only</b>
            <p>
              No social APIs are connected, so nothing is sent to a platform. You post from each network’s uploader and
              record it here. {settings?.timezone ? `Times are set in ${settings.timezone}.` : ''}
            </p>
          </div>

          <label className="field">
            <span>Project</span>
            <select className="input" value={form.projectId} onChange={(event) => pickProject(event.target.value)}>
              <option value="">Choose a project…</option>
              {projects.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          {form.projectId && (
            <label className="field">
              <span>Clip</span>
              <select className="input" value={form.clipId} onChange={(event) => pickClip(event.target.value)}>
                <option value="">Entire project</option>
                {(project?.clips ?? []).map((clip) => (
                  <option key={clip.id} value={clip.id}>
                    {clip.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {form.projectId && (
            <div style={{ margin: '4px 0 12px 0' }}>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => void generateWithGemini()}
                disabled={aiGenerating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'rgba(99, 102, 241, 0.12)',
                  borderColor: 'rgba(99, 102, 241, 0.3)',
                  color: '#c7d2fe',
                }}
              >
                {aiGenerating ? '✨ Generating copy with Gemini…' : '✨ Auto-fill Title, Caption & Tags with Gemini'}
              </button>
            </div>
          )}

          <label className="field">
            <span>Post title</span>
            <input className="input" value={form.title} onChange={(event) => set({ title: event.target.value })} placeholder="Clutch play of the night" />
          </label>

          <label className="field">
            <span>Caption</span>
            <textarea className="input textarea" rows={4} value={form.caption} onChange={(event) => set({ caption: event.target.value })} placeholder="Write the caption for this clip…" />
          </label>

          <label className="field">
            <span>Hashtags</span>
            <input className="input" value={form.hashtags} onChange={(event) => set({ hashtags: event.target.value })} />
          </label>

          <label className="field">
            <span>Publish at ({timezone})</span>
            <input className="input" type="datetime-local" value={form.when} onChange={(event) => set({ when: event.target.value })} />
          </label>

          <div className="field">
            <span>Destinations</span>
            <div className="destination-picks">
              {DESTINATIONS.map((destination) => (
                <label key={destination.id} className={`destination-pick${form.destinations.includes(destination.id) ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.destinations.includes(destination.id)}
                    onChange={() => toggleDestination(destination.id)}
                  />
                  <span className="platform-dot" style={{ background: destination.color }} />
                  {destination.label}
                </label>
              ))}
            </div>
            <p className="hint">
              All destinations are unconnected. Selecting one only plans the post — connect APIs in Connections to enable
              real publishing.
            </p>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="row">
            <button className="btn btn-lime flex1" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : form.id ? 'Update plan' : 'Save planned post'}
            </button>
            {form.id && (
              <button className="btn" onClick={reset}>
                Cancel edit
              </button>
            )}
          </div>
        </section>

        <section className="panel-card">
          <SectionHead
            title="Queue"
            sub="Planned posts, soonest first."
            action={
              <button className="btn btn-sm" onClick={() => navigate('/connections')}>
                Manage destinations
              </button>
            }
          />
          {loading ? (
            <div className="card-loading">
              <span className="spinner sm" /> Loading schedule…
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState title="Nothing planned">Use the form to plan a post. It will appear here until you mark it published.</EmptyState>
          ) : (
            <div className="stack-list">
              {upcoming.map((schedule) => (
                <article className="queue-row" key={schedule.id}>
                  <div className="queue-when">
                    <b>{schedule.when ? new Date(schedule.when).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}</b>
                    <span>{schedule.when ? new Date(schedule.when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                  </div>
                  <div className="queue-main">
                    <b>{schedule.title}</b>
                    <span className="queue-tags">
                      {schedule.destinations.map((destination) => (
                        <span key={destination} className="tag">
                          {DESTINATIONS.find((entry) => entry.id === destination)?.label ?? destination}
                        </span>
                      ))}
                      <StatusPill status={schedule.status} />
                    </span>
                  </div>
                  <div className="queue-actions">
                    <button className="btn btn-sm" onClick={() => edit(schedule)}>
                      Edit
                    </button>
                    <button className="btn btn-sm" onClick={() => setPublishing(schedule)}>
                      Mark published
                    </button>
                    <button className="icon-btn danger" title="Delete plan" onClick={() => setDeleting(schedule)}>
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {history.length > 0 && (
            <>
              <SectionHead title="History" sub="Marked published or failed in this workspace." />
              <div className="stack-list">
                {history.map((schedule) => (
                  <div className="list-row" key={schedule.id}>
                    <span className="list-row-main">
                      <b>{schedule.title}</b>
                      <span>{schedule.destinations.join(', ') || 'No destinations'}</span>
                    </span>
                    <StatusPill status={schedule.status} />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="panel-card">
        <SectionHead title="Open a platform uploader" sub="Post the exported file, then record it here." />
        <div className="uploader-links">
          {DESTINATIONS.map((destination) => (
            <a key={destination.id} className="btn btn-sm" href={destination.upload} target="_blank" rel="noreferrer">
              <span className="platform-dot" style={{ background: destination.color }} />
              {destination.label}
            </a>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete planned post?"
        body={<p>“{deleting?.title}” will be removed from the queue. Nothing was published, so no platform post is affected.</p>}
        confirmLabel={busy ? 'Deleting…' : 'Delete plan'}
        danger
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={Boolean(publishing)}
        title="Mark as published?"
        body={
          <div>
            <p>
              This records the post as published <b>in this workspace only</b>. It does not verify the post exists on the
              platform.
            </p>
            <div className="uploader-links">
              {publishing?.destinations.map((destination) => {
                const meta = DESTINATIONS.find((entry) => entry.id === destination);
                return meta ? (
                  <a key={destination} className="btn btn-sm" href={meta.upload} target="_blank" rel="noreferrer">
                    Open {meta.label}
                  </a>
                ) : null;
              })}
            </div>
          </div>
        }
        confirmLabel={busy ? 'Saving…' : 'Yes, mark published'}
        onConfirm={() => void markPublished()}
        onCancel={() => setPublishing(null)}
      />
    </div>
  );
}
