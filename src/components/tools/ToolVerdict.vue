<script setup lang="ts">
import { computed } from 'vue';

/** Mirrors src/components/ui/Verdict.astro. Both use the .ui-verdict styles. */
const props = defineProps<{
  state: 'pass' | 'check' | 'problem';
  title: string;
  detail?: string;
}>();

const word = computed(() =>
  props.state === 'pass' ? 'OK' : props.state === 'check' ? 'Check' : 'Problem',
);
</script>

<template>
  <div class="ui-verdict" :data-state="state">
    <svg v-if="state === 'pass'" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </svg>
    <svg v-else-if="state === 'check'" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
    <span class="ui-verdict-word">{{ word }}</span>
    <span class="ui-verdict-title">{{ title }}</span>
    <span v-if="detail" class="ui-verdict-detail">{{ detail }}</span>
  </div>
</template>
