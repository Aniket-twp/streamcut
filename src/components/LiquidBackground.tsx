import { useEffect, useRef } from 'react';

/**
 * Animated "liquid glass" backdrop — electric aurora edition.
 * Deep indigo base with drifting violet / magenta / cyan light fields and
 * flowing caustic ribbons, rendered to a low-res buffer and GPU-blurred by
 * CSS so it reads as refracting liquid, not a flat gradient.
 * Also tracks the pointer globally: --mx/--my drive cursor-following
 * speculars on glass cards, --px2/--py2 add subtle parallax drift.
 */
export default function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 640;
    const H = 360;
    canvas.width = W;
    canvas.height = H;

    type Blob = {
      x: number;
      y: number;
      r: number;
      ax: number;
      ay: number;
      sx: number;
      sy: number;
      hue: [number, number, number];
      alpha: number;
      drift: number;
    };

    // Vivid aurora palette: electric violet, blue, magenta, cyan, ember.
    const blobs: Blob[] = [
      { x: 0.14, y: 0.16, r: 0.62, ax: 0.075, ay: 0.05, sx: 0.55, sy: 0.7, hue: [94, 44, 220], alpha: 0.3, drift: 0.0 },
      { x: 0.84, y: 0.28, r: 0.66, ax: 0.06, ay: 0.065, sx: 0.5, sy: 0.6, hue: [220, 36, 150], alpha: 0.26, drift: 2.1 },
      { x: 0.58, y: 0.8, r: 0.7, ax: 0.05, ay: 0.055, sx: 0.6, sy: 0.5, hue: [12, 156, 190], alpha: 0.24, drift: 4.2 },
      { x: 0.24, y: 0.74, r: 0.5, ax: 0.065, ay: 0.045, sx: 0.5, sy: 0.65, hue: [58, 96, 226], alpha: 0.22, drift: 1.3 },
      { x: 0.92, y: 0.9, r: 0.44, ax: 0.05, ay: 0.06, sx: 0.7, sy: 0.5, hue: [255, 150, 60], alpha: 0.1, drift: 5.4 },
      { x: 0.47, y: 0.4, r: 0.36, ax: 0.07, ay: 0.05, sx: 0.6, sy: 0.6, hue: [150, 60, 255], alpha: 0.1, drift: 3.4 },
      { x: 0.04, y: 0.92, r: 0.34, ax: 0.05, ay: 0.06, sx: 0.45, sy: 0.55, hue: [56, 225, 255], alpha: 0.09, drift: 0.9 },
    ];

    let raf = 0;
    let t = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const paint = (time: number) => {
      if (!reduced) t = time * 0.00014;
      const w = W;
      const h = H;

      // Deep indigo base so the glass has colour to refract.
      const base = ctx.createLinearGradient(0, 0, w, h);
      base.addColorStop(0, '#0a0d22');
      base.addColorStop(0.55, '#070a1a');
      base.addColorStop(1, '#0b0920');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      for (const b of blobs) {
        const cx = (b.x + Math.sin(t * b.sx + b.drift) * b.ax) * w;
        const cy = (b.y + Math.cos(t * b.sy + b.drift) * b.ay) * h;
        const radius = b.r * Math.min(w, h) * (1 + Math.sin(t * 0.7 + b.drift) * 0.08);
        const [r, g, bl] = b.hue;
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.02, cx, cy, radius);
        grad.addColorStop(0, `rgba(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, bl + 30)}, ${b.alpha})`);
        grad.addColorStop(0.45, `rgba(${r}, ${g}, ${bl}, ${b.alpha * 0.55})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Caustic light ribbons — slow flowing streaks of light through liquid.
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const offset = i * 2.4;
        const ribbon = [
          [56, 225, 255, 0.05 + Math.sin(t * 0.8 + i) * 0.015],
          [139, 123, 255, 0.05 + Math.cos(t * 0.7 + i) * 0.015],
          [255, 79, 216, 0.04 + Math.sin(t * 0.9 + i) * 0.012],
        ][i % 3];
        ctx.strokeStyle = `rgba(${ribbon[0]}, ${ribbon[1]}, ${ribbon[2]}, ${ribbon[3]})`;
        ctx.beginPath();
        for (let x = -20; x <= w + 20; x += 24) {
          const y =
            h * (0.3 + i * 0.16) +
            Math.sin(x * 0.0035 + t * 0.9 + offset) * 70 +
            Math.cos(x * 0.006 - t * 0.55 + offset) * 34;
          if (x === -20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';

      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);

    // Pointer tracking: specular coords for glass cards + parallax drift.
    const root = document.documentElement;
    let moveRaf = 0;
    const onMove = (event: PointerEvent) => {
      if (moveRaf) return;
      moveRaf = requestAnimationFrame(() => {
        moveRaf = 0;
        root.style.setProperty('--mx', `${event.clientX}px`);
        root.style.setProperty('--my', `${event.clientY}px`);
        root.style.setProperty('--px2', `${(event.clientX / window.innerWidth - 0.5).toFixed(3)}`);
        root.style.setProperty('--py2', `${(event.clientY / window.innerHeight - 0.5).toFixed(3)}`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div className="liquid-backdrop-container" aria-hidden>
      <canvas ref={canvasRef} className="liquid-canvas" />
      <div className="liquid-vignette" />
      <div className="liquid-film-overlay" />
      <div className="liquid-grain" />
    </div>
  );
}
