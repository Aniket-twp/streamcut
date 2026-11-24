export type TranscriptCue = {
    start: number;
    end: number;
    text: string;
};
export type TranscriptResult = {
    sourceUrl: string;
    language: string;
    totalCues: number;
    fullText: string;
    cues: TranscriptCue[];
};
export declare function extractTranscript(url: string, lang?: string): Promise<TranscriptResult>;
