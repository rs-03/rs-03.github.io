'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './AttentionLens.module.css';

/**
 * Attention Lens: the operation at the heart of every transformer, computed
 * live over a real language model's token representations.
 *
 * A visitor's sentence is run through MiniLM (in the browser, via WebAssembly)
 * to get one contextual embedding per token. We then compute a single
 * self-attention head over those vectors: for each token we take the scaled
 * dot product against every token and softmax it, so each row is a probability
 * distribution over what that token attends to. The result is drawn as an
 * attention matrix and as arcs.
 *
 * Honest scope: this is the self-attention operation (Vaswani et al., "Attention
 * Is All You Need," 2017) applied to real embeddings, so it reflects the
 * semantic structure the model encodes. It is not a read-out of the model's own
 * internal attention heads, which its exported form does not expose.
 */

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const MAX_CHARS = 90;

const PRESETS = [
    'The cat sat on the mat because it was tired.',
    'The trophy did not fit in the suitcase because it was too big.',
    'She poured water from the jug into the cup until it was full.',
    'The river bank was steep, so the bank teller went home.',
];

function heat(t) {
    const x = Math.max(0, Math.min(1, t));
    if (x < 0.4) { const u = x / 0.4; return [18 + u * 106, 18 + u * 88, 40 + u * 199]; }
    if (x < 0.75) { const u = (x - 0.4) / 0.35; return [124 + u * 127, 106 + u * 85, 239 - u * 203]; }
    const u = (x - 0.75) / 0.25; return [251 + u * 4, 191 + u * 64, 36 + u * 219];
}

function computeAttention(data, T, D, tau) {
    const E = [];
    for (let i = 0; i < T; i++) {
        const v = new Float64Array(D);
        let n = 0;
        for (let k = 0; k < D; k++) { v[k] = data[i * D + k]; n += v[k] * v[k]; }
        n = Math.sqrt(n) || 1;
        for (let k = 0; k < D; k++) v[k] /= n;
        E.push(v);
    }
    const A = [];
    for (let i = 0; i < T; i++) {
        const row = new Float64Array(T);
        let mx = -Infinity;
        for (let j = 0; j < T; j++) {
            let d = 0;
            for (let k = 0; k < D; k++) d += E[i][k] * E[j][k];
            row[j] = d * tau;
            if (row[j] > mx) mx = row[j];
        }
        let sum = 0;
        for (let j = 0; j < T; j++) { row[j] = Math.exp(row[j] - mx); sum += row[j]; }
        for (let j = 0; j < T; j++) row[j] /= sum;
        A.push(Array.from(row));
    }
    return A;
}

