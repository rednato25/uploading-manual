<script setup lang="ts">
import { computed, ref } from 'vue';
import { analyseHeader } from '../../lib/encodeHeader';
import ToolStatus from './ToolStatus.vue';
import ToolVerdict from './ToolVerdict.vue';

const SAMPLE = `Video
Format                                   : AVC
Writing library                          : x264 core 164 r3108 31e19f9
Encoding settings                        : cabac=1 / ref=5 / deblock=1:-2:-2 / analyse=0x3:0x113 / me=umh / subme=8 / psy=1 / psy_rd=1.00:0.25 / mixed_ref=1 / me_range=16 / chroma_me=1 / trellis=1 / 8x8dct=1 / cqm=0 / deadzone=6,6 / fast_pskip=1 / chroma_qp_offset=-2 / threads=24 / lookahead_threads=4 / sliced_threads=0 / nr=0 / decimate=0 / interlaced=0 / bluray_compat=0 / constrained_intra=0 / bframes=3 / b_pyramid=2 / b_adapt=1 / b_bias=0 / direct=3 / weightb=1 / open_gop=0 / weightp=2 / keyint=250 / keyint_min=23 / scenecut=40 / intra_refresh=0 / rc_lookahead=50 / rc=2pass / mbtree=1 / bitrate=10000 / ratetol=1.0 / qcomp=0.80 / qpmin=0 / qpmax=69 / qpstep=4 / cplxblur=20.0 / qblur=0.5 / ip_ratio=1.10 / pb_ratio=1.10 / aq=1:0.50`;

const input = ref('');
const report = computed(() => (input.value.trim() ? analyseHeader(input.value) : null));

const useSample = () => {
  input.value = SAMPLE;
};

const counts = computed(() => {
  const findings = report.value?.findings ?? [];
  return {
    bad: findings.filter((f) => f.verdict === 'bad').length,
    warn: findings.filter((f) => f.verdict === 'warn').length,
    ok: findings.filter((f) => f.verdict === 'ok').length,
  };
});

const state = computed<'pass' | 'check' | 'problem'>(() =>
  counts.value.bad > 0 ? 'problem' : counts.value.warn > 0 ? 'check' : 'pass',
);

const title = computed(() =>
  state.value === 'problem'
    ? 'A moderator would reject this'
    : state.value === 'check'
      ? 'Check these before upload'
      : 'No problems found',
);

const detail = computed(() => {
  const parts: string[] = [];
  if (counts.value.bad) parts.push(`${counts.value.bad} problem${counts.value.bad === 1 ? '' : 's'}`);
  if (counts.value.warn) parts.push(`${counts.value.warn} warning${counts.value.warn === 1 ? '' : 's'}`);
  if (counts.value.ok) parts.push(`${counts.value.ok} passed`);
  return parts.join(', ');
});

const groups = computed(() => {
  const findings = report.value?.findings ?? [];
  return [
    { key: 'bad', title: 'Problems', items: findings.filter((f) => f.verdict === 'bad') },
    { key: 'warn', title: 'Warnings', items: findings.filter((f) => f.verdict === 'warn') },
    { key: 'ok', title: 'Passed', items: findings.filter((f) => f.verdict === 'ok') },
  ].filter((group) => group.items.length > 0);
});

const announcement = computed(() => {
  const label = state.value === 'pass' ? 'OK' : state.value === 'check' ? 'Check' : 'Problem';
  return [label, title.value, detail.value].filter(Boolean).join('. ');
});
</script>

<template>
  <div class="tool not-content">
    <div class="tool-head">
      <label class="tool-label" for="hc-input"
        >Paste MediaInfo, the Encoding settings line, or the raw x264/x265 string.</label
      >
      <div class="tool-actions">
        <button type="button" @click="useSample">Use sample</button>
      </div>
    </div>

    <textarea
      id="hc-input"
      v-model="input"
      rows="8"
      spellcheck="false"
      placeholder="Encoding settings : cabac=1 / ref=5 / ... / rc=2pass / bitrate=10000 / ..."
    />

    <p v-if="!report" class="tool-empty">Paste a header, or use the sample to see a verdict.</p>

    <div v-if="report" class="tool-result">
      <ToolVerdict :state="state" :title="title" :detail="detail" />

      <dl class="tool-facts">
        <div>
          <dt>Encoder</dt>
          <dd>{{ report.encoder === 'unknown' ? 'Not found' : report.encoder }}</dd>
        </div>
        <div>
          <dt>Rate control</dt>
          <dd>{{ report.rateControl.label }}</dd>
        </div>
        <div v-if="report.rateControl.value">
          <dt>{{ report.rateControl.mode === 'crf' ? 'CRF value' : 'Bitrate' }}</dt>
          <dd>{{ report.rateControl.value }}</dd>
        </div>
        <div v-if="report.presetGuess">
          <dt>Preset (likely)</dt>
          <dd>{{ report.presetGuess }}</dd>
        </div>
        <div v-if="report.tuneGuess">
          <dt>Tune (likely)</dt>
          <dd>{{ report.tuneGuess }}</dd>
        </div>
      </dl>

      <section v-for="group in groups" :key="group.key" class="tool-group">
        <p class="tool-group-title">{{ group.title }}</p>
        <ul class="tool-findings">
          <li v-for="(finding, index) in group.items" :key="index">
            <ToolStatus :state="finding.verdict" />
            <span>{{ finding.text }}</span>
          </li>
        </ul>
      </section>

      <p class="tool-help">Checks that are not listed did not report a problem.</p>

      <details v-if="report.highlights.length" class="tool-details">
        <summary>Key settings</summary>
        <dl class="tool-facts">
          <div v-for="highlight in report.highlights" :key="highlight.label">
            <dt>{{ highlight.label }}</dt>
            <dd>{{ highlight.value }}</dd>
          </div>
        </dl>
      </details>
    </div>

    <p class="tool-live" aria-live="polite">{{ report ? announcement : '' }}</p>
  </div>
</template>
