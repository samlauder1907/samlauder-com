import { defineConfig, sessionDrivers } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: 'passthrough',
    prerenderEnvironment: 'node',
  }),
  integrations: [react()],
  // Prevent @astrojs/cloudflare from auto-injecting a SESSION KV binding.
  // The adapter enables KV sessions whenever session.driver is falsy; supplying
  // the null driver satisfies the check without requiring any real infrastructure.
  session: {
    driver: sessionDrivers.null(),
  },
});
