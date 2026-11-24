export type ExportOptions = {
    sourceUrlOrPath: string;
    startTime: number;
    endTime: number;
    aspectRatio?: '9:16' | '1:1' | '16:9';
    layout?: 'crop' | 'fit_blur' | 'split';
    outputPath?: string;
};
export type ExportResult = {
    success: boolean;
    outputPath: string;
    duration: number;
    fileSizeBytes: number;
    aspectRatio: string;
};
export declare function exportClip(options: ExportOptions): Promise<ExportResult>;
