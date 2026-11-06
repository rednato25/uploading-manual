/**
 * Size and bitrate maths for planning an encode.
 * All bitrates are kilobits per second (kbps), the unit encoders and MediaInfo use.
 * Sizes are given in both GB (10^9 bytes, what trackers usually show) and GiB (2^30, what Windows shows).
 */

/** Matroska adds a little on top of the streams. 0.5% is a fair planning figure. */
export const CONTAINER_OVERHEAD = 0.005;

export interface SizeResult {
  bytes: number;
  gb: number;
  gib: number;
}

export function sizeFromBitrate(videoKbps: number, audioKbps: number, seconds: number): SizeResult {
  const bytes = ((videoKbps + audioKbps) * 1000 * seconds) / 8 * (1 + CONTAINER_OVERHEAD);
  return { bytes, gb: bytes / 1e9, gib: bytes / 2 ** 30 };
}

/** Video bitrate that lands the whole file on a target size (in GB). Use it for 2-pass. */
export function videoKbpsForSize(targetGb: number, audioKbps: number, seconds: number): number {
  if (seconds <= 0) return 0;
  const streamBytes = (targetGb * 1e9) / (1 + CONTAINER_OVERHEAD);
  return (streamBytes * 8) / seconds / 1000 - audioKbps;
}

/**
 * Bits per pixel: how many bits each pixel of each frame gets on average.
 * Only useful for comparing encodes of similar content at similar resolution.
 */
export function bitsPerPixel(videoKbps: number, width: number, height: number, fps: number): number {
  if (!width || !height || !fps) return 0;
  return (videoKbps * 1000) / (width * height * fps);
}

/**
 * Resolution class the way release names use it. Based on width, because a
 * scope film cropped to 1920x800 is still "1080p".
 */
export function resolutionClass(width: number): '2160p' | '1080p' | '720p' | 'SD' {
  if (width >= 3200) return '2160p';
  if (width >= 1800) return '1080p';
  if (width >= 1200) return '720p';
  return 'SD';
}

export const toSeconds = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;
