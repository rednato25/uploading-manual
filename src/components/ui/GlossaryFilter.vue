<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const query = ref('');
const content = ref<HTMLElement | null>(null);
const noMatches = ref(false);

const applyFilter = () => {
  const root = content.value;
  if (!root) return;

  const needle = query.value.trim().toLowerCase();
  let visibleRows = 0;

  for (const table of Array.from(root.querySelectorAll<HTMLTableElement>('table'))) {
    const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'));
    let tableRows = 0;

    for (const row of rows) {
      const text = (row.textContent ?? '').toLowerCase();
      const show = needle === '' || text.includes(needle);
      row.hidden = !show;
      if (show) tableRows += 1;
    }

    const showTable = tableRows > 0;
    table.hidden = !showTable;

    let heading = table.previousElementSibling;
    while (heading && !heading.matches('.sl-heading-wrapper, h2')) {
      heading = heading.previousElementSibling;
    }
    if (heading instanceof HTMLElement) heading.hidden = !showTable;

    visibleRows += tableRows;
  }

  noMatches.value = visibleRows === 0;
};

onMounted(applyFilter);
watch(query, applyFilter);
</script>

<template>
  <div class="glossary-filter">
    <div class="controls not-content">
      <label for="glossary-filter">Filter the glossary</label>
      <input
        id="glossary-filter"
        v-model="query"
        type="search"
        placeholder="Type a term or meaning"
        autocomplete="off"
      />
      <p v-if="noMatches" class="empty" role="status">No matching terms.</p>
    </div>

    <div id="glossary-tables" ref="content" class="glossary-tables">
      <slot />
    </div>
  </div>
</template>

<style scoped>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    margin-block: 1.5rem 0;
  }

  label {
    font-size: var(--sl-text-sm);
    font-weight: 600;
    color: var(--sl-color-white);
  }

  input {
    flex: 1 1 16rem;
    min-width: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.375rem;
    background: var(--sl-color-gray-7);
    color: var(--sl-color-white);
    font: inherit;
  }

  input:focus-visible {
    outline: 2px solid var(--sl-color-accent);
    outline-offset: 2px;
  }

  .empty {
    margin: 0;
    color: var(--sl-color-gray-2);
  }

  :deep(table) {
    display: table;
    width: 100%;
    overflow: visible;
  }

  :deep(table[hidden]) {
    display: none;
  }

  :deep(thead th) {
    position: sticky;
    top: calc(var(--sl-nav-height) + var(--sl-mobile-toc-height));
    z-index: 1;
    background: var(--sl-color-bg);
    box-shadow: inset 0 -1px 0 var(--sl-color-gray-4);
  }
</style>
