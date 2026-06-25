const DB_ID = '28f6a06c-e92c-49bc-ab84-68a968daf15f';
const NOTION_VERSION = '2022-06-28';

function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function richText(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map(t => t.plain_text).join('');
}

async function fetchPagePhotos(pageId, coverUrl, pageCreatedTime, notionToken) {
  try {
    const res = await fetch(
      `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
      {
        headers: {
          Authorization: `Bearer ${notionToken}`,
          'Notion-Version': NOTION_VERSION,
        },
      },
    );

    if (!res.ok) {
      return coverUrl ? [{ url: coverUrl, date: pageCreatedTime }] : [];
    }

    const data = await res.json();
    const imageBlocks = data.results
      .filter(b => b.type === 'image')
      .map(b => ({
        url: b.image?.external?.url ?? b.image?.file?.url ?? null,
        date: b.created_time,
      }))
      .filter(p => p.url);

    return coverUrl
      ? [{ url: coverUrl, date: pageCreatedTime }, ...imageBlocks]
      : imageBlocks;
  } catch {
    return coverUrl ? [{ url: coverUrl, date: pageCreatedTime }] : [];
  }
}

export async function onRequestGet(context) {
  const { env } = context;

  const rawPieces = [];
  let cursor;

  try {
    do {
      const body = {
        sorts: [{ property: 'Name', direction: 'ascending' }],
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      };

      const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.NOTION_TOKEN}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: `Notion error (${res.status}): ${err.message ?? 'unknown'}` }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const data = await res.json();

      for (const page of data.results) {
        const title = richText(page.properties.Name?.title) || 'Untitled';
        const status = page.properties.Status?.select?.name ?? 'In Progress';
        const coverFiles = page.properties['Cover Image']?.files ?? [];
        const coverFile = coverFiles[0];
        const cover = coverFile?.external?.url ?? coverFile?.file?.url ?? null;
        const comments = richText(page.properties.Comments?.rich_text);
        const createdTime = page.created_time;

        rawPieces.push({ id: page.id, title, slug: toSlug(title), status, cover, comments, createdTime });
      }

      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Enrich each piece with its block-children photo history.
  // Wrapped in its own try/catch so a failure here never breaks the gallery —
  // we fall back to each piece's Cover Image property value.
  let pieces;
  try {
    pieces = await Promise.all(
      rawPieces.map(async (piece) => {
        const photos = await fetchPagePhotos(piece.id, piece.cover, piece.createdTime, env.NOTION_TOKEN);
        const cover = photos.length > 0 ? photos[photos.length - 1].url : piece.cover;
        const { createdTime, ...rest } = piece;
        return { ...rest, photos, cover };
      }),
    );
  } catch {
    // Photo history unavailable — serve plain pieces with cover from Notion property
    pieces = rawPieces.map(({ createdTime, ...piece }) => ({
      ...piece,
      photos: piece.cover ? [{ url: piece.cover, date: null }] : [],
    }));
  }

  return new Response(JSON.stringify(pieces), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    },
  });
}
