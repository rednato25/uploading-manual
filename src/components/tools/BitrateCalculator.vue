<script setup lang="ts">
import { computed, ref } from 'vue';
import { bitsPerPixel, resolutionClass, sizeFromBitrate, toSeconds, videoKbpsForSize } from '../../lib/bitrate';
import { tierFor } from '../../data/tiers';

const mode = ref<'size' | 'bitrate'>('size');

const hours = ref(2);
const minutes = ref(0);
const width = ref(1920);
const height = ref(1080);
const fps = ref('23.976');
const audioKbps = ref(640);
const videoKbps = ref(10000);
const targetGb = ref(10);

const seconds = computed(() => toSeconds(Number(hours.value) || 0, Number(minutes.value) || 0));
const fpsNum = computed(() => {
  const map: Record<string, number> = { '23.976': 24000 / 1001, '29.97': 30000 / 1001, '59.94': 60000 / 1001 };
  return map[fps.value] ?? Number(fps.value);
});

const effectiveVideo = computed(() =>
  mode.value === 'size'
    ? Number(videoKbps.value) || 0
    : Math.max(0, Math.floor(videoKbpsForSize(Number(targetGb.value) || 0, Number(audioKbps.value) || 0, seconds.value))),
);

const size = computed(() => sizeFromBitrate(effectiveVideo.value, Number(audioKbps.value) || 0, seconds.value));
const bpp = computed(() => bitsPerPixel(effectiveVideo.value, width.value, height.value, fpsNum.value));
const resClass = computed(() => resolutionClass(width.value));
const tier = computed(() => tierFor(resClass.value, effectiveVideo.value / 1000));
const fmt = (n: number, d = 2) => n.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d });
const announcement = computed(
  () => `${fmt(size.value.gb)} GB, ${tier.value ? `${tier.value.toLowerCase()} tier` : 'no tracker tier'}, ${resClass.value}.`,
);

const presets = [
  { label: '1080p full frame', w: 1920, h: 1080 },
  { label: '1080p scope (2.40:1)', w: 1920, h: 800 },
  { label: '2160p full frame', w: 3840, h: 2160 },
  { label: '2160p scope (2.40:1)', w: 3840, h: 1600 },
  { label: '720p', w: 1280, h: 720 },
];
const setRes = (w: number, h: number) => {
  width.value = w;
  height.value = h;
};
</script>

<template>
  <div class="tool not-content">
    <fieldset class="tool-mode">
      <legend>Mode</legend>
      <div class="tool-segmented">
        <label>
          <input v-model="mode" type="radio" name="calc-mode" value="size" />
          <span>I know the bitrate</span>
        </label>
        <label>
          <input v-model="mode" type="radio" name="calc-mode" value="bitrate" />
          <span>I want a file size</span>
        </label>
      </div>
    </fieldset>

    <div class="tool-fields">
      <label class="tool-field">Runtime (hours)<input v-model.number="hours" type="number" min="0" max="10" /></label>
      <label class="tool-field">Runtime (minutes)<input v-model.number="minutes" type="number" min="0" max="59" /></label>
      <label class="tool-field">Width<input v-model.number="width" type="number" min="1" /></label>
      <label class="tool-field">Height<input v-model.number="height" type="number" min="1" /></label>
      <label class="tool-field"
        >Frame rate
        <select v-model="fps">
          <option>23.976</option>
          <option>24</option>
          <option>25</option>
          <option>29.97</option>
          <option>50</option>
          <option>59.94</option>
        </select>
      </label>
      <label class="tool-field">Audio, all tracks (kbps)<input v-model.number="audioKbps" type="number" min="0" /></label>
      <label v-if="mode === 'size'" class="tool-field"
        >Video bitrate (kbps)<input v-model.number="videoKbps" type="number" min="0"
      /></label>
      <label v-else class="tool-field"
        >Target size (GB)<input v-model.number="targetGb" type="number" min="0" step="0.1"
      /></label>
    </div>

    <div class="tool-chips">
      <button v-for="preset in presets" :key="preset.label" type="button" @click="setRes(preset.w, preset.h)">
        {{ preset.label }}
      </button>
    </div>

    <p class="tool-hint">The starting values are a 2 hour 1080p film. Change them for your release.</p>

    <p class="tool-live" aria-live="polite">{{ announcement }}</p>

    <div class="tool-result">
      <p class="tool-summary">
        <strong>{{ fmt(size.gb) }} GB</strong>
        <span>{{ resClass }} at {{ fmt(effectiveVideo / 1000) }} Mb/s video</span>
        <span v-if="tier" class="tool-summary-tier">{{ tier }} tier</span>
        <span v-else class="tool-summary-tier">No tracker tier for this resolution</span>
      </p>

      <dl class="tool-facts">
        <div v-if="mode === 'bitrate'">
          <dt>Video bitrate for 2-pass</dt>
          <dd>{{ effectiveVideo.toLocaleString('en-GB') }} kbps</dd>
        </div>
        <div>
          <dt>File size</dt>
          <dd>{{ fmt(size.gb) }} GB ({{ fmt(size.gib) }} GiB)</dd>
        </div>
        <div>
          <dt>Resolution class</dt>
          <dd>{{ resClass }}</dd>
        </div>
        <div>
          <dt>Bits per pixel</dt>
          <dd>{{ fmt(bpp, 3) }}</dd>
        </div>
      </dl>

      <p class="tool-help">
        Audio means every audio track added together. Size includes about 0.5% for the MKV container.
      </p>
      <p v-if="tier" class="tool-help">
        Compact is up to 12 Mb/s at 1080p and 18 Mb/s at 2160p on trackers that use these tiers.
      </p>
    </div>
  </div>
</template>
