import { useCallback, useEffect, useState } from 'react';
import type { Channel, ChannelVod, ConnectPlatform } from '../types';
import { fmt } from '../lib/format';
import { readJson } from '../lib/api';

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (vod: ChannelVod) => void;
  embedded?: boolean;
};

const PLATFORMS: { id: ConnectPlatform; label: string; placeholder: string; color: string }[] = [
  { id: 'twitch', label: 'Twitch', placeholder: 'https://www.twitch.tv/yourname', color: '#9146ff' },
  { id: 'youtube', label: 'YouTube', placeholder: 'https://www.youtube.com/@yourname', color: '#ff4e45' },
  { id: 'kick', label: 'Kick', placeholder: 'https://kick.com/yourname', color: '#53fc18' },
];

const platformMeta = (id: ConnectPlatform) => PLATFORMS.find((entry) => entry.id === id) ?? PLATFORMS[0];

export default function Connections({ open, onClose, onPick, embedded }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [platform, setPlatform] = useState<ConnectPlatform>('twitch');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState<string | null>(null);
  const [vods, setVods] = useState<Record<string, ChannelVod[]>>({});
  const [vodLoading, setVodLoading] = useState<string | null>(null);
  const [vodError, setVodError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    fetch('/api/channels')
      .then((response) => readJson<{ channels: Channel[] }>(response))
      .then((data) => setChannels(data.channels ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const loadVods = useCallback(async (channel: Channel) => {
    setVodLoading(channel.id);
    setVodError(null);
    try {
      const data = await readJson<{ vods: ChannelVod[] }>(
        await fetch(`/api/channels/${encodeURIComponent(channel.id)}/vods`),
      );
      setVods((prev) => ({ ...prev, [channel.id]: data.vods ?? [] }));
    } catch (err) {
      setVodError((err as Error).message);
    } finally {
      setVodLoading(null);
    }
  }, []);

  const connect = async () => {
    if (!input.trim() || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const created = await readJson<Channel>(
        await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, input: input.trim() }),
        }),
      );
      setChannels((prev) => [...prev.filter((channel) => channel.id !== created.id), created]);
      setInput('');
      setBrowsing(created.id);
      void loadVods(created);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async (channel: Channel) => {
    try {
      await readJson(await fetch(`/api/channels/${encodeURIComponent(channel.id)}`, { method: 'DELETE' }));
      setChannels((prev) => prev.filter((entry) => entry.id !== channel.id));
      if (browsing === channel.id) setBrowsing(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleBrowse = (channel: Channel) => {
    if (browsing === channel.id) {
      setBrowsing(null);
      return;
    }
    setBrowsing(channel.id);
    if (!vods[channel.id]) void loadVods(channel);
  };

  if (!open && !embedded) return null;

  const activeMeta = platformMeta(platform);

  return (
    <div
      className={embedded ? 'connections-embedded' : 'modal-backdrop'}
      onMouseDown={(event) => {
        if (!embedded && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-label="Channel connections">
        <header className="modal-head">
          <div>
            <h2>Connections</h2>
            <p>Link the channels you stream on, then pull a recent stream straight into the clip editor.</p>
          </div>
          {!embedded && (
            <button className="icon-btn" onClick={onClose} title="Close">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </header>

        <div className="modal-body">
          <div className="platform-row">
            {PLATFORMS.map((entry) => (
              <button
                key={entry.id}
                className={`platform-pick${platform === entry.id ? ' active' : ''}`}
                onClick={() => setPlatform(entry.id)}
              >
                <span className="platform-dot" style={{ background: entry.color }} />
                {entry.label}
              </button>
            ))}
          </div>

          <div className="connect-row">
            <input
              className="input"
              placeholder={activeMeta.placeholder}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void connect();
              }}
              disabled={connecting}
            />
            <button className="btn btn-primary" onClick={() => void connect()} disabled={!input.trim() || connecting}>
              {connecting ? 'Linking…' : 'Connect'}
            </button>
          </div>

          <p className="hint">
            Public channel links only — no passwords, API keys or OAuth apps. StreamCut reads the VOD list with yt-dlp
            and stores the channel on this machine.
          </p>

          {error && <div className="error-banner">{error}</div>}

          <div className="channel-list">
            {loading ? (
              <div className="link-loading">
                <span className="spinner sm" /> Loading connections…
              </div>
            ) : channels.length === 0 ? (
              <p className="hint">No channels linked yet. Paste your channel page above, or just paste a VOD link on the import screen.</p>
            ) : (
              channels.map((channel) => {
                const meta = platformMeta(channel.platform);
                const openVods = browsing === channel.id;
                const list = vods[channel.id] ?? [];
                return (
                  <div className="channel-card" key={channel.id}>
                    <div className="channel-top">
                      {channel.avatar ? (
                        <img
                          className="channel-avatar img"
                          src={channel.avatar}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="channel-avatar" style={{ background: `linear-gradient(135deg, ${meta.color}, #7c3aed)` }}>
                          {channel.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="channel-meta">
                        <b>{channel.name}</b>
                        <span>
                          {meta.label} · {channel.handle}
                        </span>
                      </div>
                      <button className="btn btn-sm" onClick={() => toggleBrowse(channel)}>
                        {openVods ? 'Hide streams' : 'Recent streams'}
                      </button>
                      <button className="icon-btn danger" title="Disconnect" onClick={() => void disconnect(channel)}>
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>

                    {openVods && (
                      <div className="vod-list">
                        {vodError && <div className="error-banner">{vodError}</div>}
                        {vodLoading === channel.id ? (
                          <div className="link-loading">
                            <span className="spinner sm" /> Reading recent streams…
                          </div>
                        ) : list.length === 0 ? (
                          <p className="hint">No VODs found for this channel yet.</p>
                        ) : (
                          list.map((vod) => (
                            <div
                              key={vod.id}
                              className="vod-row"
                              role="button"
                              tabIndex={0}
                              onClick={() => onPick(vod)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') onPick(vod);
                              }}
                            >
                              <span className="vod-thumb">
                                {vod.thumbnail ? (
                                  <img
                                    src={vod.thumbnail}
                                    alt=""
                                    loading="lazy"
                                    onError={(event) => {
                                      event.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <span style={{ color: meta.color }}>{meta.label.slice(0, 1)}</span>
                                )}
                              </span>
                              <span className="vod-main">
                                <b>{vod.title}</b>
                                <small>
                                  {fmt(vod.duration)} · {meta.label}
                                </small>
                              </span>
                              <span className="vod-use">Use →</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <p className="hint modal-foot">
            Publishing to TikTok, Instagram and YouTube still happens from each platform&apos;s uploader. Export a clip,
            copy the caption from the Export tab, and post it there.
          </p>
        </div>
      </div>
    </div>
  );
}
