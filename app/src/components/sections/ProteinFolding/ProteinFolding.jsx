'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ProteinFolding.module.css';

/**
 * Protein Folding: the HP lattice model, folding live.
 *
 * Every residue is reduced to one of two kinds, hydrophobic (H) or polar (P),
 * and the chain lives on a 2D square lattice as a self-avoiding walk. The only
 * energy is a bonus for each pair of H residues that touch on the lattice
 * without being neighbors in the chain: burying the hydrophobic residues in a
 * core lowers the energy. A Metropolis Monte Carlo search over the standard
 * local move set (end moves, corner flips, crankshafts), wrapped in simulated
 * annealing, hunts for the lowest-energy fold while you watch.
 *
 * The science is real: K. Dill, "Theory for the folding and stability of
 * globular proteins," Biochemistry (1985); Lau & Dill (1989); Anfinsen's
 * thermodynamic hypothesis (1973); Levinthal's paradox (1969); and the proof
 * that even this toy model is NP-hard (Berger & Leighton, 1998).
 */

const SEQUENCES = [
    { name: 'Benchmark 20-mer', hp: 'HPHPPHHPHPPHPHHPPHPH', note: 'a classic 2D HP test sequence' },
    { name: 'Benchmark 24-mer', hp: 'HHPPHPPHPPHPPHPPHPPHPPHH', note: 'longer, harder to compact' },
    { name: 'Two cores 36-mer', hp: 'PPPHHPPHHPPPPPHHHHHHHPPHHPPPPHHPPHPP', note: 'forms more than one H cluster' },
    { name: 'Hydrophobic core', hp: 'PPHHHHHHPPHHHHHHPPHHHHPP', note: 'H-rich, collapses into a dense core' },
];

const TMAX = 2.6;         // starting temperature for the first descent
const TMIN = 0.12;        // coldest temperature (tight packing)
const TMAX_CYC = 1.3;     // reheat ceiling for later anneal cycles
const ANNEAL_SWEEPS = 800; // length of the first cool-down
const CYCLE = 500;        // length of each reheat/cool cycle after that
const OFF = 220;
const STRIDE = 900;
const key = (x, y) => (x + OFF) * STRIDE + (y + OFF);

const COL_H = '#f6a723';
const COL_P = '#7d8bd4';

const FOLD_PHASE_COLORS = { best: '#ffffff', hot: '#f6a723', cool: '#8cdcff', cold: '#4ade80' };
const FOLD_START_NARRATION = 'Warming up: the chain is about to start its search.';

// a short caption for what the annealing search is doing right now
function foldNarration(temp, flash) {
    if (flash) return { key: 'best', text: 'New best fold: another hydrophobic contact just got buried.' };
    if (temp > 1.4) return { key: 'hot', text: 'Hot search: the chain flails and explores wildly.' };
    if (temp > 0.5) return { key: 'cool', text: 'Cooling: the chain collapses to bury its H core.' };
    return { key: 'cold', text: 'Cold: fine-tuning the last few contacts.' };
}

