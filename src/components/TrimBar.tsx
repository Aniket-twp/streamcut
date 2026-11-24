import { useEffect, useRef, useState } from 'react';
import { clamp, fmtTenths } from '../lib/format';

type Props = {
  duration: number;
  start: number;
  end: number;
  current: number;
  bars: number[];
  onTrim: (start: number, end: number) => void;
  onSeek: (t: number) => void;
};

type Mode = 'in' | 'out' | 'seek';

export default function TrimBar({ duration, start, end, current, bars, onTrim, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Mode | null>(null);
  const safeDur = Math.max(0.1, duration);

  const timeAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp((clientX - rect.left) / rect.width, 0, 1) * safeDur;
  };

  const begin = (mode: Mode) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDrag(mode);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const t = timeAt(event.clientX);
    if (mode === 'seek') onSeek(t);
    if (mode === 'in') onTrim(clamp(t, 0, end - 1), end);
    if (mode === 'out') onTrim(start, clamp(t, start + 1, safeDur));
  };

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      const t = timeAt(event.clientX);
      if (drag === 'seek') onSeek(t);
      else if (drag === 'in') onTrim(clamp(t, 0, end - 1), end);
      else onTrim(start, clamp(t, start + 1, safeDur));
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag, start, end, safeDur, onTrim, onSeek]);

  const pct = (t: number) => `${clamp(t / safeDur, 0, 1) * 100}%`;
  const playhead = clamp((current - start) / Math.max(0.01, end - start), 0, 1);

  return (
    <div className="trim">
      <div className="trim-track" ref={trackRef} onPointerDown={begin('seek')}>
        <svg className="wave" viewBox={`0 0 ${Math.max(1, bars.length)} 100`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="sc-wave" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5fb0ff" stopOpacity="0.55" />
              <stop offset="0.55" stopColor="#a78bfa" stopOpacity="0.38" />
              <stop offset="1" stopColor="#b9f553" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          {bars.map((v, i) => (
            <rect key={i} x={i + 0.08} y={100 - v * 98} width={0.84} height={Math.max(1.2, v * 98)} rx={0.4} fill="url(#sc-wave)" />
          ))}
        </svg>
        <div className="trim-dim" style={{ left: 0, width: pct(start) }} />
        <div className="trim-dim" style={{ left: pct(end), right: 0 }} />
        <div className="trim-region" style={{ left: pct(start), width: pct(end - start) }}>
          <div className="trim-handle" onPointerDown={begin('in')} />
          <div className="trim-handle right" onPointerDown={begin('out')} />
          <div className="trim-playhead" style={{ left: `${playhead * 100}%` }} />
        </div>
      </div>
      <div className="trim-labels">
        <span>{fmtTenths(start)}</span>
        <span className="trim-len">{fmtTenths(end - start)} selected</span>
        <span>{fmtTenths(end)}</span>
      </div>
    </div>
  );
}
