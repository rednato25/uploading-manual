<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

interface Item {
  text: string;
  href?: string;
}

const props = defineProps<{
  id: string;
  items: Item[];
}>();

const key = `manual-checklist:${props.id}`;
const checked = ref<boolean[]>(props.items.map(() => false));
const doneCount = computed(() => checked.value.filter(Boolean).length);

onMounted(() => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const saved: unknown = JSON.parse(raw);
    if (Array.isArray(saved)) {
      checked.value = props.items.map((_, index) => Boolean(saved[index]));
    }
  } catch {
    // Storage can be blocked or hold junk. The list still works.
  }
});

watch(
  checked,
  () => {
    try {
      localStorage.setItem(key, JSON.stringify(checked.value));
    } catch {
      // Storage can be blocked. The ticks still work for this visit.
    }
  },
  { deep: true }
);

const reset = () => {
  checked.value = props.items.map(() => false);
};
</script>

<template>
  <div class="checklist not-content">
    <div class="bar">
      <p class="count" aria-live="polite">{{ doneCount }} of {{ items.length }} done</p>
      <button type="button" class="reset" :disabled="doneCount === 0" @click="reset">Reset</button>
    </div>

    <ul class="items">
      <li v-for="(item, index) in items" :key="index">
        <input :id="`${id}-${index}`" v-model="checked[index]" type="checkbox" />
        <label :for="`${id}-${index}`">
          <a v-if="item.href" :href="item.href">{{ item.text }}</a>
          <template v-else>{{ item.text }}</template>
        </label>
      </li>
    </ul>
  </div>
</template>

<style scoped>
  .checklist {
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
    background: var(--sl-color-gray-7);
    padding: 1.25rem;
    margin-block: 1.5rem;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-block: 0.25rem 0.7rem;
    border-bottom: 1px solid var(--sl-color-gray-5);
  }

  .count {
    margin: 0;
    font-family: var(--sl-font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    color: var(--sl-color-gray-2);
  }

  .reset {
    font-family: var(--sl-font-mono);
    font-size: 0.75rem;
    color: var(--sl-color-gray-2);
    background: transparent;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.375rem;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
  }

  .reset:hover:not(:disabled) {
    border-color: var(--sl-color-gray-2);
    color: var(--sl-color-white);
  }

  .reset:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .reset:focus-visible {
    outline: 2px solid var(--sl-color-accent);
    outline-offset: 2px;
  }

  .items {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .items li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.65rem;
    align-items: start;
    padding: 1rem 0;
    border-bottom: 1px solid var(--sl-color-gray-6);
  }

  .items li:last-child {
    border-bottom: 0;
    padding-bottom: 0.15rem;
  }

  input[type='checkbox'] {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0.18rem 0 0;
    accent-color: var(--sl-color-accent);
    cursor: pointer;
  }

  input[type='checkbox']:focus-visible {
    outline: 2px solid var(--sl-color-accent);
    outline-offset: 2px;
  }

  label {
    cursor: pointer;
    font-size: var(--sl-text-base);
    line-height: 1.5;
    color: var(--sl-color-white);
  }

  input:checked + label {
    color: var(--sl-color-gray-3);
  }

  label a {
    color: var(--sl-color-text-accent);
    text-underline-offset: 0.2em;
  }

  label a:hover,
  label a:focus-visible {
    color: var(--sl-color-accent-high);
  }

  @media print {
    .checklist {
      border: 0;
      border-radius: 0;
      background: none;
      padding: 0;
      margin: 1rem 0;
    }

    .bar {
      display: none;
    }

    .items li {
      border-bottom: 0;
      padding: 0.1rem 0;
    }

    input[type='checkbox'] {
      appearance: none;
      -webkit-appearance: none;
      width: 0.85rem;
      height: 0.85rem;
      margin-top: 0.15rem;
      border: 1px solid #000;
      border-radius: 0;
      background: none;
      accent-color: transparent;
    }

    label,
    input:checked + label {
      color: #000;
    }

    label a {
      color: #000;
      text-decoration: none;
    }
  }
</style>

<style>
  /* Non-scoped so static HTML checks see the spacing. The class names are unique to this component. */
  .checklist.not-content {
    padding: 1.25rem;
  }

  .checklist .items li {
    padding: 1rem 0;
  }
</style>
