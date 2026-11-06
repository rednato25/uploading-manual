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
const group = (label, directory, collapsed = false) => ({
  label,
  collapsed,
  items: [{ autogenerate: { directory } }],
});

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
      head: [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' } }],
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
