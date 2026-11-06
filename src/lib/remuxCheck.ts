/**
 * Sanity checks for a remux, run on a MediaInfo text dump.
 *
 * MediaInfo prints one block per track: General, Video, Audio #1, Text #1, Menu.
 * Other and Image sections (timecode, cover art) are recognised and ignored.
 * Each block has "Key : value" lines. A partial dump still parses, but missing
 * blocks make some checks impossible.
 */

export type Verdict = 'ok' | 'warn' | 'bad';

export interface Finding {
  verdict: Verdict;
  text: string;
}

type Kind = 'general' | 'video' | 'audio' | 'text' | 'menu';

interface Track {
  kind: Kind;
  fields: Map<string, string>;
}

const HEADER = /^(General|Video|Audio|Text|Menu|Other|Image)(?:\s*#\s*(\d+))?\s*$/i;

function parseTracks(text: string): Track[] {
  const tracks: Track[] = [];
  let current: Track | undefined;

  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const header = line.match(HEADER);
    if (header) {
      const kind = header[1].toLowerCase();
      // Other and Image fields (timecode, cover art) are not part of a track.
      // Dropping them stops their Format and Language lines leaking into the
      // subtitle or audio track above.
      if (kind === 'other' || kind === 'image') {
        current = undefined;
        continue;
      }
      current = { kind: kind as Kind, fields: new Map() };
      tracks.push(current);
      continue;
    }

    if (!current) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    current.fields.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }

  return tracks;
}

function field(track: Track | undefined, key: string): string | undefined {
  return track?.fields.get(key.toLowerCase());
}

function numberFrom(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.replace(/[\s\u00a0]/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

/** "27.1 Mb/s", "9 000 kb/s", "0.051 Gb/s" -> Mbps. */
function bitrateMbps(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/([\d\s\u00a0.,]+)\s*(kb\/s|mb\/s|gb\/s|b\/s)/i);
  if (!match) return undefined;
  const amount = Number(match[1].replace(/[\s\u00a0]/g, '').replace(/,/g, ''));
  if (!Number.isFinite(amount)) return undefined;
  const unit = match[2].toLowerCase();
  if (unit === 'gb/s') return amount * 1000;
  if (unit === 'mb/s') return amount;
  if (unit === 'kb/s') return amount / 1000;
  return amount / 1_000_000;
}

function isLossless(format: string | undefined): boolean {
  const f = (format ?? '').toLowerCase();
  return f.startsWith('mlp fba') || f.startsWith('dts xll') || f.startsWith('pcm') || f === 'flac';
}

function trackName(track: Track, tracks: Track[]): string {
  if (track.kind === 'audio') {
    return `Audio track ${tracks.filter((t) => t.kind === 'audio').indexOf(track) + 1}`;
  }
  if (track.kind === 'text') {
    return `Subtitle track ${tracks.filter((t) => t.kind === 'text').indexOf(track) + 1}`;
  }
  return 'Video track';
}

export function checkRemux(mediainfoText: string): Finding[] {
  const tracks = parseTracks(mediainfoText ?? '');
  const video = tracks.find((t) => t.kind === 'video');
  const audio = tracks.filter((t) => t.kind === 'audio');
  const subtitles = tracks.filter((t) => t.kind === 'text');
  const hasMenu = tracks.some((t) => t.kind === 'menu');
  const findings: Finding[] = [];

  if (!video) {
    findings.push({
      verdict: 'bad',
      text: 'No video track found. Paste the full MediaInfo text, including the Video section.',
    });
  } else {
    const format = field(video, 'Format');
    const discFormats = ['avc', 'hevc', 'vc-1', 'mpeg video'];
    if (!format || !discFormats.includes(format.toLowerCase())) {
      findings.push({
        verdict: 'bad',
        text: `Video format is ${format ?? 'missing'}. A disc remux should be AVC, HEVC, VC-1 or MPEG Video.`,
      });
    } else {
      findings.push({ verdict: 'ok', text: `Video format is ${format}.` });
    }

    const library = field(video, 'Writing library');
    const settings = field(video, 'Encoding settings');
    if ([library, settings].some((value) => value && /x26[45]/i.test(value))) {
      findings.push({
        verdict: 'bad',
        text: 'The video has x264 or x265 encoding settings. This file was re-encoded, not remuxed.',
      });
    } else {
      findings.push({ verdict: 'ok', text: 'No x264 or x265 settings line. This looks like a real remux.' });
    }

    const width = numberFrom(field(video, 'Width'));
    const height = numberFrom(field(video, 'Height'));
    const mbps = bitrateMbps(field(video, 'Bit rate'));
    const uhd = (width ?? 0) >= 3800 || (height ?? 0) >= 2000;

    if (mbps !== undefined && width !== undefined) {
      if (width >= 1800 && width < 2000 && mbps < 15) {
        findings.push({
          verdict: 'warn',
          text: `Video bitrate is ${mbps.toFixed(1)} Mb/s. That is low for a 1080p disc, so check the source. This is a rule of thumb, not a tracker rule.`,
        });
      } else if (uhd && mbps < 30) {
        findings.push({
          verdict: 'warn',
          text: `Video bitrate is ${mbps.toFixed(1)} Mb/s. That is low for a UHD disc, so check the source. This is a rule of thumb, not a tracker rule.`,
        });
      }
    }

    if (width !== undefined && width !== 1920 && width !== 3840) {
      findings.push({
        verdict: 'warn',
        text: `Width is ${width} pixels, not 1920 or 3840. A remux keeps the full frame, so this looks cropped.`,
      });
    }

    if (uhd && !field(video, 'HDR format')) {
      findings.push({
        verdict: 'warn',
        text: '2160p file with no HDR format line. Check whether the disc is HDR.',
      });
    }
  }

  if (audio.length === 0) {
    findings.push({ verdict: 'warn', text: 'No audio track found. A remux should have at least one.' });
  } else if (!audio.some((track) => isLossless(field(track, 'Format')))) {
    findings.push({
      verdict: 'warn',
      text: 'No lossless audio track. A disc remux usually has TrueHD, DTS-HD MA, PCM or FLAC.',
    });
  }

  for (const track of [...audio, ...subtitles]) {
    if (!field(track, 'Language')) {
      findings.push({
        verdict: 'bad',
        text: `${trackName(track, tracks)} has no language. Every audio and subtitle track needs one.`,
      });
    }
  }

  for (const track of audio) {
    if ((field(track, 'Format') ?? '').toLowerCase().startsWith('pcm')) {
      findings.push({
        verdict: 'warn',
        text: `${trackName(track, tracks)} is PCM. Convert it to FLAC to save space.`,
      });
    }
  }

  if (!hasMenu) {
    findings.push({ verdict: 'warn', text: 'No Menu section, so the remux has no chapters.' });
  }

  return findings;
}
