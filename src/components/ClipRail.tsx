import type { Clip, MediaInfo } from '../types';
import { bytes, fmt, fmtTenths } from '../lib/format';

type Props = {
  media: MediaInfo;
  clips: Clip[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onOpenAi: () => void;
  onChangeSource: () => void;
};

export default function ClipRail(props: Props) {
  const { media, clips, currentId } = props;

  return (
    <aside className="rail">
      <div className="source-card">
        <div className="source-top">
          <span className="dot" />
          <span className="source-name" title={media.name}>
            {media.name}
          </span>
        </div>
        <div className="source-meta">
          {fmt(media.duration)} · {media.width}×{media.height} · {media.size ? bytes(media.size) : 'remote source'}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={props.onChangeSource}>
          Change source
        </button>
      </div>

      <div className="rail-scroll">
        <div className="section-head">
          <h3>Clips</h3>
          <span className="count">{clips.length}</span>
        </div>

        <div className="clip-list">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className={`clip-item${clip.id === currentId ? ' active' : ''}`}
              onClick={() => props.onSelect(clip.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') props.onSelect(clip.id);
              }}
            >
              <div className="clip-main">
                <div className="clip-title">{clip.title}</div>
                <div className="clip-sub">
                  {fmtTenths(clip.start)} → {fmtTenths(clip.end)} · {fmtTenths(clip.end - clip.start)}
                </div>
              </div>
              {typeof clip.score === 'number' && <span className="score">{Math.round(clip.score * 100)}</span>}
              <button
                className="icon-btn danger"
                title="Delete clip"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDelete(clip.id);
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button className="btn btn-block" onClick={props.onAdd}>
          + New clip from playhead
        </button>

        <div className="section-head spaced">
          <h3>AI moment finder</h3>
        </div>
        <div className="empty-suggest ai-rail-card">
          <p>Whisper reads the speech, then Qwen3 picks complete moments — no loudness guessing.</p>
          <button className="btn btn-lime btn-sm btn-block" onClick={props.onOpenAi}>
            Open AI Clips
          </button>
        </div>
      </div>

      <div className="rail-foot">
        <span className="local-badge">
          <span className="dot" /> Local-only editing
        </span>
      </div>
    </aside>
  );
}
