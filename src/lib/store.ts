import type {
  AiJob,
  AiStatus,
  Aspect,
  CaptionTemplate,
  Channel,
  GeminiStatus,
  Health,
  Project,
  SchedulePost,
  TranscriptionJob,
  ViralPackage,
  WorkspaceSettings,
} from '../types';
import { readJson } from './api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return readJson<T>(await fetch(path, init));
}

function withBody(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const api = {
  health: () => request<Health>('/api/health'),

  projects: () => request<{ projects: Project[] }>('/api/projects').then((data) => data.projects),
  project: (id: string) => request<Project>(`/api/projects/${encodeURIComponent(id)}`),
  createProject: (body: Partial<Project>) => request<Project>('/api/projects', withBody('POST', body)),
  updateProject: (id: string, body: Partial<Project>) =>
    request<Project>(`/api/projects/${encodeURIComponent(id)}`, withBody('PATCH', body)),
  deleteProject: (id: string) => request<{ ok: boolean }>(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  schedules: () => request<{ schedules: SchedulePost[] }>('/api/schedules').then((data) => data.schedules),
  createSchedule: (body: Partial<SchedulePost>) =>
    request<SchedulePost>('/api/schedules', withBody('POST', body)),
  updateSchedule: (id: string, body: Partial<SchedulePost>) =>
    request<SchedulePost>(`/api/schedules/${encodeURIComponent(id)}`, withBody('PATCH', body)),
  deleteSchedule: (id: string) =>
    request<{ ok: boolean }>(`/api/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  templates: () => request<{ templates: CaptionTemplate[] }>('/api/templates').then((data) => data.templates),
  createTemplate: (body: { name: string; style: unknown }) =>
    request<CaptionTemplate>('/api/templates', withBody('POST', body)),
  deleteTemplate: (id: string) =>
    request<{ ok: boolean }>(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  settings: () => request<WorkspaceSettings>('/api/settings'),
  updateSettings: (body: Partial<WorkspaceSettings>) =>
    request<WorkspaceSettings>('/api/settings', withBody('PATCH', body)),

  channels: () => request<{ channels: Channel[] }>('/api/channels').then((data) => data.channels),
  addChannel: (platform: string, input: string) =>
    request<Channel>('/api/channels', withBody('POST', { platform, input })),
  removeChannel: (id: string) =>
    request<{ ok: boolean }>(`/api/channels/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  channelVods: (id: string) =>
    request<{ vods: unknown[] }>(`/api/channels/${encodeURIComponent(id)}/vods`).then((data) => data.vods),

  cancelJob: (id: string) => request<unknown>('/api/link/cancel', withBody('POST', { id })),

  geminiStatus: () => request<GeminiStatus>('/api/gemini/status'),
  generateViralPackage: (body: {
    clipTitle: string;
    excerpt?: string;
    cues?: unknown[];
    duration?: number;
    platform?: string;
    tone?: string;
  }) => request<ViralPackage>('/api/gemini/package', withBody('POST', body)),

  aiStatus: (fresh = false) => request<AiStatus>(`/api/ai/status${fresh ? '?fresh=1' : ''}`),
  aiJobs: () => request<AiJob[]>('/api/ai/jobs'),
  startAiJob: (body: {
    mediaUrl: string;
    duration: number;
    count: number;
    minLength: number;
    maxLength: number;
    focus?: string;
    language?: string;
    chatContext?: Array<{ time: number; user?: string; message: string }>;
  }) => request<AiJob>('/api/ai/job', withBody('POST', body)),
  aiJob: (id: string) => request<AiJob>(`/api/ai/job?id=${encodeURIComponent(id)}`),
  cancelAiJob: (id: string) => request<AiJob>('/api/ai/cancel', withBody('POST', { id })),
  startTranscription: (body: { mediaUrl: string; duration?: number; language?: string }) => request<TranscriptionJob>('/api/transcription/job', withBody('POST', body)),
  transcriptionJob: (id: string) => request<TranscriptionJob>(`/api/transcription/job?id=${encodeURIComponent(id)}`),
  cancelTranscription: (id: string) => request<TranscriptionJob>('/api/transcription/cancel', withBody('POST', { id })),
};

/** Streams a local file into the workspace so projects survive reloads. */
export function uploadVideo(file: File, onProgress?: (value: number) => void): Promise<{ url: string; name: string; size: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/uploads');
    xhr.setRequestHeader('x-file-name', file.name);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { url?: string; name?: string; size?: number; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          resolve({ url: data.url, name: data.name || file.name, size: data.size || file.size });
        } else {
          reject(new Error(data.error || 'The upload failed.'));
        }
      } catch {
        reject(new Error('The upload failed.'));
      }
    };
    xhr.onerror = () => reject(new Error('The upload failed — is the local server running?'));
    xhr.send(file);
  });
}

export const ASPECT_LABEL: Record<Aspect, string> = {
  '9:16': '9:16 · Shorts & Reels',
  '16:9': '16:9 · Landscape',
  '1:1': '1:1 · Square',
};

export function aspectDimensions(aspect: Aspect, width: number): { width: number; height: number } {
  if (aspect === '16:9') return { width: Math.round((width * 16) / 9), height: width };
  if (aspect === '1:1') return { width, height: width };
  return { width, height: Math.round((width * 16) / 9) };
}

export function relativeTime(timestamp: number): string {
  if (!timestamp) return '—';
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
