import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseHeader } from '../src/lib/encodeHeader.ts';
import { sizeFromBitrate, videoKbpsForSize, bitsPerPixel, resolutionClass } from '../src/lib/bitrate.ts';
import { hdrParamsFromMediaInfo } from '../src/lib/hdr.ts';

// Field names and order follow x264's x264_param2string (common/base.c).
const X264_2PASS_GRAIN =
  'cabac=1 / ref=5 / deblock=1:-2:-2 / analyse=0x3:0x113 / me=umh / subme=8 / psy=1 / psy_rd=1.00:0.25 / mixed_ref=1 / me_range=16 / chroma_me=1 / trellis=1 / 8x8dct=1 / cqm=0 / deadzone=6,6 / fast_pskip=1 / chroma_qp_offset=-2 / threads=24 / lookahead_threads=4 / sliced_threads=0 / nr=0 / decimate=0 / interlaced=0 / bluray_compat=0 / constrained_intra=0 / bframes=3 / b_pyramid=2 / b_adapt=1 / b_bias=0 / direct=3 / weightb=1 / open_gop=0 / weightp=2 / keyint=250 / keyint_min=23 / scenecut=40 / intra_refresh=0 / rc_lookahead=50 / rc=2pass / mbtree=1 / bitrate=10000 / ratetol=1.0 / qcomp=0.80 / qpmin=0 / qpmax=69 / qpstep=4 / cplxblur=20.0 / qblur=0.5 / ip_ratio=1.10 / pb_ratio=1.10 / aq=1:0.50';

test('x264 2-pass from a MediaInfo dump', () => {
  const dump = `Video\nFormat                                   : AVC\nWriting library                          : x264 core 164 r3108 31e19f9\nEncoding settings                        : ${X264_2PASS_GRAIN}\n`;
  const r = analyseHeader(dump);
  assert.equal(r.encoder, 'x264');
  assert.equal(r.rateControl.mode, '2pass');
  assert.equal(r.rateControl.verdict, 'ok');
  assert.equal(r.presetGuess, 'slow');
  assert.equal(r.tuneGuess, 'grain');
  assert.match(r.rateControl.value ?? '', /10\.00 Mbps/);
});

test('x264 raw SEI string with CRF', () => {
  const raw =
    'x264 - core 164 r3108 - H.264/MPEG-4 AVC codec - Copyleft 2003-2023 - http://www.videolan.org/x264.html - options: cabac=1 ref=4 deblock=1:-1:-1 subme=9 psy_rd=1.00:0.15 rc=crf mbtree=1 crf=18.0 qcomp=0.60';
  const r = analyseHeader(raw);
  assert.equal(r.encoder, 'x264');
  assert.equal(r.rateControl.mode, 'crf');
  assert.equal(r.rateControl.value, '18.0');
  assert.equal(r.presetGuess, 'slower');
  assert.equal(r.tuneGuess, 'film');
});

test('x264 1-pass ABR and CBR are flagged', () => {
  assert.equal(analyseHeader('cabac=1 / subme=7 / rc=abr / bitrate=8000').rateControl.verdict, 'bad');
  assert.equal(analyseHeader('cabac=1 / rc=cbr / bitrate=8000 / vbv_maxrate=8000').rateControl.mode, 'cbr');
  assert.equal(analyseHeader('cabac=1 / rc=cqp / qp=20').rateControl.mode, 'cqp');
});

// x265 never writes rc=2pass. A final pass shows rc=abr with stats-read set.
test('x265 multi-pass is recognised from stats-read', () => {
  const s =
    'cpuid=1111039 / frame-threads=4 / numa-pools=16 / wpp / no-pmode / no-pme / no-psnr / no-ssim / log-level=2 / bitdepth=10 / input-csp=1 / fps=24000/1001 / input-res=1920x1080 / interlace=0 / total-frames=0 / level-idc=0 / high-tier=1 / uhd-bd=0 / ref=4 / ctu=64 / rd=4 / psy-rd=2.00 / psy-rdoq=1.00 / rc=abr / bitrate=9000 / qcomp=0.60 / qpstep=4 / stats-write=0 / stats-read=2 / cplxblur=20.0 / qblur=0.5 / ipratio=1.40 / pbratio=1.30 / aq-mode=3 / aq-strength=0.80';
  const r = analyseHeader(s);
  assert.equal(r.encoder, 'x265');
  assert.equal(r.rateControl.mode, '2pass');
  assert.equal(r.rateControl.verdict, 'ok');
});

