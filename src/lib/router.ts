import { useEffect, useMemo, useState } from 'react';

export type Screen =
  | 'home'
  | 'new'
  | 'ai-clips'
  | 'editor'
  | 'library'
  | 'publisher'
  | 'analytics'
  | 'connections'
  | 'settings';

export type Route = { screen: Screen; id?: string; query: URLSearchParams };

const SCREENS: Screen[] = [
  'home',
  'new',
  'ai-clips',
  'editor',
  'library',
  'publisher',
  'analytics',
  'connections',
  'settings',
];

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathname, queryString = ''] = raw.split('?');
  const parts = pathname.split('/').filter(Boolean);
  const screen = (SCREENS as string[]).includes(parts[0]) ? (parts[0] as Screen) : 'home';
  return { screen, id: parts[1] ? decodeURIComponent(parts[1]) : undefined, query: new URLSearchParams(queryString) };
}

export function navigate(path: string) {
  const next = path.startsWith('#') ? path : `#${path}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return useMemo(() => parseHash(hash), [hash]);
}
