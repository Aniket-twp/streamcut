import fs from 'node:fs';
import path from 'node:path';
import { findTool, execCommand, getCacheDir } from '../utils/tools.js';
export async function exportClip(options) {
    const { sourceUrlOrPath, startTime, endTime, aspectRatio = '9:16', layout = 'crop' } = options;
    const duration = Math.max(1, endTime - startTime);
    const ffmpeg = await findTool('ffmpeg', ['-version']);
    if (!ffmpeg) {
        throw new Error('ffmpeg is required to trim and reframe clips, but was not found.');
    }
    const cache = getCacheDir();
    let localSource = sourceUrlOrPath;
    // If online URL, download only the trimmed segment via yt-dlp
    if (!fs.existsSync(sourceUrlOrPath)) {
        const ytdlp = await findTool('yt-dlp', ['--version']);
        if (!ytdlp) {
            throw new Error('yt-dlp is required to download video from URL.');
        }
        const tempDownload = path.join(cache, `dl_${Date.now()}_temp.mp4`);
        // Download fast stream segment using yt-dlp downloader args
        await execCommand(ytdlp.command, [
            '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '--download-sections', `*${startTime}-${endTime}`,
            '--force-keyframes-at-cuts',
            '-o', tempDownload,
            sourceUrlOrPath,
        ], { timeoutMs: 120000 });
        if (!fs.existsSync(tempDownload)) {
            throw new Error(`Failed to download clip segment from: ${sourceUrlOrPath}`);
        }
        localSource = tempDownload;
    }
    const finalOutput = options.outputPath || path.join(cache, `StreamCut_${Date.now()}_${aspectRatio.replace(':', 'x')}.mp4`);
    // Build FFmpeg video filter for aspect ratio
    // 9:16 = 1080x1920, 1:1 = 1080x1080, 16:9 = 1920x1080
    let filter = '';
    if (aspectRatio === '9:16') {
        if (layout === 'fit_blur') {
            // Split into blurred background and centered video
            filter = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:20[bg];[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2';
        }
        else {
            // Default: Center-crop to 9:16
            filter = 'scale=-2:1920,crop=1080:1920';
        }
    }
    else if (aspectRatio === '1:1') {
        filter = 'scale=-2:1080,crop=1080:1080';
    }
    else {
        // 16:9 standard
        filter = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2';
    }
    const ffmpegArgs = [
        '-y',
        '-ss', String(fs.existsSync(sourceUrlOrPath) ? startTime : 0),
        '-i', localSource,
        '-t', String(duration),
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        finalOutput,
    ];
    const { code, stderr } = await execCommand(ffmpeg.command, ffmpegArgs, { timeoutMs: 90000 });
    if (code !== 0 || !fs.existsSync(finalOutput)) {
        throw new Error(`FFmpeg rendering failed: ${stderr.slice(-400)}`);
    }
    const stat = fs.statSync(finalOutput);
    return {
        success: true,
        outputPath: finalOutput,
        duration,
        fileSizeBytes: stat.size,
        aspectRatio,
    };
}
