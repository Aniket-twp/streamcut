import { useEffect, useRef } from 'react';

export default function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Wave / droplet parameters
    const drops = [
      { x: 0.2, y: 0.25, r: 240, vx: 0.0006, vy: 0.0008, color: [45, 90, 160] },
      { x: 0.8, y: 0.7, r: 320, vx: -0.0007, vy: -0.0005, color: [25, 75, 140] },
      { x: 0.5, y: 0.85, r: 280, vx: 0.0008, vy: -0.0006, color: [30, 60, 100] },
      { x: 0.85, y: 0.2, r: 220, vx: -0.0005, vy: 0.0007, color: [50, 120, 180] },
      { x: 0.15, y: 0.75, r: 260, vx: 0.0005, vy: -0.0004, color: [20, 45, 80] },
    ];

    const render = () => {
      t += 0.012;
      const w = canvas.width;
      const h = canvas.height;

      // Dark obsidian base
      ctx.fillStyle = '#04060a';
      ctx.fillRect(0, 0, w, h);

      // Render fluid blobs
      ctx.globalCompositeOperation = 'screen';
      for (const d of drops) {
        const cx = (d.x + Math.sin(t * 0.7 + d.r) * 0.08) * w;
        const cy = (d.y + Math.cos(t * 0.6 + d.r) * 0.08) * h;
        const radius = d.r + Math.sin(t + d.r) * 35;

        const grad = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
        const [r, g, b] = d.color;
        grad.addColorStop(0, `rgba(${r + 20}, ${g + 30}, ${b + 40}, 0.12)`);
        grad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.06)`);
        grad.addColorStop(0.8, `rgba(${r * 0.5}, ${g * 0.5}, ${b * 0.5}, 0.02)`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Caustic liquid wave ribbons (metallic mercury ribbons like iOS 27 wallpaper)
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const offset = i * 2.2;
        ctx.strokeStyle = `rgba(180, 215, 255, ${0.06 + Math.sin(t + i) * 0.02})`;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 30) {
          const y = h * (0.35 + i * 0.2) +
            Math.sin(x * 0.002 + t * 0.8 + offset) * 90 +
            Math.cos(x * 0.004 - t * 0.5) * 45;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="liquid-backdrop-container" aria-hidden>
      <canvas ref={canvasRef} className="liquid-canvas" />
      <div className="liquid-film-overlay" />
    </div>
  );
}
