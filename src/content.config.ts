import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

/**
 * Starlight's schema plus four fields of our own.
 *
 * - tools:      software the page relies on, with versions where it matters
 * - verifiedOn: the last date the procedure was actually run end to end.
 *               Never fill it in without doing that. Missing = "not verified".
 * - video:      optional walkthrough link, shown at the top of the page
 * - level:      who the page is written for
 */
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        tools: z.array(z.string()).default([]),
        verifiedOn: z.coerce.date().optional(),
        video: z.url().optional(),
        level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      }),
    }),
  }),
};
