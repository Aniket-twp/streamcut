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
export declare function getCacheDir(): string;
export declare function findTool(name: string, versionArgs: string[]): Promise<ToolInfo | null>;
export declare function getSystemHealth(): Promise<SystemHealth>;
export declare function execCommand(command: string, args: string[], options?: {
    timeoutMs?: number;
    cwd?: string;
}): Promise<{
    stdout: string;
    stderr: string;
    code: number;
}>;
