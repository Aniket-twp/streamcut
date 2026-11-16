import { useEffect, useState } from 'react';
import { api } from '../lib/store';

type ModelOption = {
  id: string;
  name: string;
  size: string;
  vramReq: string;
  tier: 'small' | 'medium' | 'large';
  desc: string;
  installed?: boolean;
  recommended?: boolean;
};

type HardwareInfo = {
  gpu: { gpuName: string; vramGB: number; tier: 'small' | 'medium' | 'large' };
  ollama: { running: boolean; models: string[] };
  models: ModelOption[];
};

type PullStatus = {
  model: string;
  status: string;
  percent: number;
  completed: number;
  total: number;
  error?: string | null;
};

export default function OllamaSetupSheet({
  isOpen,
  onClose,
  onActivated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onActivated: (modelId: string) => void;
}) {
  const [info, setInfo] = useState<HardwareInfo | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('qwen3:8b');
  const [pulling, setPulling] = useState<PullStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setLoading(true);

    fetch('/api/ollama/hardware')
      .then((r) => r.json())
      .then((data: HardwareInfo) => {
        if (!alive) return;
        setInfo(data);
        const rec = data.models.find((m) => m.recommended) || data.models[0];
        if (rec) setSelectedModel(rec.id);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!pulling || pulling.status === 'done' || pulling.status === 'error') return;
    const interval = setInterval(() => {
      fetch('/api/ollama/pull')
        .then((r) => r.json())
        .then((status: PullStatus) => {
          setPulling(status);
          if (status.status === 'done') {
            onActivated(status.model);
          }
        })
        .catch(() => {});
    }, 1200);

    return () => clearInterval(interval);
  }, [pulling, onActivated]);

  if (!isOpen) return null;

  const startDownload = async () => {
    try {
      setPulling({
        model: selectedModel,
        status: 'starting',
        percent: 0,
        completed: 0,
        total: 0,
      });

      const res = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });
      const data = await res.json();
      setPulling(data);
    } catch (e: any) {
      setPulling({
        model: selectedModel,
        status: 'error',
        percent: 0,
        completed: 0,
        total: 0,
        error: e.message || 'Download failed',
      });
    }
  };

  const selectedModelObj = info?.models.find((m) => m.id === selectedModel);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-content glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <div>
            <span className="sheet-badge">⚡ 100% Offline AI Installer</span>
            <h2 className="sheet-title">Automated Ollama &amp; Qwen Setup</h2>
          </div>
          <button className="icon-btn sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="sheet-loading">
            <span className="dot" /> Detecting GPU hardware and VRAM specifications…
          </div>
        ) : (
          <>
            {/* Detected Hardware Pod */}
            <div className="hardware-pill-pod">
              <div className="hw-icon">🖥️</div>
              <div className="hw-details">
                <span className="hw-label">Detected Graphics Hardware:</span>
                <span className="hw-value">
                  {info?.gpu.gpuName} · ~{info?.gpu.vramGB} GB VRAM
                </span>
              </div>
              <span className={`hw-tier-tag tier-${info?.gpu.tier}`}>
                {info?.gpu.tier === 'large' ? 'Big GPU (16GB+)' : info?.gpu.tier === 'medium' ? 'Standard GPU (6-12GB)' : 'Compact GPU (4GB)'}
              </span>
            </div>

            <p className="sheet-intro">
              Select your model tier below. Everything is automated—click once to download, initialize Ollama, and activate offline clipping.
            </p>

            {/* Model Selection Options */}
            <div className="model-tier-list">
              {info?.models.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <div
                    key={m.id}
                    className={`model-tier-card${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelectedModel(m.id)}
                  >
                    <div className="model-tier-head">
                      <div className="model-tier-title-row">
                        <span className="model-name">{m.name}</span>
                        {m.recommended && <span className="rec-badge">Recommended for your GPU</span>}
                        {m.installed && <span className="installed-badge">● Already Downloaded</span>}
                      </div>
                      <span className="model-size">{m.size} · {m.vramReq}</span>
                    </div>
                    <p className="model-desc">{m.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Live Download Progress */}
            {pulling && pulling.status !== 'done' && (
              <div className="pull-progress-box">
                <div className="progress-labels">
                  <span>{pulling.status === 'error' ? 'Error downloading' : `Downloading ${pulling.model}…`}</span>
                  <span>{pulling.percent}%</span>
                </div>
                <div className="pull-progress-bar">
                  <div
                    className="pull-progress-fill"
                    style={{ width: `${Math.max(5, pulling.percent)}%` }}
                  />
                </div>
                {pulling.error && <p className="pull-error">{pulling.error}</p>}
              </div>
            )}

            {/* Footer Action */}
            <div className="sheet-actions">
              <button className="btn btn-secondary" onClick={onClose} disabled={Boolean(pulling && pulling.status !== 'done' && pulling.status !== 'error')}>
                Cancel
              </button>
              {selectedModelObj?.installed ? (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onActivated(selectedModel);
                    onClose();
                  }}
                >
                  Activate {selectedModel} Now (Instant)
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={startDownload}
                  disabled={Boolean(pulling && pulling.status !== 'done' && pulling.status !== 'error')}
                >
                  {pulling && pulling.status !== 'done' && pulling.status !== 'error'
                    ? `Downloading ${selectedModel} (${pulling.percent}%)…`
                    : `⚡ 1-Click Download & Setup (${selectedModelObj?.size || 'Auto'})`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
