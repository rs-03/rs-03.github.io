/**
 * Builds the retrieval index for the Ask My Portfolio demo.
 *
 * Chunks all site content (projects, articles, bio, services, process),
 * embeds each chunk with the same MiniLM model the browser uses,
 * int8-quantizes the vectors, and computes a 3D PCA projection for the
 * embedding-space visualization.
 *
 * Run from app/:  node scripts/build_rag_index.mjs
 * Output:         src/data/ragIndex.json
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pipeline } from '@huggingface/transformers';

import { getAllProjects } from '../src/data/projects/index.js';
import { getSectorById } from '../src/data/sectors.js';
import { siteConfig } from '../src/data/siteConfig.js';
import { services } from '../src/data/services.js';
import { processSteps } from '../src/data/process.js';

const here = dirname(fileURLToPath(import.meta.url));
const articlesDir = join(here, '..', '..', 'articles');
const outPath = join(here, '..', 'src', 'data', 'ragIndex.json');

const MODEL = 'Xenova/all-MiniLM-L6-v2';

/* ---------- chunking ---------- */

const chunks = [];

function addChunk(id, kind, title, url, parts) {
    const text = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (text.length < 40) return;
    chunks.push({ id, kind, title, url, text: text.slice(0, 1100) });
}

// Projects: an overview chunk, plus a details chunk for full case studies
for (const project of getAllProjects()) {
    const url = `/projects/${project.slug}`;
    const sector = getSectorById(project.sector);
    addChunk(`project:${project.slug}`, 'project', project.title, url, [
        `${project.title}, a project Rahul Sangamker built.`,
        sector ? `Sector: ${sector.name}.` : '',
        project.role ? `Role: ${project.role}.` : '',
        project.shortDescription,
        project.fullDescription,
        project.clientType ? `Client: ${project.clientType}.` : '',
        project.impactMetric ? `Impact: ${project.impactMetric}.` : '',
        `Technologies: ${project.techStack.join(', ')}.`,
    ]);
    if (project.approach?.length || project.outcomes?.length) {
        addChunk(`project:${project.slug}:details`, 'project', project.title, url, [
            project.title + ', how it was built:',
            ...(project.approach || []),
            ...(project.outcomes || []).map(o => `${o.value}: ${o.label}.`),
            ...(project.highlights || []),
        ]);
    }
}

// Articles: intro + one chunk per section
const publishedUrls = JSON.parse(readFileSync(join(articlesDir, '.published.json'), 'utf8'));
for (const file of readdirSync(articlesDir).filter(f => f.endsWith('.md') && f !== 'README.md')) {
    const raw = readFileSync(join(articlesDir, file), 'utf8');
    const url = publishedUrls[file] || siteConfig.siteUrl;
    const cleaned = raw
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*_`#>]/g, m => (m === '#' ? '#' : ''));
    const title = cleaned.match(/^#\s+(.+)$/m)?.[1]?.trim() || file;
    const sections = cleaned.replace(/^#\s+.+$/m, '').split(/\n##\s+/);
    sections.forEach((section, i) => {
        const lines = section.split('\n');
        const heading = i === 0 ? 'Introduction' : lines.shift().trim();
        addChunk(`article:${file}:${i}`, 'article', title, url, [
            `From the article "${title}", section "${heading}":`,
            lines.join(' '),
        ]);
    });
}

// About, stats, skills
addChunk('about:bio', 'about', 'About Rahul Sangamker', '/', [
    `${siteConfig.name}, ${siteConfig.title}, based in ${siteConfig.location}.`,
    siteConfig.bio,
    `Contact: ${siteConfig.email}.`,
    siteConfig.availability?.available ? 'Currently open to new projects and taking on engagements.' : '',
]);
addChunk('about:stats', 'about', 'Experience at a glance', '/', [
    'Experience and track record:',
    ...siteConfig.stats.map(s => `${s.value} ${s.label}.`),
]);
for (const group of siteConfig.skills) {
    addChunk(`about:skills:${group.category}`, 'about', `Skills: ${group.category}`, '/', [
        `Skills and technologies in ${group.category}:`,
        group.items.join(', ') + '.',
    ]);
}

// Services and process
for (const service of services) {
    addChunk(`service:${service.title}`, 'service', service.title, '/#services', [
        `Service offering: ${service.title}.`,
        service.description,
        `Includes: ${service.tags.join(', ')}.`,
    ]);
}
addChunk('process:how-i-work', 'process', 'How I Work', '/', [
    'Engagement process, how working together goes:',
    ...processSteps.map(s => `${s.title}: ${s.description}`),
]);

console.log(`chunks: ${chunks.length}`);

/* ---------- embedding ---------- */

const embed = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });

const vectors = [];
for (const chunk of chunks) {
    const output = await embed(chunk.text, { pooling: 'mean', normalize: true });
    vectors.push(Float64Array.from(output.data));
}
const dim = vectors[0].length;
console.log(`embedded ${vectors.length} chunks, dim ${dim}`);

/* ---------- PCA to 3D (power iteration with deflation) ---------- */

let seed = 42;
const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
};

const n = vectors.length;
const mean = new Float64Array(dim);
for (const v of vectors) for (let i = 0; i < dim; i++) mean[i] += v[i] / n;
const centered = vectors.map(v => {
    const c = new Float64Array(dim);
    for (let i = 0; i < dim; i++) c[i] = v[i] - mean[i];
    return c;
});

const components = [];
for (let comp = 0; comp < 3; comp++) {
    let v = Float64Array.from({ length: dim }, () => rand() - 0.5);
    for (let iter = 0; iter < 80; iter++) {
        const next = new Float64Array(dim);
        for (const row of centered) {
            let dot = 0;
            for (let i = 0; i < dim; i++) dot += row[i] * v[i];
            for (let i = 0; i < dim; i++) next[i] += dot * row[i];
        }
        for (const prev of components) {
            let dot = 0;
            for (let i = 0; i < dim; i++) dot += next[i] * prev[i];
            for (let i = 0; i < dim; i++) next[i] -= dot * prev[i];
        }
        let norm = 0;
        for (let i = 0; i < dim; i++) norm += next[i] * next[i];
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < dim; i++) next[i] /= norm;
        v = next;
    }
    components.push(v);
}

const project3d = v => components.map(c => {
    let dot = 0;
    for (let i = 0; i < dim; i++) dot += (v[i] - mean[i]) * c[i];
    return dot;
});

/* ---------- quantize + emit ---------- */

const round = (x, p) => Math.round(x * 10 ** p) / 10 ** p;

const outChunks = chunks.map((chunk, idx) => {
    const int8 = new Int8Array(dim);
    for (let i = 0; i < dim; i++) {
        int8[i] = Math.max(-127, Math.min(127, Math.round(vectors[idx][i] * 127)));
    }
    const [x, y, z] = project3d(vectors[idx]);
    return {
        ...chunk,
        v: Buffer.from(int8.buffer).toString('base64'),
        x: round(x, 4),
        y: round(y, 4),
        z: round(z, 4),
    };
});

const index = {
    model: MODEL,
    dim,
    builtFrom: { projects: getAllProjects().length, chunks: chunks.length },
    pca: {
        mean: Array.from(mean, m => round(m, 5)),
        components: components.map(c => Array.from(c, x => round(x, 5))),
    },
    chunks: outChunks,
};

writeFileSync(outPath, JSON.stringify(index));
const kb = Math.round(JSON.stringify(index).length / 1024);
console.log(`wrote ${outPath} (${kb} KB)`);
