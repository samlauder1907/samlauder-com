import { Client } from '@notionhq/client';

const DB_ID = '2856a8b1-60c0-45fa-849d-21d3c68fe40c';

function getClient() {
  const token = process.env.NOTION_TOKEN ?? import.meta.env.NOTION_TOKEN;
  console.log('[notion] token present:', !!token);
  if (!token) return null;
  return new Client({ auth: token });
}

function richTextToString(richText) {
  if (!Array.isArray(richText)) return '';
  return richText.map(t => t.plain_text).join('');
}

function normaliseRecipe(page) {
  const props = page.properties;

  const name = richTextToString(props.Name?.title) || 'Untitled';

  const category = props.Category?.multi_select?.map(t => t.name) ?? [];
  const difficulty = props.Difficulty?.multi_select?.map(t => t.name) ?? [];
  const duration = props.Duration?.multi_select?.map(t => t.name) ?? [];
  const credits = richTextToString(props.Credits?.rich_text);

  const cover =
    page.cover?.external?.url ||
    page.cover?.file?.url ||
    null;

  return {
    id: page.id,
    slug: page.id.replace(/-/g, ''),
    name,
    tags: category,
    difficulty,
    duration,
    credits,
    cover,
    lastEdited: page.last_edited_time,
  };
}

export async function getRecipes() {
  const notion = getClient();
  if (!notion) return [];

  try {
    const results = [];
    let cursor;

    do {
      const res = await notion.dataSources.query({
        data_source_id: DB_ID,
        start_cursor: cursor,
        page_size: 100,
        sorts: [{ property: 'Name', direction: 'ascending' }],
      });
      results.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    return results.map(normaliseRecipe);
  } catch (err) {
    console.error('[notion] getRecipes failed:', err.message, err.status, err.code);
    throw err;
  }
}

async function fetchBlocks(notion, blockId) {
  const res = await notion.blocks.children.list({ block_id: blockId, page_size: 100 });
  const blocks = [];
  for (const block of res.results) {
    if (block.type === 'column_list') {
      const colsRes = await notion.blocks.children.list({ block_id: block.id, page_size: 100 });
      const columns = [];
      for (const col of colsRes.results) {
        const colContent = await notion.blocks.children.list({ block_id: col.id, page_size: 100 });
        columns.push(colContent.results);
      }
      blocks.push({ ...block, _columns: columns });
    } else {
      blocks.push(block);
    }
  }
  return blocks;
}

export async function getRecipePage(pageId) {
  const notion = getClient();
  if (!notion) return { recipe: null, blocks: [] };

  const fullId = pageId.replace(/-/g, '').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

  try {
    const [page, blocks] = await Promise.all([
      notion.pages.retrieve({ page_id: fullId }),
      fetchBlocks(notion, fullId),
    ]);

    return {
      recipe: normaliseRecipe(page),
      blocks,
    };
  } catch (err) {
    console.error('[notion] getRecipePage failed:', err.message);
    return { recipe: null, blocks: [] };
  }
}
