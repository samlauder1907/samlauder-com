/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  ART_IMAGES: R2Bucket;
  ART_LOG_PASSWORD: string;
}

declare module 'cloudflare:workers' {
  export const env: Env;
}
