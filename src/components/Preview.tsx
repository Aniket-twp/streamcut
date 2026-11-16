import { useEffect, useRef, useState } from 'react';
import type { Aspect, Clip, Cue, Style } from '../types';
import { clamp } from '../lib/format';
import { renderFrame } from '../lib/render';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  clip: Clip;
  style: Style;
  cues: Cue[];
  aspect: Aspect;
  playing: boolean;
  now: number;
  onTogglePlay: () => void;
  onUpdate: (patch: Partial<Clip>) => void;
};

export default function Preview({ videoRef, clip, style, cues, aspect, playing, now, onTogglePlay, onUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const canvasSize =
    aspect === '16:9' ? { width: 960, height: 540 } : aspect === '1:1' ? { width: 720, height: 720 } : { width: 540, height: 960 };

  useEffect(() => {
    const container = wrapRef.current?.parentElement;
    if (!container) return;
    const ratio = aspect === '16:9' ? 16 / 9 : aspect === '1:1' ? 1 : 9 / 16;
    const measure = () => {
      const availableWidth = container.clientWidth;
      const availableHeight = container.clientHeight;
      let width = availableWidth;
      let height = width / ratio;
      if (height > availableHeight) {
        height = availableHeight;
        width = height * ratio;
      }
      setBox({ width: Math.max(1, width), height: Math.max(1, height) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [aspect]);
  const drag = useRef<{ x: number; pan: number } | null>(null);
  const moved = useRef(false);

  const zoomRef = useRef(clip.zoom);
  zoomRef.current = clip.zoom;
  const updateRef = useRef(onUpdate);
  updateRef.current = onUpdate;

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw once right away so a paused preview never sits blank.
    renderFrame(ctx, video, clip, style, cues, video.currentTime);

    let raf = 0;
    let last = -1;
    const invalidate = () => {
      last = -1;
    };
    video.addEventListener('loadeddata', invalidate);
    video.addEventListener('seeked', invalidate);

    const draw = () => {
      const time = video.currentTime;
      if (time !== last) {
        last = time;
        renderFrame(ctx, video, clip, style, cues, time);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('loadeddata', invalidate);
      video.removeEventListener('seeked', invalidate);
    };
  }, [videoRef, clip, style, cues]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      updateRef.current({ zoom: clamp(zoomRef.current - event.deltaY * 0.0016, 1, 3) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, pan: clip.pan };
    moved.current = false;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    const width = wrapRef.current?.getBoundingClientRect().width ?? 1;
    const dx = (event.clientX - drag.current.x) / Math.max(40, width);
    if (Math.abs(event.clientX - drag.current.x) > 3) moved.current = true;
    if (style.layout === 'fill') onUpdate({ pan: clamp(drag.current.pan + dx, 0, 1) });
  };

  const onPointerUp = () => {
    drag.current = null;
    if (!moved.current) onTogglePlay();
  };

  return (
    <div className="preview-wrap">
      <div
        className="phone"
        ref={wrapRef}
        style={box.width ? { width: box.width, height: box.height } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} className="preview-canvas" />
        {style.layout === 'fill' && (
          <div className="preview-hint">
            {clip.autoReframe ? 'Auto-reframe following the action' : 'Drag to reframe · scroll to zoom'}
          </div>
        )}
        {!playing && (
          <div className="play-overlay" aria-hidden>
            <svg viewBox="0 0 24 24" width="30" height="30">
              <path d="M9 6.5v11l9-5.5z" fill="currentColor" />
            </svg>
          </div>
        )}
        <div className="preview-clock">{`${Math.max(0, now - clip.start).toFixed(1)}s / ${(clip.end - clip.start).toFixed(1)}s`}</div>
      </div>
    </div>
  );
}
