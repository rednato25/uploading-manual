// @ts-check
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import vue from '@astrojs/vue';
import starlightThemeRapide from 'starlight-theme-rapide';
import starlightImageZoom from 'starlight-image-zoom';
import starlightLinksValidator from 'starlight-links-validator';

/** @param {string} label @param {string} directory @param {boolean} [collapsed] */
const group = (label, directory, collapsed = true) => ({
  label,
  collapsed,
  items: [{ autogenerate: { directory } }],
});

/**
 * Marks a table that actually scrolls as a focusable, named region, so a
 * keyboard user can scroll it and a screen reader can announce it.
 */
const tableA11yScript = `
(() => {
  const labelFor = (table) => {
    const scope = table.closest('.sl-markdown-content');
    const page = (document.querySelector('h1') || {}).textContent || 'Table';
    if (!scope) return page.trim();
    let label = page.trim();
    for (const node of scope.querySelectorAll('h2, h3, h4, table')) {
      if (node.tagName === 'TABLE') {
        if (node === table) return label;
        continue;
      }
      label = node.textContent.trim() || label;
    }
    return label || 'Table';
  };
  const sync = () => {
    for (const table of document.querySelectorAll('.sl-markdown-content table')) {
      if (table.scrollWidth > table.clientWidth + 2) {
        table.setAttribute('tabindex', '0');
        table.setAttribute('aria-label', labelFor(table));
      } else {
        table.removeAttribute('tabindex');
        table.removeAttribute('aria-label');
      }
    }
  };
  const start = () => {
    sync();
    addEventListener('resize', sync);
    if (document.fonts) document.fonts.ready.then(sync);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
`;

const hasTrackers = existsSync('./src/content/docs/trackers');
const redirectsPath = pathToFileURL(resolve('src/data/redirects.mjs')).href;

export default defineConfig({
  trailingSlash: 'ignore',
  // Old Romanian slugs. /muzica-red/ has no new page and stays a 404.
  ...(hasTrackers ? { redirects: (await import(/* @vite-ignore */ redirectsPath)).default } : {}),
  devToolbar: { enabled: false },
  integrations: [
    starlight({
      title: 'Uploading Manual',
      description: 'A personal manual for remuxing, encoding and uploading to private trackers.',
      lastUpdated: false,
      pagination: true,
      // Private site: keep it out of search engines.
      head: [
        { tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' } },
        { tag: 'script', content: tableA11yScript },
      ],
      plugins: [starlightThemeRapide(), starlightImageZoom(), starlightLinksValidator()],
      components: {
        PageTitle: './src/components/overrides/PageTitle.astro',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        group('Basics', 'basics'),
        group('Remux', 'remux'),
        group('Encode', 'encode'),
        group('Audio and subtitles', 'audio-subs'),
        group('Upload', 'upload'),
        ...(hasTrackers ? [group('Trackers', 'trackers')] : []),
        group('Tools', 'tools'),
        group('Reference', 'reference'),
      ],
    }),
    vue(),
  ],
});
