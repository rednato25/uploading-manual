<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  state: 'ok' | 'warn' | 'bad';
}>();

const label = computed(() =>
  props.state === 'ok' ? 'OK' : props.state === 'warn' ? 'Check' : 'Problem',
);
</script>

<template>
  <span class="tool-status" :data-state="state">
    <svg v-if="state === 'ok'" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </svg>
    <svg v-else-if="state === 'warn'" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
    <span>{{ label }}</span>
  </span>
</template>
