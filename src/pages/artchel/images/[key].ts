export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async ({ params }) => {
  const key = params.key;

  if (!key || key.includes('..') || key.includes('/')) {
    return new Response('Not found', { status: 404 });
  }

  const object = await env.ART_IMAGES.get(key);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (object.etag) headers.set('ETag', object.etag);

  return new Response(object.body, { headers });
};
