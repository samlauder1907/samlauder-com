const DB_ID = '38c7f2e5-26bb-8123-9420-e3d51557b5d0';
const NOTION_VERSION = '2022-06-28';

function richText(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map(t => t.plain_text).join('');
}

export async function onRequestGet(context) {
  const { env } = context;
  const entries = [];
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
        const tagsRaw = richText(page.properties.Tags?.rich_text);
        const tags = tagsRaw
          ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
          : [];
        const description = richText(page.properties.Description?.rich_text);
        const imageFiles = page.properties.Images?.files ?? [];
        const images = imageFiles
          .map(f => f.external?.url ?? f.file?.url ?? null)
          .filter(Boolean);

        const linksRaw = richText(page.properties.Links?.rich_text);
        const links = linksRaw
          ? linksRaw.split('\n').map(l => l.trim()).filter(Boolean)
          : [];

        const lastEdited = page.last_edited_time ?? null;

        entries.push({ id: page.id, title, tags, description, images, links, lastEdited });
      }

      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify(entries), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    },
  });
}
