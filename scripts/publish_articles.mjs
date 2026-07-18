/**
 * Publishes the drafts in articles/ to dev.to via the Forem API v1.
 *
 * Setup (one time):
 *   1. dev.to → Settings → Extensions → Generate API key
 *   2. Set the key:  $env:DEV_TO_API_KEY = "..."   (PowerShell)
 *
 * Usage:
 *   node scripts/publish_articles.mjs --dry-run     # show payloads, post nothing
 *   node scripts/publish_articles.mjs               # create as DRAFTS on dev.to
 *   node scripts/publish_articles.mjs --publish     # publish live immediately
 *   node scripts/publish_articles.mjs --update      # sync local edits into existing drafts
 *
 * Already-published articles are skipped via .published.json bookkeeping
 * (except in --update mode, which matches drafts by title and PUTs new bodies).
 * After publishing, set each demo component's ARTICLE_URL to the printed URL.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const articlesDir = join(here, '..', 'articles');
const ledgerPath = join(articlesDir, '.published.json');

const DRY_RUN = process.argv.includes('--dry-run');
const PUBLISH_LIVE = process.argv.includes('--publish');
const API_KEY = process.env.DEV_TO_API_KEY;

// Per-article tags (dev.to allows max 4, lowercase alphanumeric)
const TAGS = {
    '01-cough-monitor.md': ['javascript', 'machinelearning', 'webdev', 'audio'],
    '02-mirror-therapy.md': ['computervision', 'webdev', 'healthtech', 'javascript'],
    '03-camouflage.md': ['machinelearning', 'computervision', 'security', 'javascript'],
    '04-digit-recognizer.md': ['machinelearning', 'python', 'javascript', 'neuralnetworks'],
    '05-keypoints.md': ['computervision', 'machinelearning', 'webdev', 'javascript'],
    '06-reticle.md': ['opensource', 'computervision', 'react', 'python'],
    // The notes below are drafted in articles/drafts/ and not published yet. Tags
    // are pre-set so publishing is one step: move the file up to articles/, then run.
    '07-morphogenesis.md': ['javascript', 'webgl', 'simulation', 'science'],
    '08-attention.md': ['machinelearning', 'ai', 'javascript', 'datascience'],
    '09-protein-folding.md': ['javascript', 'algorithms', 'simulation', 'science'],
    '10-sequence-alignment.md': ['algorithms', 'javascript', 'datascience', 'science'],
    '11-hodgkin-huxley.md': ['javascript', 'simulation', 'science', 'datascience'],
    '12-evolution.md': ['javascript', 'simulation', 'science', 'datascience'],
    '13-tokenizer.md': ['machinelearning', 'ai', 'javascript', 'datascience'],
    '14-diffusion.md': ['machinelearning', 'ai', 'javascript', 'datascience'],
};

const CANONICAL_BASE = 'https://rs-03.github.io/demos/';

// Per-article overrides (canonical must be unique per article on dev.to)
const CANONICAL_OVERRIDES = {
    '06-reticle.md': 'https://rs-03.github.io/projects/reticle/',
};
const MAIN_IMAGES = {
    '06-reticle.md': 'https://raw.githubusercontent.com/rs-03/article-assets/main/06-reticle-cover.png',
};

if (!DRY_RUN && !API_KEY) {
    console.error('DEV_TO_API_KEY is not set. Generate one at dev.to → Settings → Extensions.');
    process.exit(1);
}

const UPDATE_MODE = process.argv.includes('--update');

const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};

const files = readdirSync(articlesDir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort();

// In update mode, fetch existing unpublished drafts once and match by title
let myDrafts = [];
if (UPDATE_MODE && !DRY_RUN) {
    const response = await fetch('https://dev.to/api/articles/me/unpublished?per_page=100', {
        headers: { 'api-key': API_KEY, accept: 'application/vnd.forem.api-v1+json' },
    });
    if (!response.ok) {
        console.error(`Could not list drafts — HTTP ${response.status}`);
        process.exit(1);
    }
    myDrafts = await response.json();
}

for (const file of files) {
    if (UPDATE_MODE) {
        const raw = readFileSync(join(articlesDir, file), 'utf8');
        const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
        const body = raw.replace(/^#\s+.+$/m, '').trim();
        const draft = myDrafts.find(d => d.title === title);
        if (!draft) {
            console.log(`SKIP  ${file} — no matching draft titled "${title}" (already published?)`);
            continue;
        }
        const put = await fetch(`https://dev.to/api/articles/${draft.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'api-key': API_KEY,
                accept: 'application/vnd.forem.api-v1+json',
            },
            body: JSON.stringify({ article: { body_markdown: body } }),
        });
        console.log(put.ok
            ? `SYNC  ${file} → draft #${draft.id} updated`
            : `FAIL  ${file} — HTTP ${put.status}: ${await put.text()}`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
    }

    if (ledger[file]) {
        console.log(`SKIP  ${file} — already published: ${ledger[file]}`);
        continue;
    }

    const raw = readFileSync(join(articlesDir, file), 'utf8');
    const titleMatch = raw.match(/^#\s+(.+)$/m);
    if (!titleMatch) {
        console.error(`SKIP  ${file} — no H1 title found`);
        continue;
    }
    const title = titleMatch[1].trim();
    const body = raw.replace(/^#\s+.+$/m, '').trim();

    const payload = {
        article: {
            title,
            body_markdown: body,
            published: PUBLISH_LIVE,
            tags: TAGS[file] || ['machinelearning', 'webdev'],
            canonical_url: CANONICAL_OVERRIDES[file] || CANONICAL_BASE,
            ...(MAIN_IMAGES[file] ? { main_image: MAIN_IMAGES[file] } : {}),
        },
    };

    if (DRY_RUN) {
        console.log(`DRY   ${file} → "${title}" tags=[${payload.article.tags}] published=${PUBLISH_LIVE}`);
        continue;
    }

    const response = await fetch('https://dev.to/api/articles', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': API_KEY,
            accept: 'application/vnd.forem.api-v1+json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        console.error(`FAIL  ${file} — HTTP ${response.status}: ${await response.text()}`);
        continue;
    }

    const result = await response.json();
    ledger[file] = result.url;
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
    console.log(`OK    ${file} → ${result.url}${PUBLISH_LIVE ? '' : ' (draft — publish from dev.to dashboard)'}`);

    // dev.to rate limit: be polite between posts
    await new Promise(resolve => setTimeout(resolve, 1500));
}

console.log('\nDone. Set each demo component\'s ARTICLE_URL to its printed URL to surface the site links.');
