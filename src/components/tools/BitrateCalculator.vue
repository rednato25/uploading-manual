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
const fmt = (n: number, d = 2) => n.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d });
</script>

<template>
  <div class="tool not-content">
    <div class="tool-tabs" role="radiogroup" aria-label="Calculator mode">
      <button type="button" :aria-pressed="mode === 'size'" @click="mode = 'size'">I know the bitrate</button>
      <button type="button" :aria-pressed="mode === 'bitrate'" @click="mode = 'bitrate'">I want a file size</button>
    </div>

    <div class="tool-fields">
      <label>Runtime (hours)<input v-model.number="hours" type="number" min="0" max="10" /></label>
      <label>Runtime (minutes)<input v-model.number="minutes" type="number" min="0" max="59" /></label>
      <label>Width<input v-model.number="width" type="number" min="1" /></label>
      <label>Height<input v-model.number="height" type="number" min="1" /></label>
      <label
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
      <label>Audio, all tracks (kbps)<input v-model.number="audioKbps" type="number" min="0" /></label>
      <label v-if="mode === 'size'">Video bitrate (kbps)<input v-model.number="videoKbps" type="number" min="0" /></label>
      <label v-else>Target size (GB)<input v-model.number="targetGb" type="number" min="0" step="0.1" /></label>
    </div>

    <div class="tool-chips">
      <button v-for="p in presets" :key="p.label" type="button" @click="setRes(p.w, p.h)">{{ p.label }}</button>
    </div>

    <div class="tool-result" aria-live="polite">
      <dl class="tool-grid">
        <div v-if="mode === 'bitrate'">
          <dt>Video bitrate for 2-pass</dt>
          <dd>{{ effectiveVideo.toLocaleString('en-GB') }} kbps</dd>
        </div>
        <div>
          <dt>File size</dt>
          <dd>{{ fmt(size.gb) }} GB <span class="muted">({{ fmt(size.gib) }} GiB)</span></dd>
        </div>
        <div>
          <dt>Resolution class</dt>
          <dd>{{ resClass }}</dd>
        </div>
        <div>
          <dt>Bits per pixel</dt>
          <dd>{{ fmt(bpp, 3) }}</dd>
        </div>
        <div v-if="tier">
          <dt>Compact tier on some trackers (up to 12 Mbps at 1080p, 18 at 2160p)</dt>
          <dd>{{ tier }}</dd>
        </div>
      </dl>
      <p class="muted small">
        Audio here means every audio track added together. Size includes about 0.5% for the MKV container. The tier uses the video bitrate only.
      </p>
    </div>
  </div>
</template>
