'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { buildSearcher, projectTo3d, NO_MATCH_THRESHOLD } from './searchCore';
import EmbeddingCloud from './EmbeddingCloud';
import ragEval from '@/data/ragEval.json';
import styles from './AskPortfolio.module.css';

const SUGGESTIONS = [
    'What has he built for utilities?',
    'Has he built RAG systems?',
    'Which demos can I try?',
    'What does a feasibility sprint include?',
    'How do I contact him?',
];

const KIND_LABELS = {
    project: 'Project',
    article: 'Article',
    about: 'About',
    service: 'Service',
    process: 'Process',
};

// Small instruct model for the optional on-device generation tier. Apache 2.0.
// q4 is ~350 MB, downloaded once and cached; runs on WebGPU where available,
// otherwise WebAssembly on the CPU.
const GEN_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';

/**
 * Ask My Portfolio: glass-box semantic search over everything on this
 * site. The embedding model runs in the visitor's browser; retrieval,
 * scores, and the embedding space itself are all visible.
 */
export default function AskPortfolio() {
    const engineRef = useRef(null); // { embed, searcher, index }
    const [modelStatus, setModelStatus] = useState('idle'); // idle | loading | ready | error
    const [progress, setProgress] = useState(0);
    const [busy, setBusy] = useState(false);
    const [question, setQuestion] = useState('');
    const [asked, setAsked] = useState('');
    const [results, setResults] = useState(null);
    const [stages, setStages] = useState(null);
    const [queryPoint, setQueryPoint] = useState(null);
    const [indexData, setIndexData] = useState(null);

    // Optional on-device generation tier (the "G" in RAG)
    const genRef = useRef(null); // { pipe, TextStreamer, backend }
    const [genStatus, setGenStatus] = useState('idle'); // idle | loading | ready | generating | error
    const [genProgress, setGenProgress] = useState(0);
    const [answer, setAnswer] = useState('');
    const [genMeta, setGenMeta] = useState(null); // { backend, tokens, ms }

    async function ensureEngine() {
        if (engineRef.current) return engineRef.current;
        setModelStatus('loading');
        try {
            const [{ default: index }, transformers] = await Promise.all([
                import('@/data/ragIndex.json'),
                import('@huggingface/transformers'),
            ]);
            const embed = await transformers.pipeline('feature-extraction', index.model, {
                dtype: 'q8',
                progress_callback: info => {
                    if (info.status === 'progress' && info.file?.endsWith('.onnx')) {
                        setProgress(Math.round(info.progress || 0));
                    }
                },
            });
            const engine = { embed, searcher: buildSearcher(index), index };
            engineRef.current = engine;
            setIndexData(index);
            setModelStatus('ready');
            return engine;
        } catch {
            setModelStatus('error');
            return null;
        }
    }

    async function ask(text) {
        const trimmed = text.trim();
        if (!trimmed || busy) return;
        setBusy(true);
        setAsked(trimmed);
        setResults(null);
        setAnswer('');
        setGenMeta(null);

        const engine = await ensureEngine();
        if (!engine) {
            setBusy(false);
            return;
        }

        const t0 = performance.now();
        const output = await engine.embed(trimmed, { pooling: 'mean', normalize: true });
        const queryVector = output.data;
        const t1 = performance.now();
        const top = engine.searcher.search(queryVector, 4);
        const t2 = performance.now();

        setStages({
            embedMs: Math.max(1, Math.round(t1 - t0)),
            searchMs: Math.max(1, Math.round(t2 - t1)),
            chunkCount: engine.index.chunks.length,
            topScore: top[0]?.score ?? 0,
        });
        setResults(top);
        setQueryPoint(projectTo3d(queryVector, engine.index.pca));
        setBusy(false);
    }

    // Load the small instruct model once. Prefer WebGPU; fall back to WASM so it
    // still runs where WebGPU is unavailable.
    async function ensureGenerator() {
        if (genRef.current) return genRef.current;
        setGenStatus('loading');
        setGenProgress(0);
        try {
            const transformers = await import('@huggingface/transformers');
            // Only attempt WebGPU if an adapter actually exists, so we do not
            // download the GPU weights just to fall back to WASM.
            const hasGPU = await (async () => {
                try {
                    if (typeof navigator === 'undefined' || !navigator.gpu) return false;
                    return !!(await navigator.gpu.requestAdapter());
                } catch {
                    return false;
                }
            })();
            // q4 (not q4f16) on both backends: numerically robust for grounded
            // output. q4f16 on some GPU backends degenerates into repetition.
            const attempts = hasGPU
                ? [{ device: 'webgpu', dtype: 'q4' }, { device: 'wasm', dtype: 'q4' }]
                : [{ device: 'wasm', dtype: 'q4' }];
            let lastErr = null;
            for (const opt of attempts) {
                try {
                    const pipe = await transformers.pipeline('text-generation', GEN_MODEL, {
                        ...opt,
                        progress_callback: info => {
                            if (info.status === 'progress' && /\.onnx/.test(info.file || '')) {
                                setGenProgress(Math.round(info.progress || 0));
                            }
                        },
                    });
                    const gen = { pipe, TextStreamer: transformers.TextStreamer, backend: opt.device };
                    genRef.current = gen;
                    setGenStatus('ready');
                    return gen;
                } catch (e) {
                    lastErr = e;
                }
            }
            throw lastErr;
        } catch {
            setGenStatus('error');
            return null;
        }
    }

    // Grounded generation: feed only the retrieved passages, ask for citations,
    // stream the answer token by token.
    async function generate() {
        const top = results;
        if (!top || (top[0]?.score ?? 0) < NO_MATCH_THRESHOLD) return;
        if (genStatus === 'loading' || genStatus === 'generating') return;
        const ps = top.filter(r => r.score >= NO_MATCH_THRESHOLD).slice(0, 3);

        setAnswer('');
        setGenMeta(null);
        const gen = await ensureGenerator();
        if (!gen) return;
        setGenStatus('generating');

        const context = ps.map((p, i) => `[${i + 1}] ${p.chunk.title}: ${p.chunk.text}`).join('\n\n');
        const system = 'You answer questions about Rahul Sangamker using ONLY the numbered context provided. Cite the sources you use inline like [1] or [2]. If the answer is not in the context, say you do not have that information. Be concise, at most three sentences, and never invent facts.';
        const user = `Context:\n${context}\n\nQuestion: ${asked}`;

        let tokens = 0;
        const t0 = performance.now();
        const streamer = new gen.TextStreamer(gen.pipe.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: text => { tokens += 1; setAnswer(a => a + text); },
        });
        try {
            await gen.pipe(
                [{ role: 'system', content: system }, { role: 'user', content: user }],
                // greedy keeps the answer faithful to the sources; the n-gram guard
                // is cheap insurance against a repetition loop on odd backends
                { max_new_tokens: 160, do_sample: false, no_repeat_ngram_size: 4, streamer },
            );
            const ms = Math.round(performance.now() - t0);
            setGenMeta({ backend: gen.backend, tokens, ms });
            setGenStatus('ready');
        } catch {
            setGenStatus('error');
        }
    }

    function onSubmit(e) {
        e.preventDefault();
        ask(question);
    }

    const answerable = results && results[0]?.score >= NO_MATCH_THRESHOLD;
    const passages = answerable
        ? results.filter(r => r.score >= NO_MATCH_THRESHOLD).slice(0, 3)
        : [];
    const neighborIds = new Set(passages.map(p => p.chunk.id));

    return (
        <section className={`section ${styles.ask}`} id="ask">
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Live Demo · Glass-Box RAG</span>
                    <h2 className="section-header__title">Ask My Portfolio Anything</h2>
                    <p className="section-header__description">
                        Type a question. An embedding model loads into your browser, reads it, and
                        searches everything on this site semantically. Then, if you want, a small
                        language model runs on your device and writes a grounded answer from the
                        sources it found. Every step is visible, and nothing leaves this page.
                    </p>
                </div>

                <div className={styles.lab}>
                    {/* Ask panel */}
                    <div className={styles.panel}>
                        <form onSubmit={onSubmit} className={styles.form}>
                            <input
                                type="text"
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                                placeholder="Ask about the projects, demos, or services..."
                                className={styles.input}
                                aria-label="Ask a question about this portfolio"
                            />
                            <button type="submit" className="btn btn--primary" disabled={busy}>
                                {busy ? 'Thinking...' : 'Ask'}
                            </button>
                        </form>

                        <div className={styles.chips}>
                            {SUGGESTIONS.map(suggestion => (
                                <button
                                    key={suggestion}
                                    className={styles.chip}
                                    disabled={busy}
                                    onClick={() => {
                                        setQuestion(suggestion);
                                        ask(suggestion);
                                    }}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>

                        {/* Glass-box stage readout */}
                        {modelStatus === 'loading' && (
                            <p className={styles.stageNote}>
                                Loading the embedding model into your browser ({progress}%).
                                One-time download of about 25 MB; cached after that.
                            </p>
                        )}
                        {modelStatus === 'error' && (
                            <p className={styles.error}>
                                The model could not load. Check your connection and try again.
                            </p>
                        )}
                        {stages && (
                            <div className={styles.stageRow}>
                                <span className={styles.stage}>embedded in <b>{stages.embedMs} ms</b></span>
                                <span className={styles.stage}>searched <b>{stages.chunkCount} chunks</b> in <b>{stages.searchMs} ms</b></span>
                                <span className={styles.stage}>top score <b>{stages.topScore.toFixed(2)}</b></span>
                            </div>
                        )}

                        {/* Generation tier: an on-device LLM answers from the retrieved sources */}
                        {answerable && (
                            <div className={styles.genBlock}>
                                {!answer && genStatus !== 'loading' && genStatus !== 'generating' && (
                                    <div className={styles.genPrompt}>
                                        {genStatus === 'error' && (
                                            <p className={styles.error}>
                                                The model could not run here, but the sources below are still exact.
                                            </p>
                                        )}
                                        <button className={styles.genButton} onClick={generate}>
                                            {genStatus === 'ready' ? 'Generate another answer' : 'Generate a grounded answer'}
                                        </button>
                                        {genStatus === 'idle' && (
                                            <p className={styles.genNote}>
                                                Runs a 0.5B-parameter language model on your device, one download of
                                                about 350 MB, then cached. No server, no API key. It answers only
                                                from the sources below.
                                            </p>
                                        )}
                                    </div>
                                )}
                                {genStatus === 'loading' && (
                                    <p className={styles.stageNote}>
                                        Loading the language model into your browser ({genProgress}%).
                                        One-time download, about 350 MB.
                                    </p>
                                )}
                                {(answer || genStatus === 'generating') && (
                                    <div className={styles.answerCard}>
                                        <div className={styles.answerHead}>
                                            <span className={styles.answerBadge}>On-device answer</span>
                                            {genStatus === 'generating' && <span className={styles.answerTyping}>generating…</span>}
                                        </div>
                                        <p className={styles.answerText}>
                                            {answer}
                                            {genStatus === 'generating' && <span className={styles.caret} aria-hidden="true" />}
                                        </p>
                                        {genMeta && (
                                            <p className={styles.answerMeta}>
                                                {genMeta.tokens} tokens · {(genMeta.tokens / Math.max(genMeta.ms / 1000, 0.1)).toFixed(1)} tok/s · {genMeta.backend === 'webgpu' ? 'WebGPU' : 'WebAssembly (CPU)'} · grounded in {passages.length} {passages.length === 1 ? 'source' : 'sources'}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Results */}
                        {results && !answerable && (
                            <div className={styles.noMatch}>
                                Nothing in the portfolio matches &quot;{asked}&quot; closely
                                (top score {results[0].score.toFixed(2)}, below the 0.20 gate).
                                Try asking about the projects, live demos, services, or background.
                            </div>
                        )}
                        {passages.length > 0 && (
                            <div className={styles.results}>
                                <span className={styles.sourcesLabel}>{answer || genStatus === 'generating' ? 'Sources' : 'Top matches'}</span>
                                {passages.map(({ chunk, score }) => (
                                    <div key={chunk.id} className={styles.result}>
                                        <div className={styles.resultHeader}>
                                            <span className={styles.kind}>{KIND_LABELS[chunk.kind]}</span>
                                            <span className={styles.resultTitle}>{chunk.title}</span>
                                            <span className={styles.score} title="Cosine similarity">
                                                {score.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className={styles.scoreTrack}>
                                            <div className={styles.scoreFill} style={{ width: `${Math.min(score, 1) * 100}%` }} />
                                        </div>
                                        <p className={styles.passage}>{chunk.text}</p>
                                        {chunk.url.startsWith('/') ? (
                                            <Link href={chunk.url} className={styles.sourceLink}>
                                                View source →
                                            </Link>
                                        ) : (
                                            <a href={chunk.url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                                                Read the article →
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Embedding space */}
                    <div className={styles.cloudPanel}>
                        <span className={styles.panelLabel}>The Embedding Space</span>
                        {indexData ? (
                            <EmbeddingCloud
                                chunks={indexData.chunks}
                                queryPoint={queryPoint}
                                neighborIds={neighborIds}
                            />
                        ) : (
                            <div className={styles.cloudIdle}>
                                <p>
                                    Ask a question and this becomes a 3D map: every project and
                                    article as a point, your question landing next to its
                                    nearest neighbors.
                                </p>
                            </div>
                        )}
                        <div className={styles.legend}>
                            <span className={styles.legendItem}><i style={{ background: '#9d8df0' }} /> projects</span>
                            <span className={styles.legendItem}><i style={{ background: '#8cdcff' }} /> articles</span>
                            <span className={styles.legendItem}><i style={{ background: '#4ade80' }} /> about</span>
                            <span className={styles.legendItem}><i style={{ background: '#fbbf24' }} /> services</span>
                            <span className={styles.legendItem}><i style={{ background: '#ffffff', border: '1px solid #999' }} /> your question</span>
                        </div>
                        <p className={styles.cloudCaption}>
                            384-dimensional embeddings projected to 3D with PCA. Drag to rotate.
                        </p>
                    </div>
                </div>

                <div className={styles.evalStrip}>
                    <span className={styles.evalTitle}>Retrieval, measured on {ragEval.numQueries} labeled queries</span>
                    <span className={styles.evalStat}><b>{(ragEval.recallAt3 * 100).toFixed(0)}%</b> recall@3</span>
                    <span className={styles.evalStat}><b>{ragEval.mrr.toFixed(2)}</b> MRR</span>
                    <span className={styles.evalStat}>on-topic <b>&ge;{ragEval.onTopicMin.toFixed(2)}</b>, off-topic <b>&le;{ragEval.offTopicMax.toFixed(2)}</b></span>
                    <span className={styles.evalNote}>evaluated in CI, not claimed</span>
                </div>

                <details className={styles.underHood}>
                    <summary className={styles.underHoodSummary}>
                        Under the hood: measured, not vibes
                    </summary>
                    <div className={styles.underHoodBody}>
                        <ul className={styles.underHoodList}>
                            <li>
                                <strong>Build-time indexing.</strong> A pipeline chunks every
                                project, article, and page on this site (79 chunks), embeds them
                                with MiniLM, int8-quantizes the vectors, and ships the whole
                                index as a 115 KB file. The same document-to-vector pipeline
                                you would run against a real corpus, minus the vector database
                                it does not need.
                            </li>
                            <li>
                                <strong>On-device retrieval.</strong> Your question is embedded
                                by the same model running in your browser via WebAssembly, then
                                scored against every chunk with cosine similarity. No server
                                sees your question.
                            </li>
                            <li>
                                <strong>Evaluated before shipping.</strong> A {ragEval.numQueries}-question
                                labeled test set measures this exact pipeline: <b>{(ragEval.recallAt3 * 100).toFixed(0)}% recall@3, mean
                                reciprocal rank {ragEval.mrr.toFixed(3)}</b>. The first run scored 97.5%; the failing
                                query (&quot;built for utility companies&quot;) exposed missing sector
                                vocabulary in the chunks, which was fixed and re-measured. Retrieval
                                evaluation is how RAG systems earn trust.
                            </li>
                            <li>
                                <strong>An honest no-match gate.</strong> Off-topic questions score
                                below {ragEval.offTopicMax.toFixed(2)} against this corpus while on-topic ones score above
                                {' '}{ragEval.onTopicMin.toFixed(2)}, so a {ragEval.gate.toFixed(2)} threshold refuses cleanly instead of
                                dredging up noise. Calibrated from data, not guessed.
                            </li>
                            <li>
                                <strong>Retrieval, then generation, both on-device.</strong>
                                Retrieval comes first, because a generator is only as good as what
                                you feed it. The optional answer is written by a 0.5B-parameter
                                instruct model (Qwen2.5) running in your browser via WebGPU, or
                                WebAssembly where WebGPU is missing, prompted to use only the
                                retrieved passages and to admit when it cannot answer. No API, no
                                server, no key. That grounding discipline, answer from the sources
                                or refuse, is what keeps a real RAG system from making things up.
                            </li>
                        </ul>
                    </div>
                </details>
            </div>
        </section>
    );
}
