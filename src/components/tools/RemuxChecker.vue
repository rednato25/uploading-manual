<script setup lang="ts">
import { computed, ref } from 'vue';
import { checkRemux } from '../../lib/remuxCheck';
import ToolStatus from './ToolStatus.vue';
import ToolVerdict from './ToolVerdict.vue';

const SAMPLE = `General
Format                                   : Matroska
File size                                : 12.4 GiB
Duration                                 : 2 h 14 min
Overall bit rate                         : 13.2 Mb/s

Video
Format                                   : AVC
Bit rate                                 : 12.5 Mb/s
Width                                    : 1 920 pixels
Height                                   : 1 080 pixels
Display aspect ratio                     : 16:9
Frame rate                               : 23.976 (24000/1001) FPS

Audio #1
Format                                   : DTS XLL
Commercial name                          : DTS-HD Master Audio
Channel(s)                               : 6 channels
Language                                 : English

Text #1
Format                                   : PGS

Menu
00:00:00.000                             : en:Chapter 1`;

const input = ref('');
const findings = computed(() => (input.value.trim() ? checkRemux(input.value) : []));

const useSample = () => {
  input.value = SAMPLE;
};

const counts = computed(() => ({
  bad: findings.value.filter((f) => f.verdict === 'bad').length,
  warn: findings.value.filter((f) => f.verdict === 'warn').length,
  ok: findings.value.filter((f) => f.verdict === 'ok').length,
}));

const state = computed<'pass' | 'check' | 'problem'>(() =>
  counts.value.bad > 0 ? 'problem' : counts.value.warn > 0 ? 'check' : 'pass',
);

const title = computed(() =>
  state.value === 'problem'
    ? 'A moderator would reject this'
    : state.value === 'check'
      ? 'Check these before upload'
      : 'Clean remux',
);

const detail = computed(() => {
  const parts: string[] = [];
  if (counts.value.bad) parts.push(`${counts.value.bad} problem${counts.value.bad === 1 ? '' : 's'}`);
  if (counts.value.warn) parts.push(`${counts.value.warn} warning${counts.value.warn === 1 ? '' : 's'}`);
  if (counts.value.ok) parts.push(`${counts.value.ok} passed`);
  return parts.join(', ');
});

const groups = computed(() => {
  return [
    { key: 'bad', title: 'Problems', items: findings.value.filter((f) => f.verdict === 'bad') },
    { key: 'warn', title: 'Warnings', items: findings.value.filter((f) => f.verdict === 'warn') },
    { key: 'ok', title: 'Passed', items: findings.value.filter((f) => f.verdict === 'ok') },
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
      <label class="tool-label" for="rc-input"
        >Paste the full MediaInfo text (View → Text in MediaInfo).</label
      >
      <div class="tool-actions">
        <button type="button" @click="useSample">Use sample</button>
      </div>
    </div>

    <textarea
      id="rc-input"
      v-model="input"
      rows="10"
      spellcheck="false"
      placeholder="General&#10;Format                                   : Matroska&#10;&#10;Video&#10;Format                                   : HEVC&#10;Bit rate                                 : 64.5 Mb/s&#10;Width                                    : 3 840 pixels&#10;Height                                   : 2 160 pixels&#10;HDR format                               : SMPTE ST 2086, HDR10 compatible&#10;..."
    />

    <p v-if="!findings.length" class="tool-empty">
      Paste a MediaInfo dump, or use the sample to see a verdict.
    </p>

    <div v-if="findings.length" class="tool-result">
      <ToolVerdict :state="state" :title="title" :detail="detail" />

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
    </div>

    <p class="tool-live" aria-live="polite">{{ findings.length ? announcement : '' }}</p>
  </div>
</template>
