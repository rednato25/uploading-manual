/**
 * Reads the settings string that x264 and x265 write into every encode.
 *
 * Accepts any of:
 *  - a full MediaInfo text dump (uses the "Encoding settings" line)
 *  - just the "Encoding settings" value (" / " separated)
 *  - the raw SEI string from `strings file.mkv` ("... options: cabac=1 ref=5 ...")
 *
 * The rate-control logic follows the encoders' own source code:
 *  - x264 writes rc=crf | 2pass | abr | cbr | cqp
 *  - x265 writes rc=crf | abr | cbr | cqp, and marks multi-pass with stats-read
 *    (it never writes "2pass")
 */

export type Encoder = 'x264' | 'x265' | 'unknown';
export type Verdict = 'ok' | 'warn' | 'bad';

export interface Finding {
  verdict: Verdict;
  text: string;
}

export interface RateControl {
  mode: 'crf' | '2pass' | 'abr' | 'cbr' | 'cqp' | 'firstpass' | 'unknown';
  label: string;
  value?: string;
  verdict: Verdict;
}

export interface HeaderReport {
  encoder: Encoder;
  params: Record<string, string | boolean>;
  rateControl: RateControl;
  presetGuess?: string;
  tuneGuess?: string;
  highlights: { label: string; value: string }[];
  findings: Finding[];
}

/** Pull the settings part out of whatever was pasted. */
export function extractSettings(input: string): string {
  const text = input.replace(/\r/g, '');
  const line = text.split('\n').find((l) => /^\s*Encoding settings\s*:/i.test(l));
  if (line) return line.replace(/^\s*Encoding settings\s*:\s*/i, '').trim();
  const opt = text.indexOf('options:');
  if (opt !== -1) return text.slice(opt + 'options:'.length).trim();
  return text.trim();
}

/** Turn "a=1 / b=2 / wpp / no-sao" or "a=1 b=2 wpp no-sao" into a map. */
export function parseParams(settings: string): Record<string, string | boolean> {
  const tokens = settings.includes(' / ')
    ? settings.split(' / ')
    : settings.split(/\s+/);
  const out: Record<string, string | boolean> = {};
  for (const raw of tokens) {
    const t = raw.trim();
    if (!t) continue;
    const eq = t.indexOf('=');
    if (eq > 0) {
      out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    } else if (t.startsWith('no-')) {
      out[t.slice(3)] = false;
    } else {
      out[t] = true;
    }
  }
  return out;
}

function detectEncoder(input: string, p: Record<string, string | boolean>): Encoder {
  // Parameter names are the reliable signal; the banner text is the fallback.
  if ('cabac' in p) return 'x264';
  if ('ctu' in p || 'psy-rdoq' in p) return 'x265';
  if (/x265/i.test(input)) return 'x265';
  if (/x264/i.test(input)) return 'x264';
  return 'unknown';
}

const num = (v: string | boolean | undefined) =>
  typeof v === 'string' && v.trim() !== '' ? Number(v) : undefined;

const kbpsToMbps = (v: string | boolean | undefined) => {
  const n = num(v);
  return n === undefined ? undefined : `${(n / 1000).toFixed(2)} Mbps (${n} kbps)`;
};

function rateControl(enc: Encoder, p: Record<string, string | boolean>): RateControl {
  const rc = typeof p.rc === 'string' ? p.rc : undefined;
  if (!rc) return { mode: 'unknown', label: 'No rc= value found', verdict: 'bad' };

  if (rc === 'crf') {
    return { mode: 'crf', label: 'CRF (constant quality)', value: String(p.crf ?? '?'), verdict: 'ok' };
  }
  if (rc === 'cqp') {
    return { mode: 'cqp', label: 'Constant QP', value: String(p.qp ?? '?'), verdict: 'bad' };
  }
  if (rc === 'cbr') {
    return { mode: 'cbr', label: 'CBR (constant bitrate)', value: kbpsToMbps(p.bitrate), verdict: 'bad' };
  }
  if (rc === '2pass') {
    return { mode: '2pass', label: '2-pass', value: kbpsToMbps(p.bitrate), verdict: 'ok' };
  }
  if (rc === 'abr') {
    if (enc === 'x265') {
      const read = num(p['stats-read']) ?? 0;
      const write = num(p['stats-write']) ?? 0;
      if (read > 0) {
        return { mode: '2pass', label: 'Multi-pass (final pass)', value: kbpsToMbps(p.bitrate), verdict: 'ok' };
      }
      if (write > 0) {
        return {
          mode: 'firstpass',
          label: 'First pass of a multi-pass encode',
          value: kbpsToMbps(p.bitrate),
          verdict: 'bad',
        };
      }
    }
    return { mode: 'abr', label: '1-pass ABR', value: kbpsToMbps(p.bitrate), verdict: 'bad' };
  }
  return { mode: 'unknown', label: `Unrecognised rc=${rc}`, verdict: 'warn' };
}

/** x264 presets each set a distinct subme value. A user can override it, so this is a guess. */
const X264_SUBME_TO_PRESET: Record<number, string> = {
  0: 'ultrafast',
  1: 'superfast',
  2: 'veryfast',
  4: 'faster',
  6: 'fast',
  7: 'medium',
  8: 'slow',
  9: 'slower',
  10: 'veryslow',
  11: 'placebo',
};

