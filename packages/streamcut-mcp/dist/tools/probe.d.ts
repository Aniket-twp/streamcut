export type VideoProbeResult = {
    title: string;
    duration: number;
    durationFormatted: string;
    uploader?: string;
    width?: number;
    height?: number;
    fps?: number;
    isLive?: boolean;
    thumbnail?: string;
    sourceType: 'online_stream' | 'local_file';
};
export declare function probeMedia(urlOrPath: string): Promise<VideoProbeResult>;
