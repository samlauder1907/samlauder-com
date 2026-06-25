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

export async function onRequestGet(context) {
  const { env } = context;

  const pieces = [];
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

        // Medium and Notes are never accessed — privacy enforced here
        pieces.push({ title, slug: toSlug(title), status, cover });
      }

      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify(pieces), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    },
  });
}
