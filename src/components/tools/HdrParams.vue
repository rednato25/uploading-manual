<script setup lang="ts">
import { computed, ref } from 'vue';
import { hdrParamsFromMediaInfo } from '../../lib/hdr';
import ToolStatus from './ToolStatus.vue';
import ToolVerdict from './ToolVerdict.vue';

const SAMPLE = `Video
Format                                   : HEVC
HDR format                               : SMPTE ST 2086, HDR10 compatible
Chroma subsampling                       : 4:2:0 (Type 2)
Color range                              : Limited
Color primaries                          : BT.2020
Transfer characteristics                 : PQ
Matrix coefficients                      : BT.2020 non-constant
Mastering display color primaries        : Display P3
Mastering display luminance              : min: 0.0050 cd/m2, max: 1000 cd/m2
Maximum Content Light Level              : 1000 cd/m2
Maximum Frame-Average Light Level        : 400 cd/m2`;

const input = ref('');
const result = computed(() => (input.value.trim() ? hdrParamsFromMediaInfo(input.value) : null));
const oneLine = computed(() => result.value?.params.join(' ') ?? '');
const copyState = ref<'idle' | 'copied' | 'failed'>('idle');
let resetTimer: ReturnType<typeof setTimeout> | undefined;

const useSample = () => {
  input.value = SAMPLE;
  copyState.value = 'idle';
};

const copyMessage = computed(() =>
  copyState.value === 'copied'
    ? 'Copied to the clipboard.'
    : copyState.value === 'failed'
      ? 'Copy failed. Select the parameters and copy them.'
      : '',
);

async function copyAll() {
  if (!oneLine.value) return;
  try {
    await navigator.clipboard.writeText(oneLine.value);
    copyState.value = 'copied';
  } catch {
    copyState.value = 'failed';
  }
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => (copyState.value = 'idle'), 2500);
}

const groups = computed(() => {
  const params = result.value?.params ?? [];
  const definitions = [
    {
      title: 'Colour and range',
      test: (p: string) => /^--(colorprim|transfer|colormatrix|range|chromaloc)\b/.test(p),
    },
    {
      title: 'HDR flags',
      test: (p: string) => /^--(output-depth|hdr10|hdr10-opt|repeat-headers)\b/.test(p),
    },
    {
      title: 'Mastering display',
      test: (p: string) => p.startsWith('--master-display'),
    },
    {
      title: 'Light levels',
      test: (p: string) => p.startsWith('--max-cll'),
    },
  ];
  return definitions
    .map((definition) => ({ title: definition.title, items: params.filter(definition.test) }))
    .filter((group) => group.items.length > 0);
});

const state = computed<'pass' | 'check' | 'problem'>(() => {
  if (!result.value?.params.length) return 'problem';
  return result.value.notes.some((note) => note.verdict === 'warn' || note.verdict === 'bad')
    ? 'check'
    : 'pass';
});

const title = computed(() =>
  state.value === 'problem' ? 'Not an HDR10 source' : 'HDR10 parameters ready',
);

const detail = computed(() =>
  state.value === 'problem'
    ? 'No PQ transfer found. These settings do not apply.'
    : state.value === 'check'
      ? 'Read the notes before you encode.'
      : 'Mastering display and light levels copied from the source.',
);

const announcement = computed(() => {
  const label = state.value === 'pass' ? 'OK' : state.value === 'check' ? 'Check' : 'Problem';
  return [label, title.value, detail.value].filter(Boolean).join('. ');
});
</script>

<template>
  <div class="tool not-content">
    <div class="tool-head">
      <label class="tool-label" for="hdr-input"
        >Paste the Video section of MediaInfo for the UHD source.</label
      >
      <div class="tool-actions">
        <button type="button" @click="useSample">Use sample</button>
      </div>
    </div>

    <textarea
      id="hdr-input"
      v-model="input"
      rows="9"
      spellcheck="false"
      placeholder="Transfer characteristics  : PQ&#10;Mastering display color primaries : Display P3&#10;Mastering display luminance : min: 0.0050 cd/m2, max: 1000 cd/m2&#10;..."
    />

    <p v-if="!result" class="tool-empty">
      Paste the Video section, or use the sample to see the parameters.
    </p>

    <div v-if="result" class="tool-result">
      <ToolVerdict :state="state" :title="title" :detail="detail" />

      <template v-if="result.params.length">
        <div class="tool-copy">
          <p class="tool-group-title">x265 parameters</p>
          <button type="button" @click="copyAll">{{ copyState === 'copied' ? 'Copied' : 'Copy all' }}</button>
        </div>

        <div class="tool-output-groups">
          <section v-for="group in groups" :key="group.title" class="tool-output-group">
            <p class="tool-group-title">{{ group.title }}</p>
            <ul>
              <li v-for="param in group.items" :key="param">
                <code>{{ param }}</code>
              </li>
            </ul>
          </section>
        </div>
      </template>

      <section v-if="result.notes.length" class="tool-group">
        <p class="tool-group-title">Notes</p>
        <ul class="tool-findings">
          <li v-for="(note, index) in result.notes" :key="index">
            <ToolStatus :state="note.verdict" />
            <span>{{ note.text }}</span>
          </li>
        </ul>
      </section>

      <details v-if="Object.keys(result.found).length" class="tool-details">
        <summary>What was read from the source</summary>
        <dl class="tool-facts">
          <div v-for="(value, key) in result.found" :key="key">
            <dt>{{ key }}</dt>
            <dd>{{ value }}</dd>
          </div>
        </dl>
      </details>

      <p class="tool-live" aria-live="polite">{{ copyMessage }}</p>
      <p v-if="copyState === 'failed'" class="tool-help">Copy failed. Select the parameters and copy them.</p>
    </div>

    <p class="tool-live" aria-live="polite">{{ result ? announcement : '' }}</p>
  </div>
</template>
