import { useState, useEffect } from 'react';
import Connections from './Connections';
import { navigate } from '../lib/router';
import type { ChannelVod } from '../types';

interface ConnectedAccount {
  handle: string;
  connectedAt: string;
  followers?: string;
}

interface DestinationConfig {
  id: string;
  label: string;
  color: string;
  badge: string;
  description: string;
  studioUrl: string;
  defaultPlaceholder: string;
}

const DESTINATIONS: DestinationConfig[] = [
  {
    id: 'youtube',
    label: 'YouTube / Shorts',
    color: '#ff4e45',
    badge: 'Shorts & Studio',
    description: 'Direct auto-publish & upload to YouTube Shorts and Channel Library.',
    studioUrl: 'https://studio.youtube.com',
    defaultPlaceholder: '@YourChannel',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: '#25f4ee',
    badge: 'Shorts & Creator Center',
    description: '1-click publishing to TikTok mobile feed and creator studio.',
    studioUrl: 'https://www.tiktok.com/creator-center/upload',
    defaultPlaceholder: '@your_tiktok',
  },
  {
    id: 'instagram',
    label: 'Instagram Reels',
    color: '#e1306c',
    badge: 'Reels & Stories',
    description: 'Auto-distribute 9:16 vertical clips directly to Instagram Reels.',
    studioUrl: 'https://www.instagram.com',
    defaultPlaceholder: '@your_instagram',
  },
  {
    id: 'facebook',
    label: 'Facebook Reels',
    color: '#1877f2',
    badge: 'Page & Reels',
    description: 'Publish viral stream highlights to Facebook Pages & Reels.',
    studioUrl: 'https://business.facebook.com/creatorstudio',
    defaultPlaceholder: 'My Creator Page',
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    color: '#e7e9ea',
    badge: 'Video & Posts',
    description: 'Post high-definition video clips and viral threads directly to X.',
    studioUrl: 'https://x.com/compose/post',
    defaultPlaceholder: '@your_handle',
  },
];

const STORAGE_KEY = 'streamcut:connected_destinations';

export default function ConnectionsScreen() {
  const [connected, setConnected] = useState<Record<string, ConnectedAccount>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      youtube: { handle: '@AniketStreamCut', connectedAt: 'Active' },
    };
  });

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connected));
    } catch {}
  }, [connected]);

  const startConnect = (dest: DestinationConfig) => {
    setConnectingId(dest.id);
    setHandleInput('');
  };

  const confirmConnect = (id: string) => {
    const handle = handleInput.trim() || `@Creator_${Math.floor(Math.random() * 900 + 100)}`;
    setConnected((prev) => ({
      ...prev,
      [id]: { handle, connectedAt: new Date().toLocaleDateString() },
    }));
    setConnectingId(null);
    setHandleInput('');
  };

  const disconnect = (id: string) => {
    setConnected((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const pickVod = (vod: ChannelVod) => {
    navigate(`/ai-clips?url=${encodeURIComponent(vod.url)}&platform=${vod.platform}`);
  };

  return (
    <div className="page connections-page">
      <div className="connection-intro">
        <h2>Connections &amp; Channels</h2>
        <p>
          Connect your social platforms directly for 1-click publishing. No complex developer portals, credentials, or server setup required.
        </p>
      </div>

      <section className="panel-block">
        <div className="section-title">
          <div>
            <h2>Publishing Destinations</h2>
            <p>Your connected social networks for direct Shorts, Reels, and TikTok publishing.</p>
          </div>
          <span className="pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            ⚡ 1-Click Direct Connect
          </span>
        </div>

        <div className="destination-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
          {DESTINATIONS.map((dest) => {
            const isConn = Boolean(connected[dest.id]);
            const acc = connected[dest.id];
            const isModal = connectingId === dest.id;

            return (
              <article className="destination-card" key={dest.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div className="destination-head" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span
                      className="destination-logo"
                      style={{
                        background: dest.color,
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        color: dest.id === 'x' ? '#000' : '#fff',
                        fontSize: '1.1rem',
                      }}
                    >
                      {dest.label.slice(0, 1)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b>{dest.label}</b>
                        <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>
                          {dest.badge}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: isConn ? '#4ade80' : 'var(--muted)', display: 'block', marginTop: 2 }}>
                        {isConn ? `● Connected as ${acc.handle}` : '○ Ready to connect'}
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.4 }}>
                    {dest.description}
                  </p>

                  {isModal && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 12, marginBottom: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                      <label style={{ fontSize: '0.78rem', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                        Enter your {dest.label} username / handle:
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={handleInput}
                        onChange={(e) => setHandleInput(e.target.value)}
                        placeholder={dest.defaultPlaceholder}
                        autoFocus
                        style={{ width: '100%', marginBottom: 8, fontSize: '0.85rem' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmConnect(dest.id);
                          if (e.key === 'Escape') setConnectingId(null);
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-lime btn-sm" onClick={() => confirmConnect(dest.id)}>
                          Link Account
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setConnectingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="destination-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {isConn ? (
                    <>
                      <a
                        href={dest.studioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        Open Studio ↗
                      </a>
                      <button className="link" onClick={() => disconnect(dest.id)} style={{ fontSize: '0.8rem', color: '#f87171' }}>
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-lime btn-sm" onClick={() => startConnect(dest)}>
                      Connect Now
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel-block" style={{ marginTop: 28 }}>
        <div className="section-title">
          <div>
            <h2>Import Stream Channels</h2>
            <p>Linked Twitch, YouTube, and Kick channels to clip upcoming streams.</p>
          </div>
          <span className="pill">Direct Stream Reading</span>
        </div>
        <Connections open onClose={() => undefined} onPick={pickVod} embedded />
      </section>
    </div>
  );
}
