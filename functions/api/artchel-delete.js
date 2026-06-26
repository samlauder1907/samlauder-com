const NOTION_VERSION = '2022-06-28';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const { id } = body;
  if (!id || typeof id !== 'string') return jsonError('Piece ID is required.');

  const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ archived: true }),
  });

  if (!notionRes.ok) {
    const err = await notionRes.json().catch(() => ({}));
    return jsonError(`Notion error (${notionRes.status}): ${err.message ?? 'unknown'}`, 502);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