function x264Tune(p: Record<string, string | boolean>): string | undefined {
  const deblock = String(p.deblock ?? '');
  const psy = String(p.psy_rd ?? '');
  if (p.deadzone === '6,6' && p.qcomp === '0.80' && p.decimate === '0') return 'grain';
  if (deblock === '1:-1:-1' && psy.endsWith(':0.15')) return 'film';
  if (deblock === '1:1:1' && p.bframes && Number(p.bframes) >= 5) return 'animation';
  return undefined;
}

export function analyseHeader(input: string): HeaderReport {
  const settings = extractSettings(input);
  const params = parseParams(settings);
  const encoder = detectEncoder(input, params);
  const rc = rateControl(encoder, params);
  const findings: Finding[] = [];
  const highlights: { label: string; value: string }[] = [];
  let presetGuess: string | undefined;
  let tuneGuess: string | undefined;

  if (encoder === 'unknown') {
    findings.push({
      verdict: 'bad',
      text: 'No x264 or x265 settings found. A remux or WEB-DL has none, which is normal. An encode without them is rejected on most trackers.',
    });
  }

  switch (rc.mode) {
    case 'crf':
    case '2pass':
      findings.push({ verdict: 'ok', text: `Rate control is ${rc.label}. Accepted on every tracker that publishes rules on this.` });
      break;
    case 'abr':
      findings.push({ verdict: 'bad', text: '1-pass ABR. Most trackers reject this. Re-encode with CRF or 2-pass.' });
      break;
    case 'cbr':
      findings.push({ verdict: 'bad', text: 'CBR. Most trackers reject this. Re-encode with CRF or 2-pass.' });
      break;
    case 'cqp':
      findings.push({ verdict: 'bad', text: 'Constant QP. Not a normal release mode. Re-encode with CRF or 2-pass.' });
      break;
    case 'firstpass':
      findings.push({ verdict: 'bad', text: 'This is the output of pass 1. The file you want is the one from the final pass.' });
      break;
    default:
      if (encoder !== 'unknown') findings.push({ verdict: 'bad', text: rc.label });
  }

  if (encoder === 'x264') {
    const subme = num(params.subme);
    if (subme !== undefined) presetGuess = X264_SUBME_TO_PRESET[subme];
    tuneGuess = x264Tune(params);
    const crf = num(params.crf);
    if (rc.mode === 'crf' && crf !== undefined && crf > 23) {
      findings.push({ verdict: 'warn', text: `CRF ${crf} is high for a release. Most 1080p x264 releases sit between 16 and 22.` });
    }
    if (subme !== undefined && subme < 8) {
      findings.push({
        verdict: 'warn',
        text: `subme=${subme} means a preset faster than slow. Slow or slower is the usual minimum for releases.`,
      });
    }
    for (const [label, key] of [
      ['Reference frames', 'ref'],
      ['B-frames', 'bframes'],
      ['Motion search', 'me'],
      ['subme', 'subme'],
      ['Deblock', 'deblock'],
      ['psy-rd', 'psy_rd'],
      ['AQ (mode:strength)', 'aq'],
      ['qcomp', 'qcomp'],
      ['mbtree', 'mbtree'],
    ] as const) {
      if (params[key] !== undefined) highlights.push({ label, value: String(params[key]) });
    }
  }

  if (encoder === 'x265') {
    const crf = num(params.crf);
    if (rc.mode === 'crf' && crf !== undefined && crf > 24) {
      findings.push({ verdict: 'warn', text: `CRF ${crf} is high for a release. Most x265 releases sit between 16 and 22.` });
    }
    const bitdepth = num(params.bitdepth);
    if (bitdepth !== undefined && bitdepth < 10) {
      findings.push({ verdict: 'warn', text: `${bitdepth}-bit x265. Releases are almost always 10-bit.` });
    }
    const hdrTransfer = params.transfer === '16'; // 16 = SMPTE ST 2084 (PQ)
    if (hdrTransfer) {
      if (params.hdr10 === true) findings.push({ verdict: 'ok', text: 'HDR10 signalling is switched on.' });
      else findings.push({ verdict: 'bad', text: 'PQ transfer but no --hdr10 flag. Players may not switch to HDR.' });
      if (typeof params['master-display'] === 'string') {
        findings.push({ verdict: 'ok', text: 'Mastering display metadata is present.' });
      } else {
        findings.push({ verdict: 'bad', text: 'HDR encode with no --master-display. Copy it from the source with the HDR tool.' });
      }
    }
    for (const [label, key] of [
      ['Bit depth', 'bitdepth'],
      ['Resolution', 'input-res'],
      ['Level', 'level-idc'],
      ['High tier', 'high-tier'],
      ['rd', 'rd'],
      ['subme', 'subme'],
      ['Reference frames', 'ref'],
      ['B-frames', 'bframes'],
      ['Deblock', 'deblock'],
      ['SAO', 'sao'],
      ['psy-rd', 'psy-rd'],
      ['psy-rdoq', 'psy-rdoq'],
      ['AQ mode', 'aq-mode'],
      ['AQ strength', 'aq-strength'],
      ['qcomp', 'qcomp'],
      ['Mastering display', 'master-display'],
      ['MaxCLL, MaxFALL', 'cll'],
    ] as const) {
      if (params[key] !== undefined) highlights.push({ label, value: params[key] === false ? 'off' : String(params[key]) });
    }
  }

  return { encoder, params, rateControl: rc, presetGuess, tuneGuess, highlights, findings };
}
