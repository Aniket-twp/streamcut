import Connections from './Connections';
import { navigate } from '../lib/router';
import type { ChannelVod } from '../types';

const DESTINATIONS = [
  {
    id: 'tiktok',
    label: 'TikTok',
    color: '#25f4ee',
    scopes: 'video.publish, video.upload',
    requirement: 'TikTok developer app plus Content Posting API audit for public posts.',
  },
  {
    id: 'youtube',
    label: 'YouTube / Shorts',
    color: '#ff4e45',
    scopes: 'https://www.googleapis.com/auth/youtube.upload',
    requirement: 'Google Cloud project with an OAuth consent screen and a Web client.',
  },
  {
    id: 'instagram',
    label: 'Instagram Reels',
    color: '#e1306c',
    scopes: 'instagram_basic, instagram_content_publish',
    requirement: 'Meta app, Instagram Business/Creator account and app review.',
  },
  {
    id: 'facebook',
    label: 'Facebook Reels',
    color: '#1877f2',
    scopes: 'pages_manage_posts, pages_read_engagement',
    requirement: 'Meta app with a Facebook Page and the reels publishing permission.',
  },
  {
    id: 'x',
    label: 'X',
    color: '#e7e9ea',
    scopes: 'tweet.read, tweet.write, media.write, users.read',
    requirement: 'X developer app with OAuth 2.0 user-context access.',
  },
];

export default function ConnectionsScreen() {
  const pickVod = (vod: ChannelVod) => {
    navigate(`/ai-clips?url=${encodeURIComponent(vod.url)}&platform=${vod.platform}`);
  };

  return (
    <div className="page connections-page">
      <div className="connection-intro">
        <h2>Connections</h2>
        <p>
          Import sources are channel links read locally with yt-dlp. Publishing destinations need OAuth apps — none are
          configured in this build, so they stay clearly disconnected instead of pretending to work.
        </p>
      </div>

      <section className="panel-block">
        <div className="section-title">
          <div>
            <h2>Import sources</h2>
            <p>Twitch, YouTube and Kick channels you have linked.</p>
          </div>
          <span className="pill">No passwords · no API keys</span>
        </div>
        <Connections open onClose={() => undefined} onPick={pickVod} embedded />
      </section>

      <section className="panel-block">
        <div className="section-title">
          <div>
            <h2>Publishing destinations</h2>
            <p>Required before the Publisher can send posts automatically.</p>
          </div>
          <span className="status-pill draft">Setup required</span>
        </div>

        <div className="destination-cards">
          {DESTINATIONS.map((destination) => (
            <article className="destination-card" key={destination.id}>
              <div className="destination-head">
                <span className="destination-logo" style={{ background: destination.color }}>
                  {destination.label.slice(0, 1)}
                </span>
                <div>
                  <b>{destination.label}</b>
                  <span>Not connected · last checked never</span>
                </div>
              </div>
              <details className="setup-details">
                <summary>What is needed</summary>
                <p>{destination.requirement}</p>
                <p className="scopes">
                  Scopes: <code>{destination.scopes}</code>
                </p>
                <p className="hint">
                  Add the client ID/secret as server environment variables and a redirect URI pointing at this host.
                  Never enter a platform password here.
                </p>
              </details>
              <div className="destination-actions">
                <button className="btn btn-sm" disabled title="OAuth app credentials are not configured">
                  Connect
                </button>
                <button className="link" onClick={() => navigate('/settings')}>
                  Credential setup
                </button>
              </div>
            </article>
          ))}
        </div>
        <p className="hint">
          Until OAuth is configured, the Publisher saves manual plans only. URL and file import keep working without any
          of these connections.
        </p>
      </section>
    </div>
  );
}
