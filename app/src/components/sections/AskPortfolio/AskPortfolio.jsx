'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { buildSearcher, projectTo3d, NO_MATCH_THRESHOLD } from './searchCore';
import EmbeddingCloud from './EmbeddingCloud';
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
                    <span className="section-header__eyebrow">Live Demo · Glass-Box Retrieval</span>
                    <h2 className="section-header__title">Ask My Portfolio Anything</h2>
                    <p className="section-header__description">
                        Type a question. An embedding model loads into your browser, reads it,
                        and searches everything on this site semantically. Every step is
                        visible: the scores, the sources, and where your question lands in
                        the embedding space. Nothing leaves this page.
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
                                <strong>Evaluated before shipping.</strong> A 40-question labeled
                                test set measures this exact pipeline: <b>100% recall@3, mean
                                reciprocal rank 0.958</b>. The first run scored 97.5%; the failing
                                query (&quot;built for utility companies&quot;) exposed missing sector
                                vocabulary in the chunks, which was fixed and re-measured. Retrieval
                                evaluation is how RAG systems earn trust.
                            </li>
                            <li>
                                <strong>An honest no-match gate.</strong> Off-topic questions score
                                below 0.16 against this corpus while on-topic ones score above
                                0.24, so a 0.20 threshold refuses cleanly instead of dredging up
                                noise. Calibrated from data, not guessed.
                            </li>
                            <li>
                                <strong>This is the retrieval half of RAG.</strong> An optional
                                generation tier (a small LLM running on your GPU via WebGPU) is
                                in the works; retrieval quality first, generation second.
                            </li>
                        </ul>
                    </div>
                </details>
            </div>
        </section>
    );
}
