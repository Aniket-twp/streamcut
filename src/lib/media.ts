export function probeVideo(url: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.crossOrigin = 'anonymous';

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const info = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
      cleanup();
      if (!Number.isFinite(info.duration) || !info.width || !info.height) {
        reject(new Error('That file could not be read as video.'));
      } else {
        resolve(info);
      }
    };
    video.onerror = () => {
      cleanup();
      reject(
        new Error(
          'Could not load that video. Try downloading the clip and dropping the file in — some hosts block cross-origin playback.',
        ),
      );
    };
    video.src = url;
  });
}
