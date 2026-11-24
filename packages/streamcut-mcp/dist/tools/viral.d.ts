import type { TranscriptCue } from './transcript.js';
export type ViralSegment = {
    rank: number;
    start: number;
    end: number;
    duration: number;
    score: number;
    title: string;
    hook: string;
    whyViral: string;
    previewText: string;
};
export type ViralAnalysisResult = {
    totalAnalyzedSeconds: number;
    segmentsFound: number;
    segments: ViralSegment[];
};
export declare function detectViralSegments(cues: TranscriptCue[], options?: {
    minDuration?: number;
    maxDuration?: number;
    maxResults?: number;
}): ViralAnalysisResult;
