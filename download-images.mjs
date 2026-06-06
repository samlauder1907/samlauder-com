// Image download script for samlauder.com
// Downloads all site images from Webflow CDN and organises them into public/images/
// Run with: node download-images.mjs

import { createWriteStream, mkdirSync, existsSync, renameSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { pipeline } from 'stream/promises';
import https from 'https';
import http from 'http';

const BASE_DIR = './public/images';
const CONCURRENCY = 8;
const TIMEOUT_MS = 30000;

const KNOWN_IMAGES = {
  home: [
    'https://cdn.prod.website-files.com/611daf5470d32f435a624478/6451fe1e19901ee16f9eca68_Metricon_Lumiere_Dinning01_SL.jpg',
    'https://cdn.prod.website-files.com/611daf5470d32f435a624478/629825d57c5db44cfed24e8a_Evergreen_Thumbnail.png',
    'https://cdn.prod.website-files.com/611daf5470d32f435a624478/628dc6ea532a528468f69320_Dinning-INterior.png',
    'https://cdn.prod.website-files.com/611daf5470d32f435a624478/61ade7473bc6f862f3d4e5a3_CollingwoodYards011-Edit.jpeg',
  ],
  portfolio: [
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/64d1c210113d743623b18ead_08-web.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/64d1c210802e32f615554dab_15-web.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/64d1c20f798499b7a13d2334_09-web.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/649d21ef00ff8ab79de7bf52_06-Web.png',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/649d21bdf5c7aa41f5af74c1_07-Web.png',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/649d218aba75cbd927f8c8c7_01-web.png',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/646c08abd8053589d6c2365e_exhibition-3.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/646c089eed0197176c8c7221_exhibition-2.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/646c08891af967cdce23f35c_exhibition-1.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61b014a06477d1c2bf223cee_CollingwoodYards036-Edit.jpeg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61ade62f030213086162da64_CollingwoodYards011-Edit.jpeg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61ade683d574c4fa17b4ed10_CollingwoodYards072-Edit.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/6387e5e68564603084ff6030_Bed01Chair_Vert.png',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/6387e5e01a4fa5ef04134c6f_Dining02.png',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/6387e5d65e5c125683b9a78d_MBath_Vert.png',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/62735529d5f07a1eb39b6ce1_Front1.png',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/627354ba1ae83754b68580a6_Detail.png',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/627354ba209cb0ccbcf04178_Back1.png',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/633f75505fec244f6929c83a_UCBWeb-8.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/633f752da0e0b90339665298_UCBWeb-3.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/62a948005b7ae883f8d269b4_Bouldering03_UC_Blackburn_SL_202206.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/645b27cad2b6d1b0fea0989e_KitchenHoirz.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/645b27affd36583328bee5c0_HeroAgain.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61272edd46bf871ee0d6911c_China-2.jpg',
  ],
  about: [
    'https://cdn.prod.website-files.com/611daf5470d32f435a624478/649d221aba75cbd927f97637_Sam.jpg',
  ],
  grievance: [
    'https://cdn.prod.website-files.com/611daf5470d32f435a624478/6844f8d48914891479811220_IMG_4939.jpeg',
    'https://cdn.prod.website-files.com/611daf5470d32f435a624478/6844f8d2f462de4b269b00bc_IMG_0752.jpeg',
    'https://cdn.prod.website-files.com/611daf5470d32f435a624478/6844f8d2224d04a9f08db126_SAM00089.JPG',
  ],
};

const KNOWN_PROJECT_IMAGES = {
  'urban-climb-adelaide': [
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3df224ab723da30e2e_UrbanClimb_Adelaide_01.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3d053f7ed2c686d290_UrbanClimb_Adelaide_02.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3d3646873b95dd1e12_UrbanClimb_Adelaide_03.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3dd0f8bd0ef88f4531_UrbanClimb_Adelaide_04.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3d731b410e31f1994c_UrbanClimb_Adelaide_05.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3d731b410e31f1995f_UrbanClimb_Adelaide_06.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3dab7457ccdda89b46_UrbanClimb_Adelaide_07.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3d136b5a00062be771_UrbanClimb_Adelaide_08.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3d26c4e96b889e4680_UrbanClimb_Adelaide_09.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3d26c4e96b889e467d_UrbanClimb_Adelaide_10.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3df1bfe712abcf8a9d_UrbanClimb_Adelaide_11.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3ce2d93d70715e1864_UrbanClimb_Adelaide_12.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3cc9fc5852c4148dab_UrbanClimb_Adelaide_13.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3cba11c1899828bd2f_UrbanClimb_Adelaide_14.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3c6317a16eacc23d6a_UrbanClimb_Adelaide_15.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3cbf272bf0f269c24d_UrbanClimb_Adelaide_16.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3ca27df5fae4663f34_UrbanClimb_Adelaide_17.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3c245fa9cf03fab7ab_UrbanClimb_Adelaide_18.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3c45f17fbf2fb8a668_UrbanClimb_Adelaide_19.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3cf1f8c8d619f16288_UrbanClimb_Adelaide_20.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/67440e3cba11c1899828bd0d_UrbanClimb_Adelaide_21.jpg',
  ],
  'collingwood-yards': [
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61ade62f030213086162da64_CollingwoodYards011-Edit.jpeg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61b014a06477d1c2bf223cee_CollingwoodYards036-Edit.jpeg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61ade6bb8d69c663040978f6_CollingwoodYards057-1.jpeg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61ade66b1327028255695937_CollingwoodYards066-Edit-1.jpeg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61ade683d574c4fa17b4ed10_CollingwoodYards072-Edit.jpg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61b014a0bff90858fe0d467e_CollingwoodYards081-Edit.jpeg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61b014a02b1a50258ec71cd7_CollingwoodYards100.jpeg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61b0149f8f78c4766c91f099_CollingwoodYards101-Edit.jpeg',
    'https://cdn.prod.website-files.com/6125ac764807385acd05e769/61b0149f7e4a65ec61fdbea8_SAM07220-1.jpeg',
  ],
};

const PROJECTS_TO_SCRAPE = [
  { slug: 'doreen-house', url: 'https://www.samlauder.com/projects/doreen-house' },
  { slug: 'nunawading-community-hub', url: 'https://www.samlauder.com/projects/nunawading-community-hub' },
  { slug: 'canva-melbourne', url: 'https://www.samlauder.com/projects/canva-melbourne' },
  { slug: 'collins-arch', url: 'https://www.samlauder.com/projects/collins-arch' },
  { slug: 'panorama-apartment', url: 'https://www.samlauder.com/projects/panorama-apartment' },
  { slug: 'monash-health-dandenong-kiosk', url: 'https://www.samlauder.com/projects/monash-health-dandenon-kiosk' },
  { slug: 'teren-group-office', url: 'https://www.samlauder.com/projects/teren-group-office' },
  { slug: 'metricon-lumiere', url: 'https://www.samlauder.com/projects/metricon-lumiere' },
  { slug: 'lune-fitzroy', url: 'https://www.samlauder.com/projects/lune-fitzroy' },
  { slug: 'urban-climb-blackburn', url: 'https://www.samlauder.com/projects/urban-climb-blackburn' },
  { slug: 'evergreen-apartments', url: 'https://www.samlauder.com/projects/evergreen-apartments' },
  { slug: 'deakin-law-building', url: 'https://www.samlauder.com/projects/deakin-law-building' },
  { slug: 'rodda-lane', url: 'https://www.samlauder.com/projects/rodda-lane' },
  { slug: 'north-fitzroy-library', url: 'https://www.samlauder.com/projects/north-fitzroy-library' },
];

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function urlToFilename(url) {
  const parts = new URL(url).pathname.split('/');
  return decodeURIComponent(parts[parts.length - 1]);
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; samlauder-scraper/1.0)' },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function downloadOne(url, destPath) {
  return new Promise((resolve, reject) => {
    if (existsSync(destPath)) {
      process.stdout.write(`  skip: ${basename(destPath)}\n`);
      return resolve({ skipped: true });
    }
    const tmpPath = destPath + '.tmp';
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; samlauder-scraper/1.0)' },
    }, async (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        try {
          const result = await downloadOne(res.headers.location, destPath);
          return resolve(result);
        } catch (e) { return reject(e); }
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      const ws = createWriteStream(tmpPath);
      try {
        await pipeline(res, ws);
        renameSync(tmpPath, destPath);
        process.stdout.write(`  ok: ${basename(destPath)}\n`);
        resolve({ skipped: false });
      } catch (e) {
        try { unlinkSync(tmpPath); } catch {}
        reject(e);
      }
    });
    req.on('error', (e) => { try { unlinkSync(tmpPath); } catch {} reject(e); });
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

