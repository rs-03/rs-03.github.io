'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './SequenceAlignment.module.css';

/**
 * Sequence Alignment: dynamic programming, animated.
 *
 * The two workhorse algorithms of bioinformatics, filling their scoring matrix
 * one cell at a time and then tracing back the optimal path. Needleman-Wunsch
 * (1970) aligns two sequences end to end; Smith-Waterman (1981) finds the best
 * matching sub-region. Both are exact dynamic programs: each cell is the best
 * score reachable there, computed from three neighbors, in O(m*n) time.
 *
 * References: S. Needleman & C. Wunsch, J. Mol. Biol. (1970); T. Smith & M.
 * Waterman, J. Mol. Biol. (1981); O. Gotoh, J. Mol. Biol. (1982) for affine
 * gaps. Everything here runs in your browser.
 */

const PRESETS = [
    { name: 'DNA · classic', a: 'TGTTACGG', b: 'GGTTGACTA' },
    { name: 'DNA · indel', a: 'ACGTGTCA', b: 'ACGTCA' },
    { name: 'Protein · Durbin', a: 'HEAGAWGHEE', b: 'PAWHEAE' },
];

// core dynamic program. mode: 'global' (Needleman-Wunsch) or 'local'
// (Smith-Waterman). Returns the full matrix, the traceback path, the aligned
// strings, and the score. Written once and reused; the test recomputes it
// independently to check every cell.
export function align(a, b, mode, match, mismatch, gap) {
    const m = a.length, n = b.length;
    const H = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    const local = mode === 'local';
    if (!local) {
        for (let i = 1; i <= m; i++) H[i][0] = i * gap;
        for (let j = 1; j <= n; j++) H[0][j] = j * gap;
    }
    let bestI = m, bestJ = n, bestVal = local ? 0 : H[m][n];
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const s = a[i - 1] === b[j - 1] ? match : mismatch;
            let v = Math.max(H[i - 1][j - 1] + s, H[i - 1][j] + gap, H[i][j - 1] + gap);
            if (local) v = Math.max(0, v);
            H[i][j] = v;
            if (local && v >= bestVal) { bestVal = v; bestI = i; bestJ = j; }
        }
    }
    if (!local) bestVal = H[m][n];

    // traceback (prefer diagonal, then up, then left)
    const path = [];
    let ai = '', bi = '', mid = '';
    let i = bestI, j = bestJ;
    const atEnd = () => (local ? H[i][j] === 0 : i === 0 && j === 0);
    while (!atEnd()) {
        path.push({ i, j });
        const s = i > 0 && j > 0 && a[i - 1] === b[j - 1] ? match : mismatch;
        if (i > 0 && j > 0 && H[i][j] === H[i - 1][j - 1] + s) {
            ai = a[i - 1] + ai; bi = b[j - 1] + bi;
            mid = (a[i - 1] === b[j - 1] ? '|' : ' ') + mid;
            i--; j--;
        } else if (i > 0 && H[i][j] === H[i - 1][j] + gap) {
            ai = a[i - 1] + ai; bi = '-' + bi; mid = ' ' + mid; i--;
        } else {
            ai = '-' + ai; bi = b[j - 1] + bi; mid = ' ' + mid; j--;
        }
    }
    path.push({ i, j });
    path.reverse();
    return { m, n, H, path, alignedA: ai, alignedB: bi, mid, score: bestVal, bestI, bestJ };
}

function lerp(c1, c2, t) {
    return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
}
function cellColor(v, mag) {
    const t = Math.max(-1, Math.min(1, v / mag));
    if (t >= 0) {
        if (t < 0.6) return lerp([18, 18, 38], [246, 167, 35], t / 0.6);
        return lerp([246, 167, 35], [255, 250, 240], (t - 0.6) / 0.4);
    }
    return lerp([18, 18, 38], [58, 78, 150], -t);
}

