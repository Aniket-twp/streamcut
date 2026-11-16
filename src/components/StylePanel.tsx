import { useEffect, useState } from 'react';
import type { CaptionTemplate, Clip, Layout, Style } from '../types';
import { api } from '../lib/store';

type Props = {
  style: Style;
  clip: Clip;
  onStyle: (patch: Partial<Style>) => void;
  onClip: (patch: Partial<Clip>) => void;
  onAutoReframe: (mode?: 'auto' | 'facecam' | 'action') => void;
  tracking: boolean;
  notify: (message: string) => void;
};

const LAYOUTS: { id: Layout; label: string }[] = [
  { id: 'fill', label: 'Fill 9:16' },
  { id: 'split', label: 'Split (Cam + Game)' },
  { id: 'blur', label: 'Blurred' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'solid', label: 'Solid' },
];

function TemplateSection({ style, onStyle, notify }: { style: Style; onStyle: (patch: Partial<Style>) => void; notify: (message: string) => void }) {
  const [templates, setTemplates] = useState<CaptionTemplate[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .templates()
      .then(setTemplates)
      .catch(() => undefined);
  }, []);

  const save = async () => {
    if (!name.trim()) {
      notify('Name the template first.');
      return;
    }
    setBusy(true);
    try {
      const created = await api.createTemplate({ name: name.trim(), style });
      setTemplates((prev) => [...prev, created]);
      setName('');
      notify(`Template “${created.name}” saved.`);
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = (template: CaptionTemplate) => {
    if (!template.style) return;
    onStyle(template.style);
    notify(`Applied template “${template.name}”.`);
  };

  const remove = async (template: CaptionTemplate) => {
    try {
      await api.deleteTemplate(template.id);
      setTemplates((prev) => prev.filter((entry) => entry.id !== template.id));
      notify(`Deleted template “${template.name}”.`);
    } catch (error) {
      notify((error as Error).message);
    }
  };

  return (
    <div className="field">
      <label>Templates</label>
      <div className="connect-row">
        <input className="input" value={name} placeholder="Template name" onChange={(event) => setName(event.target.value)} />
        <button className="btn btn-sm" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {templates.length === 0 ? (
        <p className="hint">Save this layout, grade and overlays as a reusable template.</p>
      ) : (
        <div className="template-list">
          {templates.map((template) => (
            <div className="template-row" key={template.id}>
              <span>{template.name}</span>
              <button className="btn btn-sm" onClick={() => apply(template)}>
                Apply
              </button>
              <button className="icon-btn danger" title="Delete template" onClick={() => void remove(template)}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="hint">Applying a template only changes style settings; clip trims and captions stay untouched.</p>
    </div>
  );
}

export default function StylePanel({ style, clip, onStyle, onClip, onAutoReframe, tracking, notify }: Props) {
  return (
    <div className="panel">
      <div className="field">
        <label>Canvas layout</label>
        <div className="grid2">
          {LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              className={`layout-btn${style.layout === layout.id ? ' active' : ''}`}
              onClick={() => onStyle({ layout: layout.id })}
            >
              <span className={`layout-preview layout-${layout.id}`}>
                <span />
              </span>
              {layout.label}
            </button>
          ))}
        </div>
      </div>

      {style.layout !== 'fill' && style.layout !== 'split' && (
        <>
          <div className="field">
            <label>Background</label>
            <div className="row">
              <label className="color-field">
                <input type="color" value={style.bgA} onChange={(e) => onStyle({ bgA: e.target.value })} />
                <span>Base</span>
              </label>
              {style.layout !== 'solid' && (
                <label className="color-field">
                  <input type="color" value={style.bgB} onChange={(e) => onStyle({ bgB: e.target.value })} />
                  <span>Accent</span>
                </label>
              )}
            </div>
          </div>

          <div className="field">
            <label>
              Padding <span className="value">{style.padding}%</span>
            </label>
            <input
              className="slider"
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={style.padding}
              onChange={(e) => onStyle({ padding: Number(e.target.value) })}
            />
          </div>

          <div className="field">
            <label>
              Corner radius <span className="value">{style.radius}px</span>
            </label>
            <input
              className="slider"
              type="range"
              min={0}
              max={80}
              step={2}
              value={style.radius}
              onChange={(e) => onStyle({ radius: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      {style.layout === 'split' && (
        <div className="field">
          <label>StreamLadder Split-Screen</label>
          <div className="notice" style={{ margin: '6px 0 12px' }}>
            <b>Top: Facecam · Bottom: Gameplay</b>
            <p>Automatically frames the streamer's reaction on top and gameplay on bottom for TikTok &amp; Shorts.</p>
          </div>

          <label>
            Facecam position (top camera) <span className="value">{Math.round((clip.camPan ?? 0.18) * 100)}%</span>
          </label>
          <input
            className="slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={clip.camPan ?? 0.18}
            onChange={(e) => onClip({ camPan: Number(e.target.value) })}
          />

          <label>
            Facecam zoom <span className="value">{(clip.camZoom ?? 1.35).toFixed(2)}×</span>
          </label>
          <input
            className="slider"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={clip.camZoom ?? 1.35}
            onChange={(e) => onClip({ camZoom: Number(e.target.value) })}
          />

          <label>
            Split point <span className="value">{Math.round((clip.splitRatio ?? 0.38) * 100)}% cam</span>
          </label>
          <input
            className="slider"
            type="range"
            min={0.25}
            max={0.55}
            step={0.01}
            value={clip.splitRatio ?? 0.38}
            onChange={(e) => onClip({ splitRatio: Number(e.target.value) })}
          />

          <label>
            Gameplay position (bottom) <span className="value">{Math.round(clip.pan * 100)}%</span>
          </label>
          <input
            className="slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={clip.pan}
            disabled={clip.autoReframe}
            onChange={(e) => onClip({ pan: Number(e.target.value) })}
          />

          <button className="btn btn-lime btn-block" onClick={() => onAutoReframe('auto')} disabled={tracking} style={{ marginTop: 8 }}>
            {tracking ? (
              <>
                <span className="spinner sm" /> Auto-detecting Facecam &amp; Action…
              </>
            ) : (
              '✦ Auto-detect Facecam &amp; Track'
            )}
          </button>
        </div>
      )}

      <div className="field">
        <label>Colour grade</label>
        <div className="seg">
          {(['none', 'vivid', 'cinematic', 'noir'] as const).map((filter) => (
            <button
              key={filter}
              className={style.filter === filter ? 'on' : ''}
              onClick={() => onStyle({ filter })}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {style.layout === 'fill' && (
        <div className="field">
          <label>
            Zoom <span className="value">{clip.zoom.toFixed(2)}×</span>
          </label>
          <input
            className="slider"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={clip.zoom}
            onChange={(e) => onClip({ zoom: Number(e.target.value) })}
          />
          <label>
            Crop position <span className="value">{Math.round(clip.pan * 100)}%</span>
          </label>
          <input
            className="slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={clip.pan}
            disabled={clip.autoReframe}
            onChange={(e) => onClip({ pan: Number(e.target.value) })}
          />

          <div style={{ margin: '8px 0 6px' }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Auto-reframe tracking target</label>
            <div className="seg">
              {(
                [
                  { id: 'auto', label: 'Facecam + Action' },
                  { id: 'facecam', label: 'Lock Facecam' },
                  { id: 'action', label: 'Action only' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  className={(clip.reframeMode ?? 'auto') === mode.id ? 'on' : ''}
                  onClick={() => onClip({ reframeMode: mode.id })}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-block"
            onClick={() => onAutoReframe(clip.reframeMode ?? 'auto')}
            disabled={tracking}
          >
            {tracking ? (
              <>
                <span className="spinner sm" /> Tracking {clip.reframeMode === 'facecam' ? 'facecam' : 'action'}…
              </>
            ) : clip.autoReframe ? (
              'Re-run smart tracking'
            ) : (
              '🎯 Auto-reframe with Facecam'
            )}
          </button>
          {clip.autoReframe && (
            <button className="link center" onClick={() => onClip({ autoReframe: false })}>
              Turn tracking off
            </button>
          )}
          <p className="hint">
            Locates the streamer's webcam feed and action, keeping reactions framed in the 9:16 vertical crop.
          </p>
        </div>
      )}

      <div className="field">
        <label>Overlays</label>
        <div className="toggle-row">
          <span>Progress bar</span>
          <button
            className={`switch${style.progress ? ' on' : ''}`}
            onClick={() => onStyle({ progress: !style.progress })}
            aria-pressed={style.progress}
          >
            <span />
          </button>
        </div>
        {style.progress && (
          <label className="color-field wide">
            <input type="color" value={style.progressColor} onChange={(e) => onStyle({ progressColor: e.target.value })} />
            <span>Bar colour</span>
          </label>
        )}
        <label className="stack">
          <span>Handle / watermark</span>
          <input
            className="input"
            value={style.handle}
            placeholder="@yourhandle"
            onChange={(e) => onStyle({ handle: e.target.value })}
          />
        </label>
      </div>

      <TemplateSection style={style} onStyle={onStyle} notify={notify} />
    </div>
  );
}
