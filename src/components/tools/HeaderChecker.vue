<script setup lang="ts">
import { computed, ref } from 'vue';
import { analyseHeader } from '../../lib/encodeHeader';

const input = ref('');
const report = computed(() => (input.value.trim() ? analyseHeader(input.value) : null));

const verdictLabel = { ok: 'OK', warn: 'Check', bad: 'Problem' } as const;
</script>

<template>
  <div class="tool not-content">
    <label for="hc-input">Paste MediaInfo text, the "Encoding settings" line, or the x264/x265 string</label>
    <textarea
      id="hc-input"
      v-model="input"
      rows="7"
      spellcheck="false"
      placeholder="cabac=1 / ref=5 / deblock=1:-2:-2 / ... / rc=2pass / bitrate=10000 / ..."
    />

    <div v-if="report" class="tool-result" aria-live="polite">
      <dl class="tool-grid">
        <div>
          <dt>Encoder</dt>
          <dd>{{ report.encoder === 'unknown' ? 'Not found' : report.encoder }}</dd>
        </div>
        <div>
          <dt>Rate control</dt>
          <dd>
            <span :class="['verdict', `verdict-${report.rateControl.verdict}`]">{{ report.rateControl.label }}</span>
          </dd>
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

      <ul class="tool-findings">
        <li v-for="(f, i) in report.findings" :key="i" :class="`finding-${f.verdict}`">
          <strong>{{ verdictLabel[f.verdict] }}</strong> {{ f.text }}
        </li>
      </ul>

      <details v-if="report.highlights.length">
        <summary>Key settings</summary>
        <table>
          <tbody>
            <tr v-for="h in report.highlights" :key="h.label">
              <th scope="row">{{ h.label }}</th>
              <td><code>{{ h.value }}</code></td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>
  </div>
</template>