export default function SequenceAlignment() {
    const canvasRef = useRef(null);
    const computeRef = useRef(null);
    const revealRef = useRef({ fill: 0, phase: 0, trace: 0, hold: 0 });
    const paramsRef = useRef({});

    const [presetIdx, setPresetIdx] = useState(0);
    const [seqA, setSeqA] = useState(PRESETS[0].a);
    const [seqB, setSeqB] = useState(PRESETS[0].b);
    const [mode, setMode] = useState('local');
    const [match, setMatch] = useState(3);
    const [mismatch, setMismatch] = useState(-3);
    const [gap, setGap] = useState(-2);

    // the DP is a pure function of the two sequences, so derive it during render.
    // The input boxes are the single source of truth; presets just fill them.
    const res = useMemo(() => {
        const a = seqA, b = seqB;
        return { ...align(a, b, mode, match, mismatch, gap), a, b, mode };
    }, [seqA, seqB, mode, match, mismatch, gap]);

    // publish the computed result to the animation loop and restart the reveal
    useEffect(() => {
        computeRef.current = res;
        revealRef.current = { fill: 0, phase: 0, trace: 0, hold: 0 };
    }, [res]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        canvas._align = { state: () => computeRef.current };

        function draw() {
            const data = computeRef.current;
            if (!data) return;
            const { m, n, H, path, a, b } = data;
            const rv = revealRef.current;
            const W = canvas.width, H2 = canvas.height;
            ctx.fillStyle = '#101022';
            ctx.fillRect(0, 0, W, H2);

            const labelPad = 34;
            const rows = m + 1, cols = n + 1;
            const cell = Math.min((W - labelPad - 12) / cols, (H2 - labelPad - 12) / rows, 52);
            const gx = labelPad + (W - labelPad - cols * cell) / 2;
            const gy = labelPad + (H2 - labelPad - rows * cell) / 2;

            let mag = 1;
            for (let i = 0; i <= m; i++) for (let j = 0; j <= n; j++) mag = Math.max(mag, Math.abs(H[i][j]));

            const totalCells = rows * cols;
            const revealed = rv.phase === 0 ? rv.fill : totalCells;

            // sequence letters (B across the top, A down the left)
            ctx.font = `${Math.min(18, cell * 0.5)}px ui-monospace, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#8cdcff';
            for (let j = 0; j < n; j++) ctx.fillText(b[j], gx + (j + 1) * cell + cell / 2, gy - labelPad / 2 + 6);
            ctx.fillStyle = '#f6a723';
            for (let i = 0; i < m; i++) ctx.fillText(a[i], gx - labelPad / 2 + 6, gy + (i + 1) * cell + cell / 2);

            // cells
            for (let i = 0; i <= m; i++) {
                for (let j = 0; j <= n; j++) {
                    const idx = i * cols + j;
                    if (idx >= revealed) continue;
                    const x = gx + j * cell, y = gy + i * cell;
                    const [r, g, bl] = cellColor(H[i][j], mag);
                    ctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
                    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
                    if (cell >= 22) {
                        const lum = (r * 0.299 + g * 0.587 + bl * 0.114) / 255;
                        ctx.fillStyle = lum > 0.6 ? 'rgba(16,16,34,0.85)' : 'rgba(230,232,255,0.82)';
                        ctx.font = `${Math.min(15, cell * 0.4)}px ui-monospace, monospace`;
                        ctx.fillText(String(H[i][j]), x + cell / 2, y + cell / 2 + 1);
                    }
                }
            }

            // traceback path (revealed progressively in phase >= 1)
            if (rv.phase >= 1 && path.length) {
                const shown = rv.phase === 1 ? rv.trace : path.length;
                ctx.strokeStyle = 'rgba(255,250,240,0.9)';
                ctx.lineWidth = Math.max(2, cell * 0.08);
                for (let k = 0; k < shown && k < path.length; k++) {
                    const { i, j } = path[k];
                    const x = gx + j * cell, y = gy + i * cell;
                    ctx.save();
                    ctx.shadowColor = '#f6a723';
                    ctx.shadowBlur = cell * 0.5;
                    ctx.strokeStyle = 'rgba(255,250,240,0.95)';
                    ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
                    ctx.restore();
                }
                // connecting line along the path
                if (shown > 1) {
                    ctx.beginPath();
                    for (let k = 0; k < shown && k < path.length; k++) {
                        const { i, j } = path[k];
                        const cx = gx + j * cell + cell / 2, cy = gy + i * cell + cell / 2;
                        if (k === 0) ctx.moveTo(cx, cy);
                        else ctx.lineTo(cx, cy);
                    }
                    ctx.strokeStyle = 'rgba(246,167,35,0.65)';
                    ctx.lineWidth = Math.max(1.5, cell * 0.05);
                    ctx.stroke();
                }
            }
        }

        function advance() {
            const data = computeRef.current;
            if (!data) return;
            const rv = revealRef.current;
            const totalCells = (data.m + 1) * (data.n + 1);
            if (rv.phase === 0) {
                rv.fill += Math.max(1, Math.ceil(totalCells / 80));
                if (rv.fill >= totalCells) { rv.fill = totalCells; rv.phase = 1; rv.trace = 0; }
            } else if (rv.phase === 1) {
                rv.trace += 0.34;
                if (rv.trace >= data.path.length) { rv.trace = data.path.length; rv.phase = 2; rv.hold = 0; }
            } else {
                rv.hold += 1;
                if (rv.hold > 200) { rv.fill = 0; rv.trace = 0; rv.hold = 0; rv.phase = 0; }
            }
        }

        const session = { rafId: 0, running: true };
        function frame() {
            if (!session.running) return;
            advance();
            draw();
            session.rafId = requestAnimationFrame(frame);
        }

        if (reducedMotion) {
            const rv = revealRef.current;
            rv.phase = 2; rv.fill = 1e9; rv.trace = 1e9; rv.hold = 0;
            draw();
        } else {
            session.rafId = requestAnimationFrame(frame);
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (reducedMotion) return;
            const was = session.running;
            session.running = entry.isIntersecting && !document.hidden;
            if (session.running && !was) session.rafId = requestAnimationFrame(frame);
        });
        observer.observe(canvas);
        const onVis = () => {
            if (reducedMotion) return;
            const was = session.running;
            session.running = !document.hidden;
            if (session.running && !was) session.rafId = requestAnimationFrame(frame);
            else if (!session.running) cancelAnimationFrame(session.rafId);
        };
        document.addEventListener('visibilitychange', onVis);

        return () => {
            session.running = false;
            cancelAnimationFrame(session.rafId);
            observer.disconnect();
            document.removeEventListener('visibilitychange', onVis);
            canvas._align = null;
        };
    }, []);

    function replay() {
        revealRef.current = { fill: 0, phase: 0, trace: 0, hold: 0 };
    }

    function choosePreset(i) {
        setPresetIdx(i);
        setSeqA(PRESETS[i].a);
        setSeqB(PRESETS[i].b);
    }
    // sequences are letters only, capped so the matrix stays legible and fast
    const clean = v => v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 18);
    function editA(v) { setSeqA(clean(v)); setPresetIdx(-1); }
    function editB(v) { setSeqB(clean(v)); setPresetIdx(-1); }

    const modeName = mode === 'local' ? 'Smith-Waterman (local)' : 'Needleman-Wunsch (global)';

    return (
        <section className={`section ${styles.align}`} id="alignment">
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Live Demo · Computational Biology</span>
                    <h2 className="section-header__title">Line Up Two Sequences</h2>
                    <p className="section-header__description">
                        How do you tell whether two genes or proteins are related? You line them
                        up so the matches stack and the mutations and insertions cost you points.
                        The two classic algorithms do this exactly, not by guessing, by filling a
                        grid where every cell is the best score reachable there. Watch the matrix
                        compute, then watch the optimal path trace back.
                    </p>
                </div>

                <div className={styles.controls}>
                    {PRESETS.map((p, i) => (
                        <button
                            key={p.name}
                            className={`${styles.pill} ${presetIdx === i ? styles.pillActive : ''}`}
                            onClick={() => choosePreset(i)}
                        >
                            {p.name}
                        </button>
                    ))}
                    <span className={styles.divider} />
                    <button className={`${styles.pill} ${mode === 'local' ? styles.pillActive : ''}`} onClick={() => setMode('local')}>Local</button>
                    <button className={`${styles.pill} ${mode === 'global' ? styles.pillActive : ''}`} onClick={() => setMode('global')}>Global</button>
                    <button className={styles.pill} onClick={replay}>Replay</button>
                </div>

                <div className={styles.seqInputs}>
                    <label className={styles.seqField}>
                        <span className={styles.seqTag} style={{ color: '#f6a723' }}>A</span>
                        <input
                            className={styles.seqInput}
                            type="text"
                            value={seqA}
                            onChange={e => editA(e.target.value)}
                            maxLength={18}
                            spellCheck={false}
                            aria-label="Sequence A"
                            placeholder="type a sequence"
                        />
                    </label>
                    <label className={styles.seqField}>
                        <span className={styles.seqTag} style={{ color: '#8cdcff' }}>B</span>
                        <input
                            className={styles.seqInput}
                            type="text"
                            value={seqB}
                            onChange={e => editB(e.target.value)}
                            maxLength={18}
                            spellCheck={false}
                            aria-label="Sequence B"
                            placeholder="type a sequence"
                        />
                    </label>
                    <span className={styles.seqHint}>Paste your own · letters only, up to 18 each</span>
                </div>

                <div className={styles.lab}>
                    <div className={styles.stagePanel}>
                        <canvas ref={canvasRef} width={720} height={560} className={styles.canvas} aria-label="Dynamic programming matrix for sequence alignment with the optimal traceback path" />
                    </div>

                    <div className={styles.side}>
                        <div className={styles.scoreCard}>
                            <span className={styles.scoreLabel}>Alignment score</span>
                            <span className={styles.scoreValue}>{res.score}</span>
                            <span className={styles.modeName}>{modeName}</span>
                        </div>

                        <div className={styles.sliders}>
                            <label className={styles.slider}>
                                <span>match <b>+{match}</b></span>
                                <input type="range" min="1" max="6" step="1" value={match} onChange={e => setMatch(parseInt(e.target.value, 10))} />
                            </label>
                            <label className={styles.slider}>
                                <span>mismatch <b>{mismatch}</b></span>
                                <input type="range" min="-6" max="0" step="1" value={mismatch} onChange={e => setMismatch(parseInt(e.target.value, 10))} />
                            </label>
                            <label className={styles.slider}>
                                <span>gap <b>{gap}</b></span>
                                <input type="range" min="-6" max="-1" step="1" value={gap} onChange={e => setGap(parseInt(e.target.value, 10))} />
                            </label>
                        </div>

                        <div className={styles.legend}>
                            <span className={styles.legendItem}><i style={{ background: 'rgb(246,167,35)' }} /> high score</span>
                            <span className={styles.legendItem}><i style={{ background: 'rgb(58,78,150)' }} /> penalty</span>
                            <span className={styles.legendItem}><i className={styles.pathSwatch} /> optimal path</span>
                        </div>
                    </div>
                </div>

                <div className={styles.alignmentOut}>
                    <pre className={styles.alnPre}>
                        <span className={styles.alnRow}>{renderAln(res.alignedA, res.mid, 'top')}</span>
                        <span className={styles.alnMid}>{res.mid}</span>
                        <span className={styles.alnRow}>{renderAln(res.alignedB, res.mid, 'bot')}</span>
                    </pre>
                </div>

                <details className={styles.underHood}>
                    <summary className={styles.underHoodSummary}>
                        Under the hood: one recurrence, two famous algorithms
                    </summary>
                    <div className={styles.underHoodBody}>
                        <ul className={styles.underHoodList}>
                            <li>
                                <strong>The recurrence.</strong> Each cell asks a single question:
                                is it better to align these two letters (move diagonally and add a
                                match or mismatch score), or to open a gap (move up or left and pay
                                the gap penalty)? Take the best of the three. That local choice,
                                filled across the whole grid, is guaranteed to find the globally
                                optimal alignment. This is dynamic programming in its purest form.
                            </li>
                            <li>
                                <strong>Global vs local.</strong> Needleman-Wunsch (1970) forces
                                the path from corner to corner, aligning the sequences in full.
                                Smith-Waterman (1981) adds one rule, never let a cell go below
                                zero, and starts the traceback from the highest cell, so it finds
                                the best matching sub-region instead. One extra max() turns global
                                into local. Toggle the modes and watch where the path starts.
                            </li>
                            <li>
                                <strong>Why it matters.</strong> Alignment is how we measure
                                homology, spot mutations, and place reads on a genome. The score
                                is a real number you can rank and threshold. Change the match,
                                mismatch, and gap costs and the optimal alignment shifts, which is
                                exactly why choosing a scoring scheme is a modelling decision, not
                                a detail.
                            </li>
                            <li>
                                <strong>Beyond the toy.</strong> Real tools use position-specific
                                substitution matrices like BLOSUM and PAM rather than a flat
                                match/mismatch, and affine gap costs (a large open penalty plus a
                                small extend penalty) via Gotoh&apos;s 1982 method, because one
                                long indel is more likely than many short ones. The grid you see
                                here is still the exact engine underneath all of them, running in
                                O(m times n) time.
                            </li>
                        </ul>
                    </div>
                </details>

                <p className={styles.footnote}>
                    The matrix is computed from the recurrence, the traceback is the true optimal
                    path, and the score is exact. Change the costs and the math re-derives itself.
                </p>
            </div>
        </section>
    );
}

// colorized aligned row: gaps muted, matched columns bright
function renderAln(seq, mid, which) {
    if (!seq) return null;
    return seq.split('').map((ch, k) => {
        const matched = mid[k] === '|';
        let cls = which === 'top' ? 'aTop' : 'aBot';
        if (ch === '-') cls = 'aGap';
        else if (matched) cls = 'aMatch';
        return (
            <span key={k} className={styles[cls]}>{ch}</span>
        );
    });
}
