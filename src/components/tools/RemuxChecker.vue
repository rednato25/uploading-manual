<script setup lang="ts">
import { computed, ref } from 'vue';
import { checkRemux } from '../../lib/remuxCheck';

const input = ref('');
const findings = computed(() => (input.value.trim() ? checkRemux(input.value) : []));
const counts = computed(() => ({
  bad: findings.value.filter((f) => f.verdict === 'bad').length,
  warn: findings.value.filter((f) => f.verdict === 'warn').length,
}));
const overall = computed<'ok' | 'warn' | 'bad'>(() =>
  counts.value.bad > 0 ? 'bad' : counts.value.warn > 0 ? 'warn' : 'ok',
);

const verdictLabel = { ok: 'OK', warn: 'Check', bad: 'Problem' } as const;
const overallLabel = computed(() => (overall.value === 'ok' ? 'Clean remux' : verdictLabel[overall.value]));
</script>

<template>
  <div class="tool not-content">
    <label for="rc-input">Paste the full MediaInfo text (View → Text in MediaInfo)</label>
    <textarea
      id="rc-input"
      v-model="input"
      rows="10"
      spellcheck="false"
      placeholder="General&#10;Format                                   : Matroska&#10;&#10;Video&#10;Format                                   : HEVC&#10;Bit rate                                 : 64.5 Mb/s&#10;Width                                    : 3 840 pixels&#10;Height                                   : 2 160 pixels&#10;HDR format                               : SMPTE ST 2086, HDR10 compatible&#10;..."
    />

    <div v-if="input.trim()" class="tool-result" aria-live="polite">
      <dl class="tool-grid">
        <div>
          <dt>Result</dt>
          <dd><span :class="['verdict', `verdict-${overall}`]">{{ overallLabel }}</span></dd>
        </div>
        <div>
          <dt>Problems</dt>
          <dd>{{ counts.bad }}</dd>
        </div>
        <div>
          <dt>Warnings</dt>
          <dd>{{ counts.warn }}</dd>
        </div>
      </dl>

      <ul class="tool-findings">
        <li v-for="(finding, i) in findings" :key="i" :class="`finding-${finding.verdict}`">
          <strong>{{ verdictLabel[finding.verdict] }}</strong> {{ finding.text }}
        </li>
      </ul>
    </div>
  </div>
</template>
