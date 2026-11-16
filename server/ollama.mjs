import { spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';
import http from 'node:http';

const execAsync = promisify(exec);
const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');

let currentPull = null;

export async function detectGpuHardware() {
  let gpuName = 'Standard GPU / CPU';
  let vramGB = 4;

  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('powershell -NoProfile -Command "(Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch \'Basic Display|Virtual\' } | Select-Object -First 1).Name"');
      if (stdout.trim()) gpuName = stdout.trim();

      // Check VRAM
      const { stdout: vramOut } = await execAsync('powershell -NoProfile -Command "(Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch \'Basic Display|Virtual\' } | Select-Object -First 1).AdapterRAM"');
      const bytes = Number(vramOut.trim());
      if (bytes && Number.isFinite(bytes)) {
        vramGB = Math.max(1, Math.round(bytes / (1024 * 1024 * 1024)));
      }
    } else {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=gpu_name,memory.total --format=csv,noheader,nounits');
      if (stdout.trim()) {
        const parts = stdout.trim().split(',');
        gpuName = parts[0]?.trim() || gpuName;
        const mb = Number(parts[1]?.trim());
        if (mb) vramGB = Math.round(mb / 1024);
      }
    }
  } catch {
    /* fallback to defaults */
  }

  // Determine tier
  let tier = 'small';
  if (vramGB >= 14) tier = 'large';
  else if (vramGB >= 6) tier = 'medium';

  return { gpuName, vramGB, tier };
}

export async function checkOllamaRunning() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { running: false, models: [] };
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);
    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}

export async function getOllamaHardwareInfo() {
  const [hardware, status] = await Promise.all([detectGpuHardware(), checkOllamaRunning()]);

  const MODEL_CATALOG = [
    {
      id: 'qwen3:4b',
      name: 'Qwen 3 (4B)',
      size: '2.5 GB',
      vramReq: '3-4 GB VRAM',
      tier: 'small',
      desc: 'Optimized for laptops & smaller GPUs (RTX 3050, 4050, 5050, GTX 1660). High speed, low memory.',
    },
    {
      id: 'qwen3:8b',
      name: 'Qwen 3 (8B)',
      size: '5.2 GB',
      vramReq: '6-8 GB VRAM',
      tier: 'medium',
      desc: 'Balanced flagship: Outstanding viral moment detection & reasoning for 6GB-12GB GPUs.',
    },
    {
      id: 'llama3.1:8b',
      name: 'Llama 3.1 (8B)',
      size: '4.9 GB',
      vramReq: '6-8 GB VRAM',
      tier: 'medium',
      desc: 'Meta flagship open weights for general conversation and clip analysis.',
    },
    {
      id: 'qwen2.5:14b',
      name: 'Qwen 2.5 (14B)',
      size: '9.0 GB',
      vramReq: '12-16 GB VRAM',
      tier: 'large',
      desc: 'Deep reasoning model for high-end GPUs (RTX 3080/4080/4090 desktop).',
    },
    {
      id: 'qwen2.5:32b',
      name: 'Qwen 2.5 (32B)',
      size: '19.0 GB',
      vramReq: '20-24 GB VRAM',
      tier: 'large',
      desc: 'Maximum precision for 24GB VRAM creator workstations.',
    },
  ];

  const models = MODEL_CATALOG.map((m) => ({
    ...m,
    installed: status.models.some((name) => name.startsWith(m.id) || m.id.startsWith(name)),
    recommended: m.tier === hardware.tier,
  }));

  return {
    gpu: hardware,
    ollama: status,
    models,
    pull: currentPull,
  };
}

export async function startOllamaPull(modelName) {
  if (currentPull && currentPull.status !== 'done' && currentPull.status !== 'error') {
    return currentPull;
  }

  currentPull = {
    model: modelName,
    status: 'starting',
    percent: 0,
    completed: 0,
    total: 0,
    error: null,
    startedAt: Date.now(),
  };

  (async () => {
    try {
      const response = await fetch(`${OLLAMA_HOST}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            currentPull.status = data.status || 'pulling';
            if (data.total && data.completed) {
              currentPull.total = data.total;
              currentPull.completed = data.completed;
              currentPull.percent = Math.min(100, Math.round((data.completed / data.total) * 100));
            }
          } catch {
            /* ignore parse chunk */
          }
        }
      }

      currentPull.status = 'done';
      currentPull.percent = 100;
    } catch (err) {
      currentPull.status = 'error';
      currentPull.error = err.message || 'Failed to pull model';
    }
  })();

  return currentPull;
}

export function getOllamaPullStatus() {
  return currentPull;
}
