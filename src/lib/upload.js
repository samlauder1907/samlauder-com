const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImageFile(file) {
  if (!file || !(file instanceof File) || file.size === 0) return null;
  if (!ALLOWED_TYPES.has(file.type)) {
    return 'Only JPEG, PNG, and WebP images are accepted. Please convert HEIC files to JPEG before uploading.';
  }
  return null;
}

export function toSlug(title) {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled'
  );
}

export async function uniqueSlug(db, baseSlug) {
  let slug = baseSlug;
  let n = 2;
  for (;;) {
    const row = await db.prepare('SELECT id FROM pieces WHERE slug = ?').bind(slug).first();
    if (!row) return slug;
    slug = `${baseSlug}-${n++}`;
  }
}

export function generateImageKey(prefix, filename) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  return `${prefix}-${crypto.randomUUID()}.${ext}`;
}

export async function uploadToR2(bucket, key, file) {
  const buffer = await file.arrayBuffer();
  await bucket.put(key, buffer, {
    httpMetadata: { contentType: file.type },
  });
}
