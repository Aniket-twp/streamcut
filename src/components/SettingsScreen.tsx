import { useEffect, useState } from 'react';
import { api } from '../lib/store';
import type { Aspect, GeminiStatus, Project, WorkspaceSettings } from '../types';
import OllamaSetupSheet from './OllamaSetupSheet';

type Props = {
  settings: WorkspaceSettings | null;
  projects: Project[];
  onSaved: (settings: WorkspaceSettings) => void;
  notify: (message: string) => void;
};

export default function SettingsScreen({ settings, projects, onSaved, notify }: Props) {
  const [workspaceName, setWorkspaceName] = useState(settings?.workspaceName ?? '');
  const [defaultAspect, setDefaultAspect] = useState<Aspect>(settings?.defaultAspect ?? '9:16');
  const [defaultClipLength, setDefaultClipLength] = useState(settings?.defaultClipLength ?? 30);
  const [timezone, setTimezone] = useState(settings?.timezone ?? '');
  const [geminiApiKey, setGeminiApiKey] = useState(settings?.geminiApiKey ?? '');
  const [geminiModel, setGeminiModel] = useState(settings?.geminiModel ?? 'gemini-4-hydrogen');
  const [openaiApiKey, setOpenaiApiKey] = useState(settings?.openaiApiKey ?? '');
  const [claudeApiKey, setClaudeApiKey] = useState(settings?.claudeApiKey ?? '');
  const [deepseekApiKey, setDeepseekApiKey] = useState(settings?.deepseekApiKey ?? '');
  const [aiEngine, setAiEngine] = useState<'gemini' | 'ollama' | 'openai' | 'claude' | 'deepseek'>(settings?.aiEngine ?? 'gemini');
  const [showKey, setShowKey] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatus | null>(null);
  const [testingGemini, setTestingGemini] = useState(false);
  const [showOllamaSheet, setShowOllamaSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setWorkspaceName(settings.workspaceName);
    setDefaultAspect(settings.defaultAspect);
    setDefaultClipLength(settings.defaultClipLength);
    setTimezone(settings.timezone);
    setGeminiApiKey(settings.geminiApiKey ?? '');
    setGeminiModel(settings.geminiModel ?? 'gemini-4-hydrogen');
    setOpenaiApiKey(settings.openaiApiKey ?? '');
    setClaudeApiKey(settings.claudeApiKey ?? '');
    setDeepseekApiKey(settings.deepseekApiKey ?? '');
    setAiEngine(settings.aiEngine ?? 'gemini');
  }, [settings]);

  useEffect(() => {
    api.geminiStatus()
      .then(setGeminiStatus)
      .catch(() => setGeminiStatus(null));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await api.updateSettings({
        workspaceName,
        defaultAspect,
        defaultClipLength,
        timezone,
        geminiApiKey,
        geminiModel,
        openaiApiKey,
        claudeApiKey,
        deepseekApiKey,
        aiEngine,
      });
      onSaved(saved);
      const status = await api.geminiStatus().catch(() => null);
      if (status) setGeminiStatus(status);
      notify('Workspace settings saved.');
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const testGeminiConnection = async () => {
    setTestingGemini(true);
    try {
      await api.updateSettings({ geminiApiKey, geminiModel, aiEngine });
      const status = await api.geminiStatus();
      setGeminiStatus(status);
      if (status.ready) {
        notify(`Gemini API connection active (${status.source === 'env' ? 'Environment' : 'Settings'}).`);
      } else {
        notify(status.detail || 'Gemini API key is missing.');
      }
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setTestingGemini(false);
    }
  };

  return (
    <div className="page settings-page">
      <section className="panel-card">
        <h3>Workspace</h3>
        <label className="field">
          <span>Workspace name</span>
          <input className="input" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} maxLength={80} />
        </label>
        <div className="grid2">
          <label className="field">
            <span>Default export aspect</span>
            <select className="input" value={defaultAspect} onChange={(event) => setDefaultAspect(event.target.value as Aspect)}>
              <option value="9:16">9:16 · Shorts &amp; Reels</option>
              <option value="16:9">16:9 · Landscape</option>
              <option value="1:1">1:1 · Square</option>
            </select>
          </label>
          <label className="field">
            <span>Default clip length (seconds)</span>
            <input
              className="input"
              type="number"
              min={5}
              max={600}
              value={defaultClipLength}
              onChange={(event) => setDefaultClipLength(Number(event.target.value))}
            />
          </label>
        </div>
        <label className="field">
          <span>Timezone for schedules</span>
          <input className="input" value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Europe/London" />
        </label>
        <button className="btn btn-lime" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </section>

      <section className="panel-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Bring Your Own AI (BYOK)</h3>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: geminiStatus?.ready || openaiApiKey || claudeApiKey || deepseekApiKey ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: geminiStatus?.ready || openaiApiKey || claudeApiKey || deepseekApiKey ? '#4ade80' : '#f87171',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          >
            {aiEngine === 'ollama' ? '● Local Ollama' : (geminiStatus?.ready || openaiApiKey || claudeApiKey || deepseekApiKey) ? `● ${aiEngine.toUpperCase()} Connected` : '○ Key Needed'}
          </span>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Connect your existing OpenAI ChatGPT, Anthropic Claude, DeepSeek, or Google Gemini subscription to power ClipGPT cloud highlight analysis.
        </p>

        <div className="field">
          <span>Active AI Engine</span>
          <select
            className="input"
            value={aiEngine}
            onChange={(e) => setAiEngine(e.target.value as 'gemini' | 'ollama' | 'openai' | 'claude' | 'deepseek')}
          >
            <option value="deepseek">🟢 DeepSeek (Open-Weights: V4.1 Flash / V3 / R1)</option>
            <option value="ollama">🟢 Ollama (100% Open-Source: Qwen 3 / Llama 3.3)</option>
            <option value="gemini">⚡ Google Gemini (Free Tier &amp; Multimodal)</option>
            <option value="claude">🔒 Anthropic Claude (Proprietary: Claude 3.5 Sonnet)</option>
            <option value="openai">🔒 OpenAI (Proprietary: GPT-4o / 4o-mini)</option>
          </select>
        </div>

        {aiEngine === 'gemini' && (
          <label className="field">
            <span>Gemini API Key</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                type={showKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Paste your Gemini API key (AIzaSy...)"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowKey(!showKey)}
                style={{ minWidth: 70 }}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
        )}

        {aiEngine === 'openai' && (
          <label className="field">
            <span>OpenAI API Key</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                type={showKey ? 'text' : 'password'}
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-proj-..."
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowKey(!showKey)}
                style={{ minWidth: 70 }}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
        )}

        {aiEngine === 'claude' && (
          <div>
            <label className="field">
              <span>Anthropic Claude API Key (Proprietary / Commercial API)</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  type={showKey ? 'text' : 'password'}
                  value={claudeApiKey}
                  onChange={(e) => setClaudeApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowKey(!showKey)}
                  style={{ minWidth: 70 }}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <p className="hint" style={{ marginTop: 4 }}>
              Note: Anthropic does not offer open-source models—all Claude models (3.5 Sonnet, 3.5 Haiku, Opus) are closed-source commercial APIs. For top-tier open-source/open-weights models, select <b>DeepSeek V4.1/R1</b> or <b>Ollama (Qwen 3 / Llama 3.3)</b>.
            </p>
          </div>
        )}

        {aiEngine === 'deepseek' && (
          <label className="field">
            <span>DeepSeek API Key</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                type={showKey ? 'text' : 'password'}
                value={deepseekApiKey}
                onChange={(e) => setDeepseekApiKey(e.target.value)}
                placeholder="sk-..."
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowKey(!showKey)}
                style={{ minWidth: 70 }}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
        )}

        {aiEngine === 'ollama' && (
          <div style={{ marginTop: 14, padding: 16, borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <b style={{ display: 'block', fontSize: '0.95rem' }}>Automated Ollama &amp; Qwen Setup</b>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Auto-detects your GPU, matches models for small vs big VRAM, and installs in 1 click.</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowOllamaSheet(true)}
              >
                ⚡ 1-Click Automated Download &amp; Setup
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
          <button className="btn btn-lime" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save AI configuration'}
          </button>
          {aiEngine === 'gemini' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void testGeminiConnection()}
              disabled={testingGemini}
            >
              {testingGemini ? 'Testing…' : 'Test connection'}
            </button>
          )}
        </div>
      </section>

      <section className="panel-card">
        <h3>This workspace</h3>
        <div className="settings-facts">
          <div>
            <span>Host</span>
            <b>{window.location.host}</b>
          </div>
          <div>
            <span>Projects</span>
            <b>{projects.length}</b>
          </div>
          <div>
            <span>Storage</span>
            <b>Local .cache folder</b>
          </div>
          <div>
            <span>Generated media</span>
            <b>Kept on this computer</b>
          </div>
        </div>
        <p className="hint">
          Projects, clip edits and schedules are stored by the local server in <code>.cache/store.json</code>. Uploaded
          videos live in <code>.cache/uploads</code>; downloaded stream segments live in <code>.cache/clips</code> and
          expire after six hours. Nothing is sent to a cloud service.
        </p>
        <p className="hint">
          Phone access and remote devices use the same workspace while the server is running in LAN mode. Do not expose
          this server to a public network — the API has no authentication.
        </p>
      </section>

      <section className="panel-card">
        <h3>Publishing APIs</h3>
        <p className="hint">
          TikTok, YouTube, Instagram, Facebook and X publishing needs OAuth apps and approved API access. No credentials
          are configured, so schedules are saved as manual plans and nothing posts automatically. Set up credentials
          server-side first; the Connection cards list the required scopes.
        </p>
      </section>

      <OllamaSetupSheet
        isOpen={showOllamaSheet}
        onClose={() => setShowOllamaSheet(false)}
        onActivated={(modelId) => {
          setAiEngine('ollama');
          notify(`Activated Ollama with ${modelId}!`);
        }}
      />
    </div>
  );
}