async function runPool(tasks, concurrency) {
  const errors = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const task = tasks[i++];
      try { await task(); } catch (e) { errors.push(e.message); process.stdout.write(`  ERROR: ${e.message}\n`); }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return errors;
}

async function downloadBatch(label, urls, folder) {
  ensureDir(folder);
  console.log(`\n${label} (${urls.length} images, ${CONCURRENCY} concurrent)...`);
  const tasks = urls.map(url => () => downloadOne(url, join(folder, urlToFilename(url))));
  return runPool(tasks, CONCURRENCY);
}

async function scrapeProjectImages(slug, url) {
  process.stdout.write(`Scraping ${slug}... `);
  try {
    const { status, body } = await fetchHtml(url);
    if (status !== 200) { console.log(`HTTP ${status}`); return []; }
    const pattern = /https:\/\/cdn\.prod\.website-files\.com\/[a-f0-9]+\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp|gif)/gi;
    const found = [...new Set(body.match(pattern) || [])].filter(u => {
      const l = u.toLowerCase();
      return !l.includes('logo') && !l.includes('icon') && !l.includes('favicon');
    });
    console.log(`${found.length} images`);
    return found;
  } catch (e) {
    console.log(`Error: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log('=== samlauder.com image downloader (parallel) ===\n');
  const allErrors = [];

  for (const [folder, urls] of Object.entries(KNOWN_IMAGES)) {
    const errs = await downloadBatch(folder, urls, join(BASE_DIR, folder));
    allErrors.push(...errs);
  }

  for (const [slug, urls] of Object.entries(KNOWN_PROJECT_IMAGES)) {
    const errs = await downloadBatch(`projects/${slug}`, urls, join(BASE_DIR, 'projects', slug));
    allErrors.push(...errs);
  }

  console.log('\n--- Scraping remaining project pages ---');
  const scrapedData = {};
  for (const { slug, url } of PROJECTS_TO_SCRAPE) {
    const images = await scrapeProjectImages(slug, url);
    scrapedData[slug] = images;
    if (images.length > 0) {
      const errs = await downloadBatch(`projects/${slug}`, images, join(BASE_DIR, 'projects', slug));
      allErrors.push(...errs);
    }
  }

  const { writeFileSync } = await import('fs');
  writeFileSync('./scraped-project-images.json', JSON.stringify(scrapedData, null, 2));
  console.log('\nScraped URLs written to scraped-project-images.json');

  const total = (await import('fs')).readdirSync;
  console.log('\n=== Done ===');
  if (allErrors.length > 0) {
    console.log(`\n${allErrors.length} error(s):`);
    allErrors.forEach(e => console.log(`  ${e}`));
  } else {
    console.log('No errors.');
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
