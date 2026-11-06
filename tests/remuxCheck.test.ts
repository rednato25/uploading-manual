import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRemux } from '../src/lib/remuxCheck.ts';

const REMUX_1080P = `General
Format                                   : Matroska
File size                                : 29.8 GiB
Duration                                 : 2 h 14 min

Video
ID                                       : 1
Format                                   : AVC
Format profile                           : High@L4.1
Bit rate                                 : 27.1 Mb/s
Width                                    : 1 920 pixels
Height                                   : 1 080 pixels
Frame rate                               : 23.976 (24000/1001) FPS

Audio #1
ID                                       : 2
Format                                   : DTS XLL
Commercial name                          : DTS-HD Master Audio
Channel(s)                               : 6 channels
Language                                 : English

Text #1
ID                                       : 3
Format                                   : PGS
Language                                 : English

Menu
00:00:00.000                             : en:Chapter 01
`;

const REMUX_UHD = `General
Format                                   : Matroska

Video
Format                                   : HEVC
Bit rate                                 : 64.5 Mb/s
Width                                    : 3 840 pixels
Height                                   : 2 160 pixels
HDR format                               : SMPTE ST 2086, HDR10 compatible

Audio #1
Format                                   : MLP FBA 16-ch
Commercial name                          : Dolby TrueHD with Dolby Atmos
Language                                 : English

Text #1
Format                                   : PGS
Language                                 : English

Menu
00:00:00.000                             : en:Chapter 01
`;

const FAKE_REMUX = `Video
Format                                   : AVC
Bit rate                                 : 9 500 kb/s
Width                                    : 1 920 pixels
Height                                   : 1 080 pixels
Writing library                          : x264 core 164 r3108 31e19f9
Encoding settings                        : cabac=1 / ref=5 / rc=crf / crf=18.0

Audio #1
Format                                   : DTS XLL
Language                                 : English

Text #1
Format                                   : PGS
Language                                 : English

Menu
00:00:00.000                             : en:Chapter 01
`;

const NO_LANGUAGE = `Video
Format                                   : HEVC
Bit rate                                 : 55.0 Mb/s
Width                                    : 3 840 pixels
Height                                   : 2 160 pixels
HDR format                               : SMPTE ST 2086, HDR10 compatible

Audio #1
Format                                   : MLP FBA
Commercial name                          : Dolby TrueHD

Text #1
Format                                   : PGS
Language                                 : English

Menu
00:00:00.000                             : en:Chapter 01
`;

test('a clean 1080p remux has no warnings or problems', () => {
  const findings = checkRemux(REMUX_1080P);
  assert.equal(findings.filter((f) => f.verdict !== 'ok').length, 0);
});

test('a clean UHD remux has no warnings or problems', () => {
  const findings = checkRemux(REMUX_UHD);
  assert.equal(findings.filter((f) => f.verdict !== 'ok').length, 0);
});

test('x264 settings mean the file is not a remux', () => {
  const findings = checkRemux(FAKE_REMUX);
  assert.ok(findings.some((f) => f.verdict === 'bad' && /re-encoded/.test(f.text)));
});

test('an audio track with no language is a problem', () => {
  const findings = checkRemux(NO_LANGUAGE);
  assert.ok(findings.some((f) => f.verdict === 'bad' && /language/i.test(f.text)));
});

test('an Other section does not change the subtitle language check', () => {
  const withOther = `Video
Format                                   : AVC
Bit rate                                 : 27.1 Mb/s
Width                                    : 1 920 pixels
Height                                   : 1 080 pixels

Audio #1
Format                                   : DTS XLL
Language                                 : English

Text #1
Format                                   : PGS

Other #1
ID                                       : 4
Format                                   : Time code
Language                                 : English

Menu
00:00:00.000                             : en:Chapter 01
`;

  const findings = checkRemux(withOther);
  const missingSubtitleLanguage = findings.filter(
    (f) => f.verdict === 'bad' && /Subtitle track 1 has no language/.test(f.text),
  );
  assert.equal(missingSubtitleLanguage.length, 1);
});
