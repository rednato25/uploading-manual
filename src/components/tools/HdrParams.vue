<script setup lang="ts">
import { computed, ref } from 'vue';
import { hdrParamsFromMediaInfo } from '../../lib/hdr';

const input = ref('');
const result = computed(() => (input.value.trim() ? hdrParamsFromMediaInfo(input.value) : null));
const oneLine = computed(() => result.value?.params.join(' ') ?? '');
const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(oneLine.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    copied.value = false;
  }
}
const verdictLabel = { ok: 'OK', warn: 'Check', bad: 'Problem' } as const;
</script>

<template>
  <div class="tool not-content">
    <label for="hdr-input">Paste the Video section of MediaInfo for the UHD source</label>
    <textarea
      id="hdr-input"
      v-model="input"
      rows="9"
      spellcheck="false"
      placeholder="Transfer characteristics : PQ&#10;Mastering display color primaries : Display P3&#10;Mastering display luminance : min: 0.0050 cd/m2, max: 1000 cd/m2&#10;..."
    />

    <div v-if="result" class="tool-result" aria-live="polite">
      <template v-if="result.params.length">
        <div class="tool-output">
          <code>{{ oneLine }}</code>
          <button type="button" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
        </div>
      </template>
      <ul class="tool-findings">
        <li v-for="(n, i) in result.notes" :key="i" :class="`finding-${n.verdict}`">
          <strong>{{ verdictLabel[n.verdict] }}</strong> {{ n.text }}
        </li>
      </ul>
      <details v-if="Object.keys(result.found).length">
        <summary>What was read from the source</summary>
        <table>
          <tbody>
            <tr v-for="(v, k) in result.found" :key="k">
              <th scope="row">{{ k }}</th>
              <td>{{ v }}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>
  </div>
</template>
