const R2_PUBLIC_BASE = 'https://pub-dee00670cc0f4e899a38d9bbe64ecb80.r2.dev';
const NOTION_VERSION = '2022-06-28';

export async function onRequestPost(context) {
  const { request, env } = context;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Invalid form submission.');
  }

  const pieceId = formData.get('piece_id')?.toString().trim() ?? '';
  const imageFile = formData.get('image');

  if (!pieceId) return jsonError('Piece ID is required.');
  if (!imageFile || imageFile.size === 0) return jsonError('Image file is required.');

  const mimeError = validateMime(imageFile.type, imageFile.name);
  if (mimeError) return jsonError(mimeError);

  const ext = extFromFilename(imageFile.name);
  const key = `progress/${pieceId.slice(0, 8)}-${Date.now()}.${ext}`;

  try {
    await env.ART_IMAGES.put(key, await imageFile.arrayBuffer(), {
      httpMetadata: { contentType: imageFile.type },
    });
  } catch (err) {
    return jsonError(`Image upload failed: ${err.message}`);
  }

  const imageUrl = `${R2_PUBLIC_BASE}/${key}`;

  const notionRes = await fetch(`https://api.notion.com/v1/blocks/${pieceId}/children`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      children: [
        {
          object: 'block',
          type: 'image',
          image: {
            type: 'external',
            external: { url: imageUrl },
          },
        },
      ],
    }),
  });

  if (!notionRes.ok) {
    const err = await notionRes.json().catch(() => ({}));
    const msg = `Notion error (${notionRes.status}): ${err.message ?? JSON.stringify(err)}`;
    console.error('[artchel-progress] block append failed:', msg, 'piece_id:', pieceId);
    return jsonError(msg, 502);
  }

  return new Response(JSON.stringify({ ok: true, url: imageUrl }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function validateMime(mimeType, filename) {
  const type = (mimeType ?? '').toLowerCase();
  const name = (filename ?? '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif' || /\.(heic|heif)$/.test(name)) {
    return 'HEIC/HEIF images are not supported. Please convert to JPEG, PNG, or WebP first.';
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
    return `Unsupported file type "${mimeType}". Please upload a JPEG, PNG, or WebP image.`;
  }
  return null;
}

function extFromFilename(filename) {
  const match = (filename ?? '').match(/\.([a-zA-Z0-9]+)$/);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  return ext === 'jpeg' ? 'jpg' : ext;
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