export default function ProteinFolding() {
    const canvasRef = useRef(null);
    const sparkRef = useRef(null);
    const paramsRef = useRef({ paused: false, speed: 3 });
    const pendingRef = useRef({ seq: SEQUENCES[0].hp, resetBest: true });
    const statsRef = useRef({ energy: 0, best: 0, contacts: 0, temp: TMAX, sweeps: 0, len: 0, hCount: 0, phase: 'hot', narration: FOLD_START_NARRATION });

    const [seqIdx, setSeqIdx] = useState(0);
    const [paused, setPaused] = useState(false);
    const [speed, setSpeed] = useState(3);
    const [customSeq, setCustomSeq] = useState('');
    const [customErr, setCustomErr] = useState(null);
    const [stats, setStats] = useState({ energy: 0, best: 0, contacts: 0, temp: TMAX, sweeps: 0, len: 20, hCount: 0, phase: 'hot', narration: FOLD_START_NARRATION });

    useEffect(() => {
        paramsRef.current = { paused, speed };
    }, [paused, speed]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const spark = sparkRef.current;
        if (!canvas || !spark) return undefined;
        const ctx = canvas.getContext('2d');
        const sctx = spark.getContext('2d');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // folding state (closure)
        let n = 0;
        let seq = new Uint8Array(0); // 1 = H, 0 = P
        let px = new Int32Array(0);
        let py = new Int32Array(0);
        let occ = new Map();
        let contacts = 0;
        let bestEnergy = 0;
        let prevBest = 0;
        let bestFlash = 0;
        let annealSweep = 0;
        let history = [];

        function totalContacts() {
            let c = 0;
            for (let i = 0; i < n; i++) {
                if (seq[i] !== 1) continue;
                const x = px[i], y = py[i];
                const nb = [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)];
                for (const k of nb) {
                    const j = occ.get(k);
                    if (j === undefined || seq[j] !== 1) continue;
                    if (Math.abs(i - j) >= 2) c++;
                }
            }
            return c / 2;
        }

        function residueContacts(i) {
            if (seq[i] !== 1) return 0;
            let c = 0;
            const x = px[i], y = py[i];
            const nb = [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)];
            for (const k of nb) {
                const j = occ.get(k);
                if (j === undefined || seq[j] !== 1) continue;
                if (Math.abs(i - j) >= 2) c++;
            }
            return c;
        }

        function initFold(seqStr, resetBest) {
            n = seqStr.length;
            seq = new Uint8Array(n);
            px = new Int32Array(n);
            py = new Int32Array(n);
            occ = new Map();
            let hc = 0;
            for (let i = 0; i < n; i++) {
                seq[i] = seqStr[i] === 'H' ? 1 : 0;
                if (seq[i]) hc++;
                px[i] = i;
                py[i] = 0;
                occ.set(key(i, 0), i);
            }
            contacts = totalContacts();
            annealSweep = 0;
            history = [];
            if (resetBest) bestEnergy = -contacts;
            prevBest = bestEnergy;
            bestFlash = 0;
            statsRef.current.len = n;
            statsRef.current.hCount = hc;
        }

        function proposeEnd(i) {
            const j = i === 0 ? 1 : n - 2;
            const cand = [[px[j] + 1, py[j]], [px[j] - 1, py[j]], [px[j], py[j] + 1], [px[j], py[j] - 1]];
            const opts = cand.filter(([x, y]) => !(x === px[i] && y === py[i]) && !occ.has(key(x, y)));
            if (!opts.length) return null;
            const [nx, ny] = opts[(Math.random() * opts.length) | 0];
            return [{ idx: i, nx, ny }];
        }

        function proposeCorner(i) {
            const ax = px[i] - px[i - 1], ay = py[i] - py[i - 1];
            const bx = px[i + 1] - px[i], by = py[i + 1] - py[i];
            if (ax * bx + ay * by !== 0) return null; // straight, no corner
            const nx = px[i - 1] + px[i + 1] - px[i];
            const ny = py[i - 1] + py[i + 1] - py[i];
            if (occ.has(key(nx, ny))) return null;
            return [{ idx: i, nx, ny }];
        }

        function proposeCrank(i) {
            if (i < 1 || i > n - 3) return null;
            const a = i - 1, d = i + 2, b = i, c = i + 1;
            if (Math.abs(px[a] - px[d]) + Math.abs(py[a] - py[d]) !== 1) return null; // need U-square
            let nbx, nby, ncx, ncy;
            if (py[a] === py[d]) {
                const line = py[a];
                nbx = px[b]; nby = 2 * line - py[b];
                ncx = px[c]; ncy = 2 * line - py[c];
            } else {
                const line = px[a];
                nbx = 2 * line - px[b]; nby = py[b];
                ncx = 2 * line - px[c]; ncy = py[c];
            }
            if (nbx === ncx && nby === ncy) return null;
            return [{ idx: b, nx: nbx, ny: nby }, { idx: c, nx: ncx, ny: ncy }];
        }

        // Pivot move: rotate the whole tail (pivot+1 .. n-1) about a residue by
        // 90 or 180 degrees. This is the powerful global SAW move that lets the
        // chain make large rearrangements the local moves cannot; combined with
        // the local moves it reaches far lower energies.
        function attemptPivot(T) {
            if (n < 4) return;
            const pivot = 1 + ((Math.random() * (n - 2)) | 0);
            const rot = (Math.random() * 3) | 0;
            const tail = n - 1 - pivot;
            const nx = new Int32Array(tail), ny = new Int32Array(tail);
            const head = new Set();
            for (let k = 0; k <= pivot; k++) head.add(key(px[k], py[k]));
            const taken = new Set();
            for (let t = 0; t < tail; t++) {
                const k = pivot + 1 + t;
                const rx = px[k] - px[pivot], ry = py[k] - py[pivot];
                let ax, ay;
                if (rot === 0) { ax = ry; ay = -rx; }
                else if (rot === 1) { ax = -ry; ay = rx; }
                else { ax = -rx; ay = -ry; }
                const wx = px[pivot] + ax, wy = py[pivot] + ay;
                const kk = key(wx, wy);
                if (head.has(kk) || taken.has(kk)) return; // collision, reject
                taken.add(kk);
                nx[t] = wx; ny[t] = wy;
            }
            const before = contacts;
            const savedX = new Int32Array(tail), savedY = new Int32Array(tail);
            for (let t = 0; t < tail; t++) { const k = pivot + 1 + t; savedX[t] = px[k]; savedY[t] = py[k]; }
            for (let t = 0; t < tail; t++) { const k = pivot + 1 + t; occ.delete(key(px[k], py[k])); }
            for (let t = 0; t < tail; t++) { const k = pivot + 1 + t; px[k] = nx[t]; py[k] = ny[t]; occ.set(key(nx[t], ny[t]), k); }
            const after = totalContacts();
            const dE = -(after - before);
            if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
                contacts = after;
                if (-contacts < bestEnergy) bestEnergy = -contacts;
            } else {
                for (let t = 0; t < tail; t++) { const k = pivot + 1 + t; occ.delete(key(px[k], py[k])); }
                for (let t = 0; t < tail; t++) { const k = pivot + 1 + t; px[k] = savedX[t]; py[k] = savedY[t]; occ.set(key(savedX[t], savedY[t]), k); }
            }
        }

        function attempt(T) {
            const i = (Math.random() * n) | 0;
            let movers;
            if (i === 0 || i === n - 1) movers = proposeEnd(i);
            else movers = Math.random() < 0.5 ? proposeCorner(i) : proposeCrank(i);
            if (!movers) return;

            const oldKeys = new Set(movers.map(m => key(px[m.idx], py[m.idx])));
            for (const m of movers) {
                const tk = key(m.nx, m.ny);
                if (oldKeys.has(tk)) continue;
                if (occ.has(tk)) return;
            }
            if (movers.length === 2 && movers[0].nx === movers[1].nx && movers[0].ny === movers[1].ny) return;

            let before = 0;
            for (const m of movers) before += residueContacts(m.idx);
            const saved = movers.map(m => ({ idx: m.idx, ox: px[m.idx], oy: py[m.idx] }));
            for (const m of movers) occ.delete(key(px[m.idx], py[m.idx]));
            for (const m of movers) { px[m.idx] = m.nx; py[m.idx] = m.ny; occ.set(key(m.nx, m.ny), m.idx); }
            let after = 0;
            for (const m of movers) after += residueContacts(m.idx);

            const dContacts = after - before;
            const dE = -dContacts;
            if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
                contacts += dContacts;
                if (-contacts < bestEnergy) bestEnergy = -contacts;
            } else {
                for (const m of movers) occ.delete(key(px[m.idx], py[m.idx]));
                for (const s of saved) { px[s.idx] = s.ox; py[s.idx] = s.oy; occ.set(key(s.ox, s.oy), s.idx); }
            }
        }

        function render() {
            const W = canvas.width, H = canvas.height;
            ctx.fillStyle = '#101022';
            ctx.fillRect(0, 0, W, H);

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (let i = 0; i < n; i++) {
                if (px[i] < minX) minX = px[i];
                if (px[i] > maxX) maxX = px[i];
                if (py[i] < minY) minY = py[i];
                if (py[i] > maxY) maxY = py[i];
            }
            const pad = 40;
            const spanX = maxX - minX, spanY = maxY - minY;
            const cell = Math.min((W - 2 * pad) / (spanX + 1), (H - 2 * pad) / (spanY + 1), 40);
            const ox = (W - spanX * cell) / 2 - minX * cell;
            const oy = (H - spanY * cell) / 2 - minY * cell;
            const sx = i => ox + px[i] * cell;
            const sy = i => oy + py[i] * cell;

            // non-bonded H-H contacts (the hydrophobic core) as glowing links
            ctx.lineWidth = Math.max(2, cell * 0.16);
            ctx.strokeStyle = 'rgba(246, 167, 35, 0.4)';
            for (let i = 0; i < n; i++) {
                if (seq[i] !== 1) continue;
                for (const [dx, dy] of [[1, 0], [0, 1]]) {
                    const j = occ.get(key(px[i] + dx, py[i] + dy));
                    if (j === undefined || seq[j] !== 1 || Math.abs(i - j) < 2) continue;
                    ctx.beginPath();
                    ctx.moveTo(sx(i), sy(i));
                    ctx.lineTo(sx(j), sy(j));
                    ctx.stroke();
                }
            }

            // backbone
            ctx.lineWidth = Math.max(2, cell * 0.18);
            ctx.strokeStyle = 'rgba(226, 228, 255, 0.32)';
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                if (i === 0) ctx.moveTo(sx(i), sy(i));
                else ctx.lineTo(sx(i), sy(i));
            }
            ctx.stroke();

            // residues
            const r = Math.max(3, cell * 0.34);
            for (let i = 0; i < n; i++) {
                const isH = seq[i] === 1;
                ctx.beginPath();
                ctx.arc(sx(i), sy(i), r, 0, Math.PI * 2);
                if (isH) {
                    ctx.shadowColor = COL_H;
                    ctx.shadowBlur = cell * 0.5;
                    ctx.fillStyle = COL_H;
                } else {
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = COL_P;
                }
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        function renderSpark() {
            const W = spark.width, H = spark.height;
            sctx.clearRect(0, 0, W, H);
            if (history.length < 2) return;
            let lo = Infinity, hi = -Infinity;
            for (const v of history) { if (v < lo) lo = v; if (v > hi) hi = v; }
            if (hi === lo) hi = lo + 1;
            sctx.strokeStyle = '#8cdcff';
            sctx.lineWidth = 1.5;
            sctx.beginPath();
            for (let i = 0; i < history.length; i++) {
                const x = (i / (history.length - 1)) * W;
                const yv = H - ((history[i] - lo) / (hi - lo)) * (H - 4) - 2;
                if (i === 0) sctx.moveTo(x, yv);
                else sctx.lineTo(x, yv);
            }
            sctx.stroke();
        }

        const session = { rafId: 0, running: true, sinceStats: 0 };

        function frame() {
            if (!session.running) return;
            const p = paramsRef.current;

            if (pendingRef.current) {
                initFold(pendingRef.current.seq, pendingRef.current.resetBest);
                pendingRef.current = null;
            }

            if (!p.paused) {
                const sweeps = p.speed;
                for (let s = 0; s < sweeps; s++) {
                    // first a slow cool-down, then gentle reheat/cool cycles that
                    // keep escaping local minima while bestEnergy records the deepest
                    let T;
                    if (annealSweep < ANNEAL_SWEEPS) {
                        T = TMAX * Math.pow(TMIN / TMAX, annealSweep / ANNEAL_SWEEPS);
                    } else {
                        const frac = ((annealSweep - ANNEAL_SWEEPS) % CYCLE) / CYCLE;
                        T = TMAX_CYC * Math.pow(TMIN / TMAX_CYC, frac);
                    }
                    for (let a = 0; a < n; a++) attempt(T);
                    attemptPivot(T);
                    attemptPivot(T);
                    statsRef.current.temp = T;
                    annealSweep += 1;
                }
                statsRef.current.energy = -contacts;
                statsRef.current.best = bestEnergy;
                statsRef.current.contacts = contacts;
                statsRef.current.sweeps = Math.round(annealSweep);
                if (bestEnergy < prevBest - 1e-9) { bestFlash = 12; prevBest = bestEnergy; }
                if (bestFlash > 0) bestFlash -= 1;
                history.push(-contacts);
                if (history.length > 160) history.shift();
            }

            render();
            renderSpark();

            session.sinceStats += 1;
            if (session.sinceStats >= 8) {
                session.sinceStats = 0;
                const nar = foldNarration(statsRef.current.temp, bestFlash > 0);
                statsRef.current.phase = nar.key;
                statsRef.current.narration = nar.text;
                setStats({ ...statsRef.current });
            }
            session.rafId = requestAnimationFrame(frame);
        }

        let currentSeqStr = SEQUENCES[0].hp;

        // expose controls + test hook
        canvas._fold = {
            setSeq: (s, resetBest) => { currentSeqStr = s; pendingRef.current = { seq: s, resetBest }; },
            refold: () => { pendingRef.current = { seq: currentSeqStr, resetBest: false }; },
            state: () => ({
                n, seq: Array.from(seq), px: Array.from(px), py: Array.from(py),
                contacts, energy: -contacts, best: bestEnergy,
            }),
        };

        initFold(currentSeqStr, true);
        pendingRef.current = null;

        if (reducedMotion) {
            session.running = false;
            for (let s = 0; s < ANNEAL_SWEEPS; s++) {
                const T = TMAX * Math.pow(TMIN / TMAX, s / ANNEAL_SWEEPS);
                for (let a = 0; a < n; a++) attempt(T);
                attemptPivot(T);
                attemptPivot(T);
            }
            render();
            renderSpark();
            setStats({ ...statsRef.current, energy: -contacts, best: bestEnergy, contacts, temp: TMIN, sweeps: ANNEAL_SWEEPS, phase: 'cold', narration: 'Folded: the hydrophobic core is buried.' });
            return () => { canvas._fold = null; };
        }

        session.rafId = requestAnimationFrame(frame);

        const observer = new IntersectionObserver(([entry]) => {
            const was = session.running;
            session.running = entry.isIntersecting && !document.hidden;
            if (session.running && !was) session.rafId = requestAnimationFrame(frame);
        });
        observer.observe(canvas);

        const onVis = () => {
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
            canvas._fold = null;
        };
    }, []);

    function choosePreset(i) {
        setSeqIdx(i);
        setCustomErr(null);
        canvasRef.current?._fold?.setSeq(SEQUENCES[i].hp, true);
    }
    function refold() {
        canvasRef.current?._fold?.refold();
    }
    // fold a visitor-supplied H/P sequence; the input already restricts to H and
    // P, so we only gate on a sensible length
    function foldCustom() {
        const clean = customSeq.toUpperCase().replace(/[^HP]/g, '');
        if (clean.length < 6) { setCustomErr('Use at least 6 letters (H or P).'); return; }
        if (clean.length > 40) { setCustomErr('Keep it to 40 residues or fewer.'); return; }
        setCustomErr(null);
        setSeqIdx(-1);
        canvasRef.current?._fold?.setSeq(clean, true);
    }

    const energyLabel = e => (e > 0 ? `+${e}` : `${e}`);

    return (
        <section className={`section ${styles.folding}`} id="folding">
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Live Demo · Computational Biology</span>
                    <h2 className="section-header__title">Watch a Protein Fold</h2>
                    <p className="section-header__description">
                        A protein is a chain that folds itself into one precise shape, and that
                        shape decides what it does. This is the HP lattice model: each residue is
                        either water-fearing (H) or water-loving (P), and the chain searches for
                        the fold that buries the most H residues together. Simulated annealing
                        drives the hunt. You are watching the hydrophobic collapse that starts
                        every real fold.
                    </p>
                </div>

                <div className={styles.controls}>
                    {SEQUENCES.map((s, i) => (
                        <button
                            key={s.name}
                            className={`${styles.pill} ${seqIdx === i ? styles.pillActive : ''}`}
                            onClick={() => choosePreset(i)}
                            title={s.note}
                        >
                            {s.name}
                        </button>
                    ))}
                    <button className={styles.pill} onClick={refold}>Refold</button>
                    <button
                        className={`${styles.pill} ${paused ? styles.pillActive : ''}`}
                        onClick={() => setPaused(v => !v)}
                    >
                        {paused ? 'Play' : 'Pause'}
                    </button>
                </div>

                <div className={styles.customRow}>
                    <label className={styles.customLabel} htmlFor="hp-input">Fold your own:</label>
                    <input
                        id="hp-input"
                        className={styles.customInput}
                        type="text"
                        placeholder="e.g. HHPPHPPHPH"
                        value={customSeq}
                        onChange={e => setCustomSeq(e.target.value.toUpperCase().replace(/[^HP]/g, '').slice(0, 40))}
                        onKeyDown={e => { if (e.key === 'Enter') foldCustom(); }}
                        aria-label="Custom H and P sequence"
                        maxLength={40}
                    />
                    <button className={styles.pill} onClick={foldCustom}>Fold this</button>
                    {customErr
                        ? <span className={styles.customErr}>{customErr}</span>
                        : <span className={styles.customHint}>H = water-fearing, P = water-loving</span>}
                </div>

                <div className={styles.lab}>
                    <div className={styles.stagePanel}>
                        <canvas ref={canvasRef} width={720} height={520} className={styles.canvas} aria-label="A protein chain folding on a lattice to minimize energy" />
                        <div className={styles.narration} data-phase={stats.phase}>
                            <span className={styles.narrationDot} aria-hidden="true" />
                            <span className={styles.narrationText}>{stats.narration}</span>
                        </div>
                    </div>

                    <div className={styles.side}>
                        <div className={styles.readouts}>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>Energy</span>
                                <span className={styles.statValue}>{energyLabel(stats.energy)}</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>Best found</span>
                                <span className={`${styles.statValue} ${styles.statBest}`}>{energyLabel(stats.best)}</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>H-H contacts</span>
                                <span className={styles.statValue}>{stats.contacts}</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>Temperature</span>
                                <span className={styles.statValue}>{stats.temp.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className={styles.sparkWrap}>
                            <span className={styles.sparkLabel}>Energy over time</span>
                            <canvas ref={sparkRef} width={300} height={70} className={styles.spark} />
                        </div>

                        <div className={styles.legend}>
                            <span className={styles.legendItem}><i style={{ background: COL_H }} /> H · hydrophobic</span>
                            <span className={styles.legendItem}><i style={{ background: COL_P }} /> P · polar</span>
                            <span className={styles.legendItem}><i className={styles.contactSwatch} /> buried H-H contact</span>
                        </div>

                        <p className={styles.meta}>
                            {stats.len} residues · {stats.hCount} hydrophobic · {stats.sweeps.toLocaleString('en-US')} sweeps
                        </p>
                    </div>
                </div>

                <details className={styles.underHood}>
                    <summary className={styles.underHoodSummary}>
                        Under the hood: why folding is hard, and why it works anyway
                    </summary>
                    <div className={styles.underHoodBody}>
                        <ul className={styles.underHoodList}>
                            <li>
                                <strong>One sequence, one shape.</strong> Anfinsen&apos;s 1973
                                thermodynamic hypothesis: a protein&apos;s amino-acid sequence alone
                                encodes its folded structure, which sits at the free-energy minimum.
                                The HP model keeps only the single dominant force, the hydrophobic
                                effect, and still reproduces cores, surfaces, and folding
                                cooperativity (Dill, 1985; Lau &amp; Dill, 1989).
                            </li>
                            <li>
                                <strong>Levinthal&apos;s paradox.</strong> A 100-residue chain has
                                more possible shapes than there are atoms in the universe, so a
                                protein cannot find its fold by trying them all, yet real proteins
                                fold in microseconds. The resolution is a funneled energy
                                landscape: each favorable contact steers the search downhill,
                                which is exactly what the annealing here is exploiting.
                            </li>
                            <li>
                                <strong>The search.</strong> Metropolis Monte Carlo over the
                                standard lattice move set (end moves, corner flips, crankshafts)
                                proposes small changes and accepts energy-lowering ones always,
                                energy-raising ones with probability e^(-dE/T). Simulated annealing
                                cools T from hot to cold so the chain first explores widely, then
                                settles into a deep minimum. Every conformation stays a valid
                                self-avoiding walk.
                            </li>
                            <li>
                                <strong>A parity surprise.</strong> The square lattice is
                                bipartite, like a checkerboard, so every step flips colour and a
                                residue&apos;s colour is fixed by whether its sequence position is
                                even or odd. Two residues can only touch when they sit on opposite
                                colours, meaning their positions differ by an odd number. In a
                                strictly alternating H/P sequence every H sits at an even position,
                                so any two H&apos;s differ by an even number and can never touch,
                                giving exactly zero contacts no matter how it folds. The alphabet,
                                not just the search, sets the ceiling.
                            </li>
                            <li>
                                <strong>It is genuinely hard.</strong> Finding the true
                                lowest-energy fold in the HP model is NP-hard, proven for both the
                                2D and 3D lattices (Crescenzi et al., 1998; Berger &amp; Leighton,
                                1998). So this demo does not promise the global optimum; it shows
                                the same heuristic search that real structure-prediction pipelines
                                lean on, with the energy trace as honest evidence of progress.
                            </li>
                        </ul>
                    </div>
                </details>

                <p className={styles.footnote}>
                    The energy is computed from the equations, the search is a real optimizer, and
                    the number on screen is what it actually found. No shortcuts.
                </p>
            </div>
        </section>
    );
}
