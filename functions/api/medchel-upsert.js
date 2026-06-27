const DB_ID = '38c7f2e5-26bb-8123-9420-e3d51557b5d0';
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

  const id = formData.get('id')?.toString().trim() || null;
  const title = formData.get('title')?.toString().trim() ?? '';
  const tags = formData.get('tags')?.toString().trim() ?? '';
  const description = formData.get('description')?.toString() ?? '';
  const links = formData.get('links')?.toString() ?? '';
  const imageFiles = formData.getAll('images');

  if (!title) return jsonError('Title is required.');

  // Upload new images to R2
  const newImageUrls = [];
  for (const file of imageFiles) {
    if (!file || file.size === 0) continue;
    const mimeError = validateMime(file.type, file.name);
    if (mimeError) return jsonError(mimeError);

    const slug = toSlug(title);
    const ext = extFromFilename(file.name);
    const key = `medchel/${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

    try {
      await env.ART_IMAGES.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
    } catch (err) {
      return jsonError(`Image upload failed: ${err.message}`);
    }
    newImageUrls.push(`${R2_PUBLIC_BASE}/${key}`);
  }

  // For updates, fetch existing images so we can append rather than replace
  let existingImageUrls = [];
  if (id) {
    try {
      const pageRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        headers: {
          Authorization: `Bearer ${env.NOTION_TOKEN}`,
          'Notion-Version': NOTION_VERSION,
        },
      });
      if (pageRes.ok) {
        const pageData = await pageRes.json();
        const existingFiles = pageData.properties?.Images?.files ?? [];
        existingImageUrls = existingFiles
          .map(f => f.external?.url ?? f.file?.url ?? null)
          .filter(Boolean);
      }
    } catch {
      // proceed with just new images
    }
  }

  const allImageUrls = [...existingImageUrls, ...newImageUrls];
  const notionFiles = allImageUrls.map((url, i) => ({
    type: 'external',
    name: `image-${i + 1}`,
    external: { url },
  }));

  const properties = {
    Name: { title: [{ type: 'text', text: { content: title } }] },
    Tags: { rich_text: tags ? [{ type: 'text', text: { content: tags } }] : [] },
    Description: { rich_text: description ? [{ type: 'text', text: { content: description } }] : [] },
    Links: { rich_text: links ? [{ type: 'text', text: { content: links } }] : [] },
    Images: { files: notionFiles },
  };

  let notionRes;
  if (id) {
    notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });
  } else {
    notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: DB_ID }, properties }),
    });
  }

  if (!notionRes.ok) {
    const err = await notionRes.json().catch(() => ({}));
    return jsonError(`Notion error (${notionRes.status}): ${err.message ?? 'unknown'}`, 502);
  }

  const savedPage = await notionRes.json();
  const tagList = tags
    ? tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    : [];
  const linkList = links
    ? links.split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  return new Response(
    JSON.stringify({
      id: savedPage.id,
      title,
      tags: tagList,
      description,
      images: allImageUrls,
      links: linkList,
      lastEdited: savedPage.last_edited_time ?? null,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
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

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
