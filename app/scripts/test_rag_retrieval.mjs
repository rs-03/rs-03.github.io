/**
 * Retrieval evaluation for the Ask My Portfolio index.
 *
 * Labeled queries -> expects one of the listed chunk-id prefixes in the
 * top 3 results. Also probes off-topic queries to calibrate the
 * no-match threshold. Run from app/:
 *
 *   node scripts/test_rag_retrieval.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pipeline } from '@huggingface/transformers';

const here = dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'ragIndex.json'), 'utf8'));

/* Same decode path the browser uses */
function decodeVector(b64, dim) {
    const bytes = Buffer.from(b64, 'base64');
    const int8 = new Int8Array(bytes.buffer, bytes.byteOffset, dim);
    const v = new Float64Array(dim);
    let norm = 0;
    for (let i = 0; i < dim; i++) {
        v[i] = int8[i] / 127;
        norm += v[i] * v[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) v[i] /= norm;
    return v;
}

const chunkVectors = index.chunks.map(c => decodeVector(c.v, index.dim));

const embed = await pipeline('feature-extraction', index.model, { dtype: 'q8' });

async function search(query) {
    const output = await embed(query, { pooling: 'mean', normalize: true });
    const q = output.data;
    const scored = index.chunks.map((chunk, i) => {
        let dot = 0;
        for (let j = 0; j < index.dim; j++) dot += q[j] * chunkVectors[i][j];
        return { id: chunk.id, title: chunk.title, score: dot };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
}

/* ---------- labeled on-topic queries ---------- */

const CASES = [
    // utility / CV
    ['What has Rahul built for utility companies?', ['project:double-woods', 'project:keypoint', 'project:promptable', 'project:pole-height']],
    ['Tell me about the double wood pole detection project', ['project:double-woods']],
    ['Has he worked with power grid infrastructure imagery?', ['project:double-woods', 'project:keypoint', 'project:pole-height', 'project:promptable']],
    ['electric pole inspection with computer vision', ['project:double-woods', 'project:pole-height', 'project:keypoint']],
    ['NESC clearance compliance analysis', ['project:pole-height', 'project:keypoint']],
    ['fine tuning transformers for keypoint extraction', ['project:keypoint']],
    ['segment objects in images by describing them in words', ['project:promptable', 'project:aletheia']],
    // healthcare / pharma
    ['What did he do for the pharmacy chain?', ['project:healthcare']],
    ['Did any project save the client money?', ['project:healthcare', 'about:stats']],
    ['reshipment cost reduction analytics', ['project:healthcare']],
    ['phantom limb pain therapy', ['project:phantom-limb', 'article:02']],
    ['cough monitoring for illness detection', ['project:cough-monitor', 'article:01']],
    // LLM / agents / RAG
    ['Has Rahul built RAG systems?', ['project:agentic-rag', 'service:AI Agents']],
    ['agent that queries multiple databases with natural language', ['project:agentic-rag']],
    ['LLM evaluation frameworks and scoring', ['project:workflow-builder', 'project:agentic-rag', 'about:skills']],
    ['drag and drop workflow automation tool', ['project:workflow-builder']],
    ['extract data from invoices and financial documents', ['project:document-intelligence']],
    ['no code machine learning platform', ['project:no-code-ml']],
    // demos
    ['Can I try a live demo?', ['project:digit-recognition', 'project:hand-keypoint', 'project:camouflage', 'project:cough-monitor', 'project:phantom-limb']],
    ['neural network trained from scratch without frameworks', ['project:digit-recognition', 'article:04']],
    ['hand tracking in the browser', ['project:hand-keypoint', 'article:05', 'project:phantom-limb']],
    ['test camouflage against AI detection', ['project:camouflage', 'article:03']],
    ['int8 quantization for small models', ['article:04', 'project:digit-recognition']],
    ['image annotation labeling tool', ['project:reticle', 'article:06']],
    ['open source projects he has published', ['project:reticle', 'article:06']],
    ['3D models from photos using segmentation', ['project:aletheia']],
    ['classify exercises from workout videos', ['project:exercise']],
    ['map digitization for urban planning', ['project:map-digitization']],
    ['bee pollination tracking', ['project:bee-waggle']],
    ['baby cry classification', ['project:baby-cry']],
    // audio / DSP
    ['audio signal processing with FFT and MFCC', ['article:01', 'project:cough-monitor']],
    // about / services / process
    ['How many years of experience does Rahul have?', ['about:stats', 'about:bio']],
    ['Is he available for freelance work right now?', ['about:bio', 'service:AI Feasibility']],
    ['What services does he offer?', ['service:', 'process:']],
    ['How does an engagement with him work?', ['process:', 'service:']],
    ['What is a feasibility sprint?', ['service:AI Feasibility']],
    ['Which cloud platforms does he know?', ['about:skills:Cloud', 'service:Full-Stack']],
    ['What Python frameworks does he use?', ['about:skills']],
    ['How do I contact Rahul?', ['about:bio']],
    ['Where is he located?', ['about:bio']],
];

/* ---------- off-topic probes (should score LOW) ---------- */

const OFF_TOPIC = [
    'What is the capital of France?',
    'best pizza recipe with homemade dough',
    'latest football world cup results',
    'how do I fix my car brakes',
    'stock market forecast for next week',
];

/* ---------- run ---------- */

let hits = 0;
let mrrSum = 0;
const failures = [];
const onTopicTopScores = [];

for (const [query, expectedPrefixes] of CASES) {
    const results = await search(query);
    onTopicTopScores.push(results[0].score);
    const top3 = results.slice(0, 3);
    const rank = results.findIndex(r => expectedPrefixes.some(p => r.id.startsWith(p)));
    if (top3.some(r => expectedPrefixes.some(p => r.id.startsWith(p)))) {
        hits++;
    } else {
        failures.push({ query, got: top3.map(r => `${r.id} (${r.score.toFixed(2)})`) });
    }
    mrrSum += rank >= 0 ? 1 / (rank + 1) : 0;
}

const offTopicScores = [];
for (const query of OFF_TOPIC) {
    const results = await search(query);
    offTopicScores.push(results[0].score);
}

console.log(`recall@3: ${hits}/${CASES.length} = ${((hits / CASES.length) * 100).toFixed(1)}%`);
console.log(`MRR: ${(mrrSum / CASES.length).toFixed(3)}`);
console.log(`on-topic top-1 scores:  min ${Math.min(...onTopicTopScores).toFixed(3)}  median ${onTopicTopScores.sort((a, b) => a - b)[Math.floor(onTopicTopScores.length / 2)].toFixed(3)}`);
console.log(`off-topic top-1 scores: max ${Math.max(...offTopicScores).toFixed(3)}  (${offTopicScores.map(s => s.toFixed(2)).join(', ')})`);

// Emit the measured results so the demo can show real, current numbers.
const sortedOn = [...onTopicTopScores].sort((a, b) => a - b);
writeFileSync(join(here, '..', 'src', 'data', 'ragEval.json'), JSON.stringify({
    numQueries: CASES.length,
    recallAt3: Number((hits / CASES.length).toFixed(4)),
    mrr: Number((mrrSum / CASES.length).toFixed(4)),
    onTopicMin: Number(Math.min(...onTopicTopScores).toFixed(3)),
    onTopicMedian: Number(sortedOn[Math.floor(sortedOn.length / 2)].toFixed(3)),
    offTopicMax: Number(Math.max(...offTopicScores).toFixed(3)),
    gate: 0.20,
    model: index.model,
}, null, 2) + '\n');
console.log('wrote src/data/ragEval.json');

if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures) {
        console.log(`  "${f.query}"`);
        console.log(`     got: ${f.got.join(' | ')}`);
    }
}

process.exit(failures.length > CASES.length * 0.1 ? 1 : 0);
