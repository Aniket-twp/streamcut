import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';

export type ToolInfo = {
  command: string;
  version: string;
  source: 'local' | 'global';
};

export type SystemHealth = {
  ffmpeg: ToolInfo | null;
  ffprobe: ToolInfo | null;
  ytdlp: ToolInfo | null;
  cacheDir: string;
  os: string;
};

export function getCacheDir(): string {
  const base = process.env.STREAMCUT_CACHE_DIR || path.join(os.homedir(), '.streamcut', 'cache');
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  }
  return base;
}

function checkVersion(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      resolve(null);
      return;
    }

    let output = '';
    let done = false;
    const finish = (val: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(val);
    };

    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish(null);
    }, 8000);

    child.stdout.on('data', (d) => {
      if (output.length < 10000) output += d.toString();
    });
    child.on('error', () => finish(null));
    child.on('close', (code) => {
      const line = output.split('\n')[0]?.trim();
      finish(code === 0 && line ? line.slice(0, 100) : null);
    });
  });
}

export async function findTool(name: string, versionArgs: string[]): Promise<ToolInfo | null> {
  // Check common local directories
  const isWin = process.platform === 'win32';
  const binName = isWin ? `${name}.exe` : name;
  const candidates = [
    path.join(process.cwd(), 'tools', binName),
    path.join(process.cwd(), '..', '..', 'tools', binName),
    path.join(os.homedir(), '.local', 'bin', binName),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const ver = await checkVersion(c, versionArgs);
      if (ver) return { command: c, version: ver, source: 'local' };
    }
  }

  // Check global PATH
  const globalVer = await checkVersion(name, versionArgs);
  if (globalVer) {
    return { command: name, version: globalVer, source: 'global' };
  }

  return null;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [ffmpeg, ffprobe, ytdlp] = await Promise.all([
    findTool('ffmpeg', ['-version']),
    findTool('ffprobe', ['-version']),
    findTool('yt-dlp', ['--version']),
  ]);

  return {
    ffmpeg,
    ffprobe,
    ytdlp,
    cacheDir: getCacheDir(),
    os: `${os.type()} ${os.arch()}`,
  };
}

export function execCommand(command: string, args: string[], options: { timeoutMs?: number; cwd?: string } = {}): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      cwd: options.cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let done = false;

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill(); } catch {}
      reject(new Error(`Command timed out after ${options.timeoutMs || 60000}ms: ${command} ${args.join(' ')}`));
    }, options.timeoutMs || 60000);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}
