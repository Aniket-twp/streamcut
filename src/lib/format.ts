export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

let seq = 0;
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** 1:23 or 1:02:03 */
export function fmt(t: number): string {
  if (!Number.isFinite(t)) return '0:00';
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/** 1:23.4 — used for clip lengths. */
export function fmtTenths(t: number): string {
  if (!Number.isFinite(t)) return '0:00.0';
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const d = Math.floor((s * 10) % 10);
  return `${m}:${String(sec).padStart(2, '0')}.${d}`;
}

/** Parses "90", "12:30" or "1:12:30" into seconds. Returns NaN for bad input. */
export function parseClock(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parts = trimmed.split(':');
  if (parts.length > 3) return Number.NaN;
  const numbers = parts.map(Number);
  if (numbers.some((part) => !Number.isFinite(part) || part < 0)) return Number.NaN;
  return numbers.reduce((total, part) => total * 60 + part, 0);
}

export function bytes(n: number): string {
  if (!n) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function safeFileName(name: string): string {
  return (
    name
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'streamcut-clip'
  );
}
