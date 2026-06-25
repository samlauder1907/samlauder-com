const DB_ID = '28f6a06c-e92c-49bc-ab84-68a968daf15f';
const R2_PUBLIC_BASE = 'https://pub-dee00670cc0f4e899a38d9bbe64ecb80.r2.dev';
const NOTION_VERSION = '2022-06-28';
const VALID_STATUSES = ['In Progress', 'Finished', 'Given Away'];

export async function onRequestPost(context) {
  const { request, env } = context;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('Invalid form submission.');
  }

  const title = formData.get('title')?.toString().trim() ?? '';
  const status = formData.get('status')?.toString() ?? 'In Progress';
  const coverFile = formData.get('cover_image');

  if (!title) return errorResponse('Title is required.');
  const safeStatus = VALID_STATUSES.includes(status) ? status : 'In Progress';

  let coverUrl = null;
  if (coverFile && coverFile.size > 0) {
    const mimeError = validateMime(coverFile.type, coverFile.name);
    if (mimeError) return errorResponse(mimeError);

    const slug = toSlug(title);
    const ext = extFromFilename(coverFile.name);
    const key = `covers/${slug}-${Date.now()}.${ext}`;

    try {
      await env.ART_IMAGES.put(key, await coverFile.arrayBuffer(), {
        httpMetadata: { contentType: coverFile.type },
      });
    } catch (err) {
      return errorResponse(`Image upload failed: ${err.message}`);
    }
    coverUrl = `${R2_PUBLIC_BASE}/${key}`;
  }

  const pageBody = {
    parent: { database_id: DB_ID },
    properties: {
      Name: { title: [{ text: { content: title } }] },
      Status: { select: { name: safeStatus } },
      ...(coverUrl
        ? { 'Cover Image': { files: [{ type: 'external', name: 'cover', external: { url: coverUrl } }] } }
        : {}),
    },
  };

  const notionRes = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pageBody),
  });

  if (!notionRes.ok) {
    const err = await notionRes.json().catch(() => ({}));
    return errorResponse(`Notion error (${notionRes.status}): ${err.message ?? 'unknown'}`);
  }

  return Response.redirect(new URL('/artchel', request.url).toString(), 303);
}

function validateMime(mimeType, filename) {
  const type = (mimeType ?? '').toLowerCase();
  const name = (filename ?? '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif' || /\.(heic|heif)$/.test(name)) {
    return 'HEIC/HEIF images cannot be uploaded directly. Please convert to JPEG, PNG, or WebP first.';
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
    return `Unsupported file type "${mimeType}". Please upload a JPEG, PNG, or WebP image.`;
  }
  return null;
}

function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function extFromFilename(filename) {
  const match = (filename ?? '').match(/\.([a-zA-Z0-9]+)$/);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  return ext === 'jpeg' ? 'jpg' : ext;
}

function errorResponse(message) {
  return new Response(`Upload failed: ${message}`, {
    status: 400,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
