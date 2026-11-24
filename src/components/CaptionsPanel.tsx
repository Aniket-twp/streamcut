import { useRef, useState } from 'react';
import type { Clip, Cue, ProjectSource, Style, TranscriptSegment } from '../types';
import { cuesInRange, parseSubtitles, rebaseSubtitles, scriptToCues } from '../lib/captions';
import { readJson } from '../lib/api';
import { api } from '../lib/store';
import { fmtTenths, uid } from '../lib/format';

type Props = {
  style: Style;
  clip: Clip;
  source: ProjectSource | null;
  cues: Cue[];
  setCues: React.Dispatch<React.SetStateAction<Cue[]>>;
  onStyle: (patch: Partial<Style>) => void;
  notify: (message: string) => void;
};

export default function CaptionsPanel({ style, clip, source, cues, setCues, onStyle, notify }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [script, setScript] = useState('');
  const [captionLanguage, setCaptionLanguage] = useState('en');
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [transcribeStage, setTranscribeStage] = useState('');
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeJobId, setTranscribeJobId] = useState<string | null>(null);
  const left = cuesInRange(cues, clip.start, clip.end);

  const patchCaptions = (patch: Partial<Style['captions']>) => onStyle({ captions: { ...style.captions, ...patch } });

  const importFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseSubtitles(text);
    if (!parsed.length) {
      notify('No captions found in that file. Use SRT or VTT.');
      return;
    }
    setCues((prev) =>
      [...prev.filter((cue) => !parsed.some((p) => Math.abs(p.start - cue.start) < 0.05)), ...parsed].sort(
        (a, b) => a.start - b.start,
      ),
    );
    notify(`Imported ${parsed.length} caption cues.`);
  };

  const generate = () => {
    const next = scriptToCues(script, clip.start, clip.end);
    if (!next.length) {
      notify('Write a line or two first.');
      return;
    }
    setCues((prev) =>
      [...prev.filter((cue) => cue.end <= clip.start || cue.start >= clip.end), ...next].sort((a, b) => a.start - b.start),
    );
    notify('Script timed across this clip.');
  };

  const fetchSourceCaptions = async () => {
    if (!source?.captionSource || autoBusy) return;
    setAutoBusy(true);
    setAutoError(null);
    try {
      const response = await fetch('/api/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: source.captionSource, language: captionLanguage }),
      });
      const result = await readJson<{ vtt: string; language?: string }>(response);
      const parsed = parseSubtitles(result.vtt);
      const imported = rebaseSubtitles(parsed, source.segmentStart ?? 0, source.duration);
      if (!imported.length) {
        throw new Error('A caption track was found, but it has no captions in this video segment.');
      }
      setCues(imported);
      notify(`Added ${imported.length} source captions${result.language ? ` (${result.language})` : ''}.`);
    } catch (err) {
      setAutoError((err as Error).message || 'Could not fetch captions from this source.');
    } finally {
      setAutoBusy(false);
    }
  };

  const transcribeSpeech = async () => {
    if (!source?.url || autoBusy) return;
    setAutoBusy(true);
    setAutoError(null);
    setTranscribeStage('Starting local speech-to-text…');
    setTranscribeProgress(0);
    let jobId: string | null = null;
    try {
      const started = await api.startTranscription({ mediaUrl: source.url, duration: source.duration, language: captionLanguage });
      jobId = started.id;
      setTranscribeJobId(jobId);
      let finished = started;
      for (let attempt = 0; attempt < 1800; attempt++) {
        if (finished.status !== 'running') break;
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        finished = await api.transcriptionJob(jobId);
        setTranscribeStage(finished.stage);
        setTranscribeProgress(finished.percent);
      }
      if (finished.status === 'error') throw new Error(finished.error || 'Local speech-to-text failed.');
      if (finished.status !== 'done' || !finished.result) throw new Error('Transcription took too long. Try again with a shorter video.');

      const generated = finished.result.segments
        .filter((segment: TranscriptSegment) => segment.end > clip.start && segment.start < clip.end)
        .map((segment: TranscriptSegment) => ({
          id: uid('cue'),
          start: Math.max(clip.start, segment.start),
          end: Math.min(clip.end, segment.end),
          text: segment.text.trim(),
        }))
        .filter((cue: { id: string; start: number; end: number; text: string }) => cue.text && cue.end > cue.start);
      if (!generated.length) throw new Error('Whisper did not find speech inside this clip.');
      setCues((prev) => [...prev.filter((cue) => cue.end <= clip.start || cue.start >= clip.end), ...generated].sort((a, b) => a.start - b.start));
      notify(`Generated ${generated.length} timed captions with local Whisper (${finished.result.language}).`);
    } catch (err) {
      setAutoError((err as Error).message || 'Could not generate captions from this video.');
    } finally {
      setAutoBusy(false);
      setTranscribeJobId(null);
      setTranscribeStage('');
      setTranscribeProgress(0);
    }
  };

  const cancelTranscription = async () => {
    if (!transcribeJobId) return;
    await api.cancelTranscription(transcribeJobId).catch(() => undefined);
    setAutoBusy(false);
    setTranscribeJobId(null);
    setTranscribeStage('');
    setTranscribeProgress(0);
  };

  return (
    <div className="panel">
      <div className="toggle-row">
        <span>Burn in captions</span>
        <button
          className={`switch${style.captions.enabled ? ' on' : ''}`}
          onClick={() => patchCaptions({ enabled: !style.captions.enabled })}
          aria-pressed={style.captions.enabled}
        >
          <span />
        </button>
      </div>

      <div className="field auto-caption-field">
        <label>Automatic captions</label>
        {source?.url ? (
          <>
            <p className="hint">Transcribe the video with local Whisper. Speech stays on this computer; generated captions are timed to the selected clip.</p>
            <div className="auto-caption-controls">
              <select className="input" value={captionLanguage} onChange={(event) => setCaptionLanguage(event.target.value)} aria-label="Caption language">
                <option value="auto">Auto-detect</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
                <option value="pt">Portuguese</option>
              </select>
              <button className="btn btn-primary" type="button" onClick={() => void transcribeSpeech()} disabled={autoBusy}>
                {autoBusy ? `${transcribeStage || 'Transcribing…'} ${transcribeProgress ? `${transcribeProgress}%` : ''}` : 'Generate captions with Whisper'}
              </button>
              {autoBusy && transcribeJobId && <button className="btn btn-ghost" type="button" onClick={() => void cancelTranscription()}>Cancel</button>}
            </div>
            {source.captionSource && <button className="btn btn-ghost" type="button" onClick={() => void fetchSourceCaptions()} disabled={autoBusy}>{autoBusy ? 'Working…' : 'Try source subtitle track instead'}</button>}
            {autoError && <div className="error-banner">{autoError}</div>}
          </>
        ) : (
          <p className="hint">Open a video project to generate timed captions from its speech, or import an SRT/VTT file below.</p>
        )}
      </div>

      <div className="field">
        <label>Type a script, then time it to the clip</label>
        <textarea
          className="input textarea"
          rows={4}
          placeholder={'this clutch was actually insane\nchat could not believe it'}
          value={script}
          onChange={(e) => setScript(e.target.value)}
        />
        <div className="row">
          <button className="btn btn-primary flex1" onClick={generate}>
            Time captions
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            Import SRT / VTT
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".srt,.vtt,text/plain"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="field">
        <label>Trending caption styles</label>
        <div className="seg" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              patchCaptions({
                font: 'anton',
                uppercase: true,
                stroke: true,
                box: false,
                accent: '#facc15',
                color: '#ffffff',
                size: 6.8,
                y: 0.72,
              });
              notify('Applied Hormozi Pop captions.');
            }}
          >
            Hormozi Pop
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              patchCaptions({
                font: 'inter',
                uppercase: true,
                stroke: false,
                box: true,
                boxOpacity: 0.85,
                accent: '#38bdf8',
                color: '#ffffff',
                size: 5.4,
                y: 0.75,
              });
              notify('Applied Highlighter Box captions.');
            }}
          >
            Highlighter
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              patchCaptions({
                font: 'inter',
                uppercase: false,
                stroke: true,
                box: false,
                accent: '#e879f9',
                color: '#f8fafc',
                size: 5.2,
                y: 0.78,
              });
              notify('Applied Modern Glow captions.');
            }}
          >
            Modern Glow
          </button>
        </div>

        <label>Caption customization</label>
        <div className="grid2">
          <label className="stack">
            <span>Font</span>
            <select
              className="input"
              value={style.captions.font}
              onChange={(e) => patchCaptions({ font: e.target.value as Style['captions']['font'] })}
            >
              <option value="anton">Anton — bold caption</option>
              <option value="inter">Inter — clean</option>
              <option value="mono">Mono — terminal</option>
            </select>
          </label>
          <label className="color-field wide">
            <input
              type="color"
              value={style.captions.accent}
              onChange={(e) => patchCaptions({ accent: e.target.value })}
            />
            <span>Highlight</span>
          </label>
        </div>

        <label>
          Size <span className="value">{style.captions.size.toFixed(1)}%</span>
        </label>
        <input
          className="slider"
          type="range"
          min={2.5}
          max={9}
          step={0.1}
          value={style.captions.size}
          onChange={(e) => patchCaptions({ size: Number(e.target.value) })}
        />
        <label>
          Position <span className="value">{Math.round(style.captions.y * 100)}%</span>
        </label>
        <input
          className="slider"
          type="range"
          min={0.4}
          max={0.94}
          step={0.01}
          value={style.captions.y}
          onChange={(e) => patchCaptions({ y: Number(e.target.value) })}
        />

        <div className="checks">
          <label className="check">
            <input
              type="checkbox"
              checked={style.captions.uppercase}
              onChange={(e) => patchCaptions({ uppercase: e.target.checked })}
            />
            Uppercase
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={style.captions.stroke}
              onChange={(e) => patchCaptions({ stroke: e.target.checked })}
            />
            Outline
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={style.captions.box}
              onChange={(e) => patchCaptions({ box: e.target.checked })}
            />
            Dark box
          </label>
        </div>
      </div>

      <div className="field">
        <div className="section-head">
          <label>
            Cues in this clip <span className="value">{left.length}</span>
          </label>
          {left.length > 0 && (
            <button
              className="link"
              onClick={() => {
                setCues((prev) => prev.filter((cue) => cue.end <= clip.start || cue.start >= clip.end));
                notify('Cleared captions for this clip.');
              }}
            >
              Clear
            </button>
          )}
        </div>

        {left.length === 0 ? (
          <p className="hint">No captions here yet. Import a subtitle file or time a script above.</p>
        ) : (
          <div className="cue-list">
            {left.map((cue) => (
              <div className="cue" key={cue.id}>
                <span className="cue-time">{(cue.start - clip.start).toFixed(1)}s</span>
                <input
                  className="cue-input"
                  value={cue.text}
                  onChange={(e) =>
                    setCues((prev) => prev.map((c) => (c.id === cue.id ? { ...c, text: e.target.value } : c)))
                  }
                />
                <button
                  className="icon-btn danger"
                  title="Delete cue"
                  onClick={() => setCues((prev) => prev.filter((c) => c.id !== cue.id))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="row">
          <button
            className="btn btn-ghost btn-sm flex1"
            onClick={() => {
              const cue: Cue = {
                id: uid('cue'),
                start: clip.start + 0.2,
                end: Math.min(clip.end, clip.start + 3),
                text: 'New caption',
              };
              setCues((prev) => [...prev, cue].sort((a, b) => a.start - b.start));
            }}
          >
            + Add cue at clip start
          </button>
        </div>
        <p className="hint">
          Captions are timed to the source video. Clip {fmtTenths(clip.start)} → {fmtTenths(clip.end)} shows the cues
          above.
        </p>
      </div>
    </div>
  );
}
