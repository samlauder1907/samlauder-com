import { writeFileSync, readFileSync, mkdirSync, existsSync, createWriteStream, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { execFileSync } from 'child_process';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const env = readFileSync(join(__dirname, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {}

const DB_ID = '28f6a06c-e92c-49bc-ab84-68a968daf15f';
const NOTION_VERSION = '2022-06-28';
const OUT = join(__dirname, '../src/data/artchel.json');
const IMAGES_DIR = join(__dirname, '../public/images/artchel');

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error('NOTION_TOKEN not set in .env');
  process.exit(1);
}

async function notionFetch(method, path, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Notion API ${res.status}: ${json.message}`);
  return json;
}

function richTextToString(richText) {
  if (!Array.isArray(richText)) return '';
  return richText.map(t => t.plain_text).join('');
}

function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
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

function convertHeicToJpeg(srcPath, filename) {
  const jpegFilename = filename.replace(/\.(heic|heif)$/i, '.jpg');
  const jpegPath = join(dirname(srcPath), jpegFilename);
  execFileSync('sips', ['-s', 'format', 'jpeg', srcPath, '--out', jpegPath], { stdio: 'ignore' });
  unlinkSync(srcPath);
  return jpegFilename;
}

async function localiseImage(url, slug, filename) {
  const dir = join(IMAGES_DIR, slug);
  const destPath = join(dir, filename);
  if (existsSync(destPath)) {
    return `/images/artchel/${slug}/${filename}`;
  }
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  try {
    await downloadFile(url, destPath);
    if (/\.(heic|heif)$/i.test(filename)) {
      filename = convertHeicToJpeg(destPath, filename);
    }
    return `/images/artchel/${slug}/${filename}`;
  } catch (e) {
    process.stdout.write(`\n    ! failed to download ${filename}: ${e.message}`);
    return null;
  }
}

// Query Art Log database — reads Name, Status, Cover Image only (Medium and Notes are never accessed)
const pieces = [];
let cursor;
do {
  const res = await notionFetch('POST', `/databases/${DB_ID}/query`, {
    sorts: [{ property: 'Name', direction: 'ascending' }],
    page_size: 100,
    ...(cursor ? { start_cursor: cursor } : {}),
  });

  for (const page of res.results) {
    const title = richTextToString(page.properties.Name?.title) || 'Untitled';
    const status = page.properties.Status?.select?.name ?? 'In Progress';
    const slug = toSlug(title);

    process.stdout.write(`  ${title}...`);

    const coverFiles = page.properties['Cover Image']?.files ?? [];
    let cover = null;
    if (coverFiles.length > 0) {
      const cf = coverFiles[0];
      const url = cf.external?.url ?? cf.file?.url ?? null;
      if (url) {
        const ext = extFromUrl(url);
        cover = await localiseImage(url, slug, `cover.${ext}`);
      }
    }

    pieces.push({ id: page.id, slug, title, status, cover });
    process.stdout.write(' done\n');
  }

  cursor = res.has_more ? res.next_cursor : undefined;
} while (cursor);

writeFileSync(OUT, JSON.stringify({ pieces }, null, 2));
console.log(`\nWrote ${pieces.length} piece(s) to src/data/artchel.json`);
console.log('Images saved to public/images/artchel/<slug>/');
