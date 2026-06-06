import { Client } from '@notionhq/client';

const DB_ID = '9e38e7b2-1841-440d-b056-5a88098ef704';

function getClient() {
  const token = import.meta.env.NOTION_TOKEN;
  if (!token) return null;
  return new Client({ auth: token });
}

function richTextToString(richText) {
  if (!Array.isArray(richText)) return '';
  return richText.map(t => t.plain_text).join('');
}

function normaliseRecipe(page) {
  const props = page.properties;

  const name =
    richTextToString(props.Name?.title) ||
    richTextToString(props.name?.title) ||
    'Untitled';

  const tags =
    props.Tags?.multi_select?.map(t => t.name) ||
    props.Category?.multi_select?.map(t => t.name) ||
    props.category?.select ? [props.category.select.name] :
    [];

  const serves =
    richTextToString(props.Serves?.rich_text) ||
    props.Serves?.number?.toString() ||
    richTextToString(props.serves?.rich_text) ||
    '';

  const time =
    richTextToString(props.Time?.rich_text) ||
    props.Time?.number?.toString() ||
    richTextToString(props['Cook time']?.rich_text) ||
    richTextToString(props['Prep time']?.rich_text) ||
    '';

  const description =
    richTextToString(props.Description?.rich_text) ||
    richTextToString(props.description?.rich_text) ||
    '';

  const cover =
    page.cover?.external?.url ||
    page.cover?.file?.url ||
    null;

  return {
    id: page.id,
    slug: page.id.replace(/-/g, ''),
    name,
    tags,
    serves,
    time,
    description,
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
      const res = await notion.databases.query({
        database_id: DB_ID,
        start_cursor: cursor,
        page_size: 100,
        sorts: [{ property: 'Name', direction: 'ascending' }],
      });
      results.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    return results.map(normaliseRecipe);
  } catch (err) {
    console.error('[notion] getRecipes failed:', err.message);
    return [];
  }
}

export async function getRecipePage(pageId) {
  const notion = getClient();
  if (!notion) return { recipe: null, blocks: [] };

  const fullId = pageId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

  try {
    const [page, blocksRes] = await Promise.all([
      notion.pages.retrieve({ page_id: fullId }),
      notion.blocks.children.list({ block_id: fullId, page_size: 100 }),
    ]);

    return {
      recipe: normaliseRecipe(page),
      blocks: blocksRes.results,
    };
  } catch (err) {
    console.error('[notion] getRecipePage failed:', err.message);
    return { recipe: null, blocks: [] };
  }
}