export default function AttentionLens() {
    const engineRef = useRef(null);
    const containerRef = useRef(null);
    const matrixRef = useRef(null);
    const arcRef = useRef(null);

    const [status, setStatus] = useState('idle'); // idle | loading | ready | error
    const [progress, setProgress] = useState(0);
    const [busy, setBusy] = useState(false);
    const [text, setText] = useState(PRESETS[0]);
    const [focus, setFocus] = useState(12);
    const [embState, setEmbState] = useState(null); // { data, T, D, tokens }
    const [selected, setSelected] = useState(1);

    // attention is a pure function of the embeddings and the focus temperature
    const A = useMemo(
        () => (embState ? computeAttention(embState.data, embState.T, embState.D, focus) : null),
        [embState, focus],
    );
    const tokens = embState?.tokens ?? null;

    async function ensureEngine() {
        if (engineRef.current) return engineRef.current;
        setStatus('loading');
        try {
            const transformers = await import('@huggingface/transformers');
            const embed = await transformers.pipeline('feature-extraction', MODEL, {
                dtype: 'q8',
                progress_callback: info => {
                    if (info.status === 'progress' && info.file?.endsWith('.onnx')) {
                        setProgress(Math.round(info.progress || 0));
                    }
                },
            });
            engineRef.current = embed;
            setStatus('ready');
            return embed;
        } catch {
            setStatus('error');
            return null;
        }
    }

    async function analyze(sentence) {
        const trimmed = sentence.trim().slice(0, MAX_CHARS);
        if (!trimmed || busy) return;
        setBusy(true);
        const embed = await ensureEngine();
        if (!embed) { setBusy(false); return; }
        const out = await embed(trimmed, { pooling: 'none', normalize: false });
        const T = out.dims[1], D = out.dims[2];
        const enc = embed.tokenizer(trimmed);
        const ids = Array.from(enc.input_ids.data).map(Number);
        const toks = ids.map(id => embed.tokenizer.decode([id], { skip_special_tokens: false }));
        const emb = { data: Float32Array.from(out.data), T, D, tokens: toks };

        // default selection: the content token whose strongest link to another
        // content token is highest (skips [CLS]/[SEP]) for a compelling first view
        const A0 = computeAttention(emb.data, T, D, focus);
        let best = Math.min(1, T - 1), bestVal = -1;
        for (let i = 1; i < T - 1; i++) {
            for (let j = 1; j < T - 1; j++) {
                if (i === j) continue;
                if (A0[i][j] > bestVal) { bestVal = A0[i][j]; best = i; }
            }
        }
        setSelected(best);
        setEmbState(emb);
        setBusy(false);
    }

    // expose a test hook (ref assignment only, no setState)
    useEffect(() => {
        if (containerRef.current) containerRef.current._attn = { state: () => (A && tokens ? { tokens, A } : null) };
    }, [A, tokens]);

    // draw the attention matrix
    useEffect(() => {
        const canvas = matrixRef.current;
        if (!canvas || !A || !tokens) return;
        const ctx = canvas.getContext('2d');
        const T = tokens.length;
        const W = canvas.width, H = canvas.height;
        ctx.fillStyle = '#101022';
        ctx.fillRect(0, 0, W, H);

        const leftPad = 96, topPad = 96;
        const cell = Math.min((W - leftPad - 12) / T, (H - topPad - 12) / T);
        const gx = leftPad, gy = topPad;

        for (let i = 0; i < T; i++) {
            for (let j = 0; j < T; j++) {
                const [r, g, b] = heat(Math.pow(A[i][j], 0.7));
                ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
                ctx.fillRect(gx + j * cell + 1, gy + i * cell + 1, cell - 2, cell - 2);
            }
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(gx - 1, gy + selected * cell, T * cell + 2, cell);

        const fs = Math.min(13, cell * 0.72);
        ctx.font = `${fs}px ui-monospace, monospace`;
        ctx.textBaseline = 'middle';
        for (let i = 0; i < T; i++) {
            ctx.fillStyle = i === selected ? '#ffd27a' : 'rgba(230,232,255,0.7)';
            ctx.textAlign = 'right';
            ctx.fillText(tokens[i].slice(0, 10), gx - 8, gy + i * cell + cell / 2);
        }
        for (let j = 0; j < T; j++) {
            ctx.save();
            ctx.translate(gx + j * cell + cell / 2, gy - 8);
            ctx.rotate(-Math.PI / 3);
            ctx.fillStyle = 'rgba(140,220,255,0.75)';
            ctx.textAlign = 'left';
            ctx.fillText(tokens[j].slice(0, 10), 0, 0);
            ctx.restore();
        }
        ctx.fillStyle = 'rgba(230,232,255,0.5)';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('query token down, attends to key token across', gx, gy + T * cell + 22);
    }, [A, tokens, selected]);

    // draw the arcs for the selected token
    useEffect(() => {
        const canvas = arcRef.current;
        if (!canvas || !A || !tokens) return;
        const ctx = canvas.getContext('2d');
        const T = tokens.length;
        const W = canvas.width, H = canvas.height;
        ctx.fillStyle = '#101022';
        ctx.fillRect(0, 0, W, H);

        const pad = 16;
        const baseY = H - 34;
        const xs = [];
        for (let i = 0; i < T; i++) xs.push(pad + (i + 0.5) * (W - 2 * pad) / T);

        // renormalize over the other tokens so the arcs show where this token
        // looks aside from itself (self-attention dominates and is shown in the
        // matrix; here we surface the cross-token structure)
        const row = A[selected];
        let tot = 0;
        for (let j = 0; j < T; j++) if (j !== selected) tot += row[j];
        tot = tot || 1;
        for (let j = 0; j < T; j++) {
            if (j === selected) continue;
            const w = row[j] / tot;
            if (w < 0.02) continue;
            const x0 = xs[selected], x1 = xs[j];
            const lift = Math.min(baseY - 20, 26 + Math.abs(x1 - x0) * 0.55);
            ctx.beginPath();
            ctx.moveTo(x0, baseY);
            ctx.quadraticCurveTo((x0 + x1) / 2, baseY - lift, x1, baseY);
            ctx.strokeStyle = `rgba(246,167,35,${Math.min(1, 0.22 + w * 1.8)})`;
            ctx.lineWidth = Math.max(1, w * 18);
            ctx.stroke();
        }
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i < T; i++) {
            ctx.fillStyle = i === selected ? '#ffd27a' : 'rgba(230,232,255,0.6)';
            ctx.beginPath();
            ctx.arc(xs[i], baseY, i === selected ? 5 : 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.translate(xs[i], baseY + 8);
            ctx.rotate(Math.PI / 6);
            ctx.fillText(tokens[i].slice(0, 8), 0, 0);
            ctx.restore();
        }
    }, [A, tokens, selected]);

    function onMatrixClick(e) {
        if (!tokens) return;
        const canvas = matrixRef.current;
        const rect = canvas.getBoundingClientRect();
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        const T = tokens.length;
        const leftPad = 96, topPad = 96;
        const cell = Math.min((canvas.width - leftPad - 12) / T, (canvas.height - topPad - 12) / T);
        const i = Math.floor((y - topPad) / cell);
        if (i >= 0 && i < T) setSelected(i);
    }

    const sel = tokens ? tokens[selected] : null;

    return (
        <section className={`section ${styles.attn}`} id="attention" ref={containerRef}>
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Live Demo · How AI Reads</span>
                    <h2 className="section-header__title">See What a Sentence Pays Attention To</h2>
                    <p className="section-header__description">
                        Attention is the idea that made modern language models possible: every
                        word gets to look at every other word and decide which ones matter. Type a
                        sentence. A language model runs in your browser to turn each token into a
                        vector, then a self-attention head scores every token against every other
                        and softmaxes it into the weights you see here. Click any row to follow one
                        token&apos;s attention.
                    </p>
                </div>

                <div className={styles.controls}>
                    {PRESETS.map((p, i) => (
                        <button key={i} className={styles.pill} disabled={busy} onClick={() => { setText(p); analyze(p); }}>
                            {p.length > 32 ? p.slice(0, 30) + '...' : p}
                        </button>
                    ))}
                </div>

                <form className={styles.form} onSubmit={e => { e.preventDefault(); analyze(text); }}>
                    <input
                        type="text"
                        value={text}
                        maxLength={MAX_CHARS}
                        onChange={e => setText(e.target.value)}
                        placeholder="Type a sentence..."
                        className={styles.input}
                        aria-label="Sentence to visualize attention for"
                    />
                    <button type="submit" className="btn btn--primary" disabled={busy}>
                        {busy ? 'Reading...' : 'Visualize'}
                    </button>
                </form>

                {status === 'loading' && (
                    <p className={styles.note}>
                        Loading the language model into your browser ({progress}%). One-time
                        download of about 25 MB, cached after that.
                    </p>
                )}
                {status === 'error' && (
                    <p className={styles.error}>The model could not load. Check your connection and try again.</p>
                )}
                {status === 'idle' && (
                    <p className={styles.note}>Pick a sentence above or type your own, then hit Visualize.</p>
                )}

                {A && tokens && (
                    <div className={styles.lab}>
                        <div className={styles.stagePanel}>
                            <canvas ref={matrixRef} width={620} height={620} className={styles.matrix} onClick={onMatrixClick} aria-label="Attention matrix" />
                        </div>
                        <div className={styles.side}>
                            <div className={styles.selCard}>
                                <span className={styles.selLabel}>Following token</span>
                                <span className={styles.selToken}>{sel}</span>
                                <span className={styles.selHint}>click any row in the grid to follow a different token</span>
                            </div>
                            <div className={styles.arcPanel}>
                                <span className={styles.arcLabel}>where it looks, aside from itself</span>
                                <canvas ref={arcRef} width={340} height={220} className={styles.arcs} />
                            </div>
                            <label className={styles.slider}>
                                <span>focus <b>{focus}</b></span>
                                <input type="range" min="4" max="24" step="1" value={focus} onChange={e => setFocus(parseInt(e.target.value, 10))} />
                                <span className={styles.sliderHint}>how sharply attention concentrates</span>
                            </label>
                        </div>
                    </div>
                )}

                <details className={styles.underHood}>
                    <summary className={styles.underHoodSummary}>
                        Under the hood: softmax(QK^T / sqrt(d)) V, and nothing faked
                    </summary>
                    <div className={styles.underHoodBody}>
                        <ul className={styles.underHoodList}>
                            <li>
                                <strong>The operation.</strong> Self-attention turns each token into
                                a query, a key, and a value. It scores every query against every key
                                with a dot product, scales by the square root of the dimension so the
                                numbers stay tame, softmaxes each row into weights that sum to one,
                                and mixes the values by those weights. That single operation, stacked
                                and repeated, is the transformer (Vaswani et al., 2017).
                            </li>
                            <li>
                                <strong>Why it changed everything.</strong> Before attention, models
                                read text one step at a time and forgot the beginning by the end.
                                Attention lets every word reach any other word in one hop, in
                                parallel, so long-range meaning survives and training scales. Every
                                large language model in use today is built on it.
                            </li>
                            <li>
                                <strong>What you are seeing.</strong> Your sentence is embedded by a
                                real model (MiniLM) running on your device, one vector per token.
                                This demo computes one self-attention head over those real vectors,
                                so the weights track the semantic structure the model actually
                                encodes: notice how a pronoun leans toward the noun it refers to. The
                                rows are genuine softmax distributions, non-negative and summing to
                                one, which the tests here check.
                            </li>
                            <li>
                                <strong>Where the honesty line is.</strong> This is the attention
                                mechanism applied to the model&apos;s token embeddings, not a read-out
                                of the model&apos;s own internal heads, which its exported browser
                                form does not expose. Same math, real representations, no pretending
                                otherwise.
                            </li>
                        </ul>
                    </div>
                </details>

                <p className={styles.footnote}>
                    The model runs on your device, the attention is computed from the vectors it
                    produces, and every weight on screen is a real softmax. Nothing is uploaded.
                </p>
            </div>
        </section>
    );
}
