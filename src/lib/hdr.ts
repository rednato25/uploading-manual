/**
 * Builds x265 HDR10 parameters from a MediaInfo text dump of the source.
 *
 * x265 expects --master-display as
 *   G(x,y)B(x,y)R(x,y)WP(x,y)L(max,min)
 * with chromaticity in units of 0.00002 and luminance in units of 0.0001 cd/m2.
 */

export interface HdrResult {
  params: string[];
  notes: { verdict: 'ok' | 'warn' | 'bad'; text: string }[];
  found: Record<string, string>;
}

const PRIMARIES: Record<string, string> = {
  'display p3': 'G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)',
  'bt.2020': 'G(8500,39850)B(6550,2300)R(35400,14600)WP(15635,16450)',
};

/** Value of "Key : value" from a MediaInfo dump (first match, case-insensitive). */
function field(text: string, key: string): string | undefined {
  const re = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.+)$`, 'im');
  return text.match(re)?.[1]?.trim();
}

const chroma = (v: string) => Math.round(Number(v) * 50000);

/** "R: x=0.680000 y=0.320000, G: x=..., B: ..., White point: x=... y=..." */
function primariesFromCoordinates(v: string): string | undefined {
  const pick = (label: string) => {
    const m = v.match(new RegExp(`${label}:\\s*x=([\\d.]+)\\s*y=([\\d.]+)`, 'i'));
    return m ? `${chroma(m[1])},${chroma(m[2])}` : undefined;
  };
  const r = pick('R');
  const g = pick('G');
  const b = pick('B');
  const wp = pick('White point');
  if (!r || !g || !b || !wp) return undefined;
  return `G(${g})B(${b})R(${r})WP(${wp})`;
}

export function hdrParamsFromMediaInfo(text: string): HdrResult {
  const notes: HdrResult['notes'] = [];
  const found: Record<string, string> = {};
  const params: string[] = [];

  const hdrFormat = field(text, 'HDR format');
  const transfer = field(text, 'Transfer characteristics');
  const primaries = field(text, 'Color primaries');
  const matrix = field(text, 'Matrix coefficients');
  const range = field(text, 'Color range');
  const subsampling = field(text, 'Chroma subsampling');
  const mdPrimaries = field(text, 'Mastering display color primaries');
  const mdLum = field(text, 'Mastering display luminance');
  const maxCll = field(text, 'Maximum Content Light Level');
  const maxFall = field(text, 'Maximum Frame-Average Light Level');

  Object.entries({
    'HDR format': hdrFormat,
    'Transfer characteristics': transfer,
    'Color primaries': primaries,
    'Matrix coefficients': matrix,
    'Color range': range,
    'Chroma subsampling': subsampling,
    'Mastering display primaries': mdPrimaries,
    'Mastering display luminance': mdLum,
    MaxCLL: maxCll,
    MaxFALL: maxFall,
  }).forEach(([k, v]) => v && (found[k] = v));

  if (!transfer || !/PQ|2084/i.test(transfer)) {
    notes.push({
      verdict: 'bad',
      text: 'No PQ transfer found. This source is either SDR or HLG, and these HDR10 settings do not apply to it.',
    });
    return { params, notes, found };
  }

  params.push('--output-depth 10');
  params.push('--colorprim bt2020', '--transfer smpte2084', '--colormatrix bt2020nc');
  params.push(`--range ${range && /full/i.test(range) ? 'full' : 'limited'}`);
  if (subsampling && /Type 2/i.test(subsampling)) params.push('--chromaloc 2');
  params.push('--hdr10', '--hdr10-opt', '--repeat-headers');

  // Mastering display
  let md: string | undefined;
  if (mdPrimaries) {
    md = PRIMARIES[mdPrimaries.toLowerCase()] ?? primariesFromCoordinates(mdPrimaries);
  }
  const lum = mdLum?.match(/min:\s*([\d.]+).*max:\s*([\d.]+)/i);
  if (md && lum) {
    const min = Math.round(Number(lum[1]) * 10000);
    const max = Math.round(Number(lum[2]) * 10000);
    params.push(`--master-display "${md}L(${max},${min})"`);
    notes.push({ verdict: 'ok', text: 'Mastering display metadata copied from the source.' });
  } else {
    notes.push({
      verdict: 'warn',
      text: 'Mastering display metadata not found or not readable. Paste the full Video section of MediaInfo, not only part of it.',
    });
  }

  // Content light levels
  const cll = maxCll?.match(/(\d+)/)?.[1];
  const fall = maxFall?.match(/(\d+)/)?.[1];
  if (cll && fall) {
    params.push(`--max-cll "${cll},${fall}"`);
  } else {
    params.push('--max-cll "0,0"');
    notes.push({
      verdict: 'warn',
      text: 'MaxCLL or MaxFALL is missing in the source. "0,0" means unknown, which is what the disc says too. Do not make numbers up.',
    });
  }

  if (hdrFormat && /Dolby Vision/i.test(hdrFormat)) {
    notes.push({
      verdict: 'warn',
      text: 'The source has Dolby Vision. These settings give you an HDR10 encode only. Keeping DV needs dovi_tool to extract and crop the RPU, which is an advanced step.',
    });
  }
  if (hdrFormat && /2094|HDR10\+/i.test(hdrFormat)) {
    notes.push({
      verdict: 'warn',
      text: 'The source has HDR10+. These settings drop it. Keeping it needs hdr10plus_tool and --dhdr10-info.',
    });
  }

  return { params, notes, found };
}