test('x265 1-pass ABR and first-pass output are flagged', () => {
  assert.equal(analyseHeader('ctu=64 / rc=abr / bitrate=9000 / stats-write=0 / stats-read=0').rateControl.mode, 'abr');
  assert.equal(analyseHeader('ctu=64 / rc=abr / bitrate=9000 / stats-write=1 / stats-read=0').rateControl.mode, 'firstpass');
});

test('x265 HDR checks', () => {
  const ok = analyseHeader(
    'ctu=64 / bitdepth=10 / rc=crf / crf=20.0 / transfer=16 / master-display=G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,50) / cll=1000,400 / hdr10 / hdr10-opt',
  );
  assert.ok(ok.findings.every((f) => f.verdict !== 'bad'));
  const missing = analyseHeader('ctu=64 / bitdepth=10 / rc=crf / crf=20.0 / transfer=16 / no-hdr10');
  assert.equal(missing.findings.filter((f) => f.verdict === 'bad').length, 2);
});

test('a remux has no encoder settings', () => {
  const r = analyseHeader('Video\nFormat : AVC\nBit rate : 32.4 Mb/s\n');
  assert.equal(r.encoder, 'unknown');
});

test('size and bitrate maths', () => {
  // 2 hours at 10,000 + 640 kbps
  const s = sizeFromBitrate(10000, 640, 7200);
  assert.ok(Math.abs(s.gb - 9.624) < 0.01, `got ${s.gb}`);
  // and back again
  const v = videoKbpsForSize(s.gb, 640, 7200);
  assert.ok(Math.abs(v - 10000) < 1, `got ${v}`);
  assert.ok(Math.abs(bitsPerPixel(10000, 1920, 800, 24000 / 1001) - 0.2714) < 0.001);
  assert.equal(resolutionClass(1920), '1080p');
  assert.equal(resolutionClass(3840), '2160p');
  assert.equal(resolutionClass(1280), '720p');
});

test('HDR params from MediaInfo', () => {
  const mi = `Video
Format                                   : HEVC
HDR format                               : Dolby Vision, Version 1.0, Profile 7.6, dvhe.07.06, BL+EL+RPU, no metadata compression / SMPTE ST 2086, HDR10 compatible
Chroma subsampling                       : 4:2:0 (Type 2)
Color range                              : Limited
Color primaries                          : BT.2020
Transfer characteristics                 : PQ
Matrix coefficients                      : BT.2020 non-constant
Mastering display color primaries        : Display P3
Mastering display luminance              : min: 0.0050 cd/m2, max: 1000 cd/m2
Maximum Content Light Level              : 1000 cd/m2
Maximum Frame-Average Light Level        : 400 cd/m2`;
  const r = hdrParamsFromMediaInfo(mi);
  const joined = r.params.join(' ');
  assert.match(joined, /--master-display "G\(13250,34500\)B\(7500,3000\)R\(34000,16000\)WP\(15635,16450\)L\(10000000,50\)"/);
  assert.match(joined, /--max-cll "1000,400"/);
  assert.match(joined, /--chromaloc 2/);
  assert.ok(r.notes.some((n) => /Dolby Vision/.test(n.text)));

  const coords = hdrParamsFromMediaInfo(
    'Transfer characteristics : PQ\nMastering display color primaries : R: x=0.708000 y=0.292000, G: x=0.170000 y=0.797000, B: x=0.131000 y=0.046000, White point: x=0.312700 y=0.329000\nMastering display luminance : min: 0.0001 cd/m2, max: 4000 cd/m2',
  );
  assert.match(coords.params.join(' '), /G\(8500,39850\)B\(6550,2300\)R\(35400,14600\)WP\(15635,16450\)L\(40000000,1\)/);
  assert.match(coords.params.join(' '), /--max-cll "0,0"/);

  const sdr = hdrParamsFromMediaInfo('Transfer characteristics : BT.709');
  assert.equal(sdr.params.length, 0);
});
