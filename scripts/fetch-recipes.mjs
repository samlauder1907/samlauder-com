import { Client } from '@notionhq/client';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
try {
  const env = readFileSync(join(__dirname, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {}

const DB_ID = '2856a8b1-60c0-45fa-849d-21d3c68fe40c';
const OUT = join(__dirname, '../src/data/recipes.json');

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error('NOTION_TOKEN not set in .env');
  process.exit(1);
}

const notion = new Client({ auth: token });

function richTextToString(richText) {
  if (!Array.isArray(richText)) return '';
  return richText.map(t => t.plain_text).join('');
}

function normaliseRecipe(page) {
  const props = page.properties;
  return {
    id: page.id,
    slug: page.id.replace(/-/g, ''),
    name: richTextToString(props.Name?.title) || 'Untitled',
    tags: props.Category?.multi_select?.map(t => t.name) ?? [],
    difficulty: props.Difficulty?.multi_select?.map(t => t.name) ?? [],
    duration: props.Duration?.multi_select?.map(t => t.name) ?? [],
    credits: richTextToString(props.Credits?.rich_text),
    cover: page.cover?.external?.url || page.cover?.file?.url || null,
    lastEdited: page.last_edited_time,
  };
}

async function fetchBlocks(blockId) {
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

// Fetch recipe list
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

const recipes = results.map(normaliseRecipe);
console.log(`Fetched ${recipes.length} recipes, now fetching page content...`);

// Fetch blocks for each recipe
const pages = {};
for (const recipe of recipes) {
  process.stdout.write(`  ${recipe.name}...`);
  const blocks = await fetchBlocks(recipe.id);
  pages[recipe.slug] = blocks;
  process.stdout.write(' done\n');
}

writeFileSync(OUT, JSON.stringify({ recipes, pages }, null, 2));
console.log(`\nWrote ${recipes.length} recipes + all page content to src/data/recipes.json`);
