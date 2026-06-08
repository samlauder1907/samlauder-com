import { Client } from '@notionhq/client';
import { writeFileSync, readFileSync, mkdirSync, existsSync, createWriteStream, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { execFileSync } from 'child_process';
import https from 'https';
import http from 'http';

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
const IMAGES_DIR = join(__dirname, '../public/images/recipes');

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

function extFromUrl(url) {
  const clean = url.split('?')[0];
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

function downloadFile(url, destPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        res.resume();
        return downloadFile(res.headers.location, destPath, redirectCount + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const ws = createWriteStream(destPath);
      pipeline(res, ws).then(resolve).catch(reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// iPhone photos uploaded to Notion are often served as HEIC, which most
// browsers (other than Safari) can't display — convert to JPEG with sips.
function convertHeicToJpeg(srcPath, filename) {
  const jpegFilename = filename.replace(/\.(heic|heif)$/i, '.jpg');
  const jpegPath = join(dirname(srcPath), jpegFilename);
  execFileSync('sips', ['-s', 'format', 'jpeg', srcPath, '--out', jpegPath], { stdio: 'ignore' });
  unlinkSync(srcPath);
  return jpegFilename;
}

// Notion's file:// image URLs are presigned S3 links that expire after about
// an hour, so they can't be committed as-is — download them locally instead.
async function localiseImage(url, slug, filename) {
  if (existsSync(join(IMAGES_DIR, slug, filename))) {
    return `/images/recipes/${slug}/${filename}`;
  }
  const dir = join(IMAGES_DIR, slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const destPath = join(dir, filename);
  try {
    await downloadFile(url, destPath);
    if (/\.(heic|heif)$/i.test(filename)) {
      filename = convertHeicToJpeg(destPath, filename);
    }
    return `/images/recipes/${slug}/${filename}`;
  } catch (e) {
    process.stdout.write(`\n    ! failed to download ${filename}: ${e.message}`);
    return null;
  }
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

// Walk a recipe's blocks (including column_list children) and replace any
// Notion-hosted (expiring) image URLs with locally downloaded copies
let imgCounter = 0;
async function localiseBlockImages(blocks, slug) {
  for (const block of blocks) {
    if (block.type === 'image' && block.image?.file?.url) {
      const remoteUrl = block.image.file.url;
      const filename = `step-${++imgCounter}.${extFromUrl(remoteUrl)}`;
      const local = await localiseImage(remoteUrl, slug, filename);
      if (local) block.image = { ...block.image, file: { ...block.image.file, url: local } };
    }
    if (block._columns) {
      for (const col of block._columns) await localiseBlockImages(col, slug);
    }
  }
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
console.log(`Fetched ${recipes.length} recipes, now fetching page content and images...`);

const pages = {};
for (const recipe of recipes) {
  process.stdout.write(`  ${recipe.name}...`);
  imgCounter = 0;

  const page = results.find(r => r.id === recipe.id);
  if (page?.cover?.file?.url) {
    const local = await localiseImage(page.cover.file.url, recipe.slug, `cover.${extFromUrl(page.cover.file.url)}`);
    if (local) recipe.cover = local;
  }

  const blocks = await fetchBlocks(recipe.id);
  await localiseBlockImages(blocks, recipe.slug);
  pages[recipe.slug] = blocks;
  process.stdout.write(' done\n');
}

writeFileSync(OUT, JSON.stringify({ recipes, pages }, null, 2));
console.log(`\nWrote ${recipes.length} recipes + page content to src/data/recipes.json`);
console.log('Images saved to public/images/recipes/<slug>/');
