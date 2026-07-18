'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Evolution.module.css';

/**
 * Evolution: the Wright-Fisher model of a gene under drift, selection, and
 * mutation, simulated live across many replicate populations.
 *
 * Each generation, a population of N diploid individuals (2N gene copies) is
 * rebuilt by sampling the next generation from the current allele frequency.
 * A selection coefficient s biases the sampling toward the favored allele and
 * a mutation rate feeds variation back in. Running dozens of identical
 * populations side by side makes genetic drift visible: with no selection,
 * pure chance sends some populations to fixation and others to loss, and the
 * fraction that fix equals the starting frequency.
 *
 * References: R. A. Fisher, "The Genetical Theory of Natural Selection" (1930);
 * S. Wright, "Evolution in Mendelian Populations," Genetics (1931); M. Kimura on
 * fixation probability and the neutral theory. Everything runs in your browser.
 */

const R = 44;               // replicate populations
const GMAX = 240;           // generations per run
const G_PER_FRAME = 1;
const HOLD_FRAMES = 70;

const PRESETS = [
    { name: 'Pure drift', N: 30, s: 0, mu: 0, p0: 0.5, note: 'no selection, chance alone' },
    { name: 'Weak selection', N: 200, s: 0.03, mu: 0, p0: 0.1, note: 'selection nudges, drift still matters' },
    { name: 'Strong selection', N: 200, s: 0.2, mu: 0, p0: 0.05, note: 'a favored allele sweeps to fixation' },
    { name: 'Mutation + drift', N: 50, s: 0, mu: 0.01, p0: 0.5, note: 'mutation keeps variation alive' },
];

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function binom(n, p, rng) {
    if (p <= 0) return 0;
    if (p >= 1) return n;
    let c = 0;
    for (let i = 0; i < n; i++) if (rng() < p) c++;
    return c;
}

// one Wright-Fisher generation: selection, then mutation, then binomial sampling
function oneGen(p, N, s, mu, rng) {
    const twoN = 2 * N;
    let p1 = (p * (1 + s)) / (1 + p * s); // allelic selection, favored fitness 1 + s
    if (!Number.isFinite(p1)) p1 = p;
    let p2 = p1 * (1 - mu) + (1 - p1) * mu; // symmetric mutation
    p2 = Math.max(0, Math.min(1, p2));
    return binom(twoN, p2, rng) / twoN;
}

const COL_SEG = 'rgba(157,141,240,0.42)';
const COL_FIX = 'rgba(246,167,35,0.6)';
const COL_LOST = 'rgba(120,139,212,0.26)';

const EVO_START_NARRATION = 'Pure drift: with no selection, chance alone decides each fate.';

// a short caption contrasting the two forces at the current settings
function evoNarration(s, mu) {
    if (mu > 0.0005 && Math.abs(s) < 0.005) return { key: 'mut', text: 'Mutation keeps feeding variation, so populations rarely fix for good.' };
    if (s >= 0.1) return { key: 'strong', text: 'Strong selection: the favored allele sweeps toward fixation.' };
    if (s > 0.005) return { key: 'weak', text: 'Weak selection nudges the odds, but drift still scatters the outcomes.' };
    if (s < -0.005) return { key: 'against', text: 'Selection pushes against this allele, yet drift can still fix it by chance.' };
    return { key: 'drift', text: 'Pure drift: with no selection, chance alone decides each fate.' };
}

export default function Evolution() {
    const canvasRef = useRef(null);
    const paramsRef = useRef({ N: PRESETS[0].N, s: PRESETS[0].s, mu: PRESETS[0].mu, p0: PRESETS[0].p0 });
    const restartRef = useRef(true);
    const selectedRef = useRef(-1);
    const statsRef = useRef({ gen: 0, fixed: 0, lost: 0, seg: R, meanP: PRESETS[0].p0, het: 0, selIdx: -1, selP: -1, selFate: 'none', phase: 'drift', narration: EVO_START_NARRATION });

    const [presetName, setPresetName] = useState('Pure drift');
    const [N, setN] = useState(PRESETS[0].N);
    const [s, setS] = useState(PRESETS[0].s);
    const [mu, setMu] = useState(PRESETS[0].mu);
    const [p0, setP0] = useState(PRESETS[0].p0);
    const [stats, setStats] = useState({ gen: 0, fixed: 0, lost: 0, seg: R, meanP: PRESETS[0].p0, het: 0, selIdx: -1, selP: -1, selFate: 'none', phase: 'drift', narration: EVO_START_NARRATION });

    useEffect(() => {
        paramsRef.current = { N, s, mu, p0 };
        restartRef.current = true;
    }, [N, s, mu, p0]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let pops = new Float64Array(R);
        let hist = Array.from({ length: R }, () => []);
        let generation = 0;
        let runSeed = 20260709;
        let rng = mulberry32(runSeed);
        let hold = 0;

        function initPops() {
            const { p0: start } = paramsRef.current;
            runSeed = (runSeed + 0x9e3779b1) | 0;
            rng = mulberry32(runSeed);
            hist = Array.from({ length: R }, () => [start]);
            for (let r = 0; r < R; r++) pops[r] = start;
            generation = 0;
            hold = 0;
        }

        function absorbed() {
            const { mu: m } = paramsRef.current;
            if (m > 0) return false;
            for (let r = 0; r < R; r++) if (pops[r] > 0 && pops[r] < 1) return false;
            return true;
        }

        function computeStats() {
            let fixed = 0, lost = 0, sum = 0, het = 0;
            for (let r = 0; r < R; r++) {
                const p = pops[r];
                if (p >= 1) fixed++;
                else if (p <= 0) lost++;
                sum += p;
                het += 2 * p * (1 - p);
            }
            const { s: sc, mu: m } = paramsRef.current;
            const sel = selectedRef.current;
            let selP = -1, selFate = 'none';
            if (sel >= 0 && sel < R) {
                selP = pops[sel];
                selFate = selP >= 1 ? 'fixed' : selP <= 0 ? 'lost' : 'still segregating';
            }
            const nar = evoNarration(sc, m);
            statsRef.current = {
                gen: generation, fixed, lost, seg: R - fixed - lost,
                meanP: sum / R, het: het / R,
                selIdx: sel, selP, selFate, phase: nar.key, narration: nar.text,
            };
        }

        // expose a deterministic batch simulator for the correctness test
        canvas._wf = {
            simulate: ({ N: n, s: sc, mu: m, p0: start, reps, gens }) => {
                const r2 = mulberry32(777);
                let fixed = 0, lost = 0, sumFinal = 0, inRange = true, finite = true;
                for (let i = 0; i < reps; i++) {
                    let p = start;
                    for (let g = 0; g < gens; g++) {
                        p = oneGen(p, n, sc, m, r2);
                        if (!Number.isFinite(p)) { finite = false; break; }
                        if (p < 0 || p > 1) inRange = false;
                        if (m === 0 && (p === 0 || p === 1)) break;
                    }
                    if (p >= 1) fixed++; else if (p <= 0) lost++;
                    sumFinal += p;
                }
                return { meanFinalP: sumFinal / reps, fixedFraction: fixed / reps, lostFraction: lost / reps, inRange, finite };
            },
            // nearest trajectory to a click, in data space; -1 if the click is far
            pick: (xC, yC) => {
                const W = canvas.width, H = canvas.height;
                const padL = 44, padB = 28, padT = 14, padR = 14;
                const plotW = W - padL - padR, plotH = H - padT - padB;
                const g = Math.round(((xC - padL) / plotW) * GMAX);
                const gg = Math.max(0, Math.min(hist[0].length - 1, g));
                const targetP = 1 - (yC - padT) / plotH;
                let best = -1, bestD = Infinity;
                for (let r = 0; r < R; r++) {
                    const p = hist[r][gg] ?? pops[r];
                    const d = Math.abs(p - targetP);
                    if (d < bestD) { bestD = d; best = r; }
                }
                return bestD < 0.12 ? best : -1;
            },
        };

        function draw() {
            const W = canvas.width, H = canvas.height;
            ctx.fillStyle = '#101022';
            ctx.fillRect(0, 0, W, H);
            const padL = 44, padB = 28, padT = 14, padR = 14;
            const plotW = W - padL - padR, plotH = H - padT - padB;
            const xOf = g => padL + (g / GMAX) * plotW;
            const yOf = p => padT + (1 - p) * plotH;

            // gridlines and axis labels
            ctx.strokeStyle = 'rgba(230,232,255,0.12)';
            ctx.fillStyle = 'rgba(230,232,255,0.45)';
            ctx.font = '11px ui-monospace, monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            for (const p of [0, 0.5, 1]) {
                const y = yOf(p);
                ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
                ctx.fillText(p.toFixed(1), padL - 6, y);
            }
            ctx.fillStyle = 'rgba(246,167,35,0.7)';
            ctx.textAlign = 'left';
            ctx.fillText('fixed', padL + 4, yOf(1) + 10);
            ctx.fillStyle = 'rgba(120,139,212,0.7)';
            ctx.fillText('lost', padL + 4, yOf(0) - 10);

            // trajectories, drawn lost first then segregating then fixed on top
            const order = [];
            for (let r = 0; r < R; r++) {
                const p = pops[r];
                order.push({ r, tier: p >= 1 ? 2 : p <= 0 ? 0 : 1 });
            }
            order.sort((a, b) => a.tier - b.tier);
            const sel = selectedRef.current;
            for (const { r, tier } of order) {
                if (sel >= 0 && r === sel) continue; // the followed lineage is drawn on top below
                const h = hist[r];
                ctx.globalAlpha = sel >= 0 ? 0.16 : 1;
                ctx.beginPath();
                for (let g = 0; g < h.length; g++) {
                    const x = xOf(g), y = yOf(h[g]);
                    if (g === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = tier === 2 ? COL_FIX : tier === 0 ? COL_LOST : COL_SEG;
                ctx.lineWidth = tier === 1 ? 1.4 : 1.1;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;

            // mean frequency line
            const len = hist[0].length;
            ctx.beginPath();
            for (let g = 0; g < len; g++) {
                let sum = 0;
                for (let r = 0; r < R; r++) sum += hist[r][g] ?? pops[r];
                const x = xOf(g), y = yOf(sum / R);
                if (g === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // the followed lineage, bright and on top, with a tip marker
            if (sel >= 0 && sel < R) {
                const hs = hist[sel];
                ctx.save();
                ctx.shadowColor = '#8cdcff';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                for (let g = 0; g < hs.length; g++) {
                    const x = xOf(g), y = yOf(hs[g]);
                    if (g === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = '#8cdcff';
                ctx.lineWidth = 2.6;
                ctx.stroke();
                const gEnd = hs.length - 1;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(xOf(gEnd), yOf(hs[gEnd]), 4, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        }

        const session = { rafId: 0, running: true, sinceStats: 0 };
        function frame() {
            if (!session.running) return;
            if (restartRef.current) { initPops(); restartRef.current = false; }
            const { N: n, s: sc, mu: m } = paramsRef.current;
            for (let f = 0; f < G_PER_FRAME; f++) {
                if (generation < GMAX && !absorbed()) {
                    for (let r = 0; r < R; r++) { pops[r] = oneGen(pops[r], n, sc, m, rng); hist[r].push(pops[r]); }
                    generation++;
                } else {
                    hold++;
                    if (hold > HOLD_FRAMES) restartRef.current = true;
                }
            }
            computeStats();
            draw();
            session.sinceStats += 1;
            if (session.sinceStats >= 8) { session.sinceStats = 0; setStats({ ...statsRef.current }); }
            session.rafId = requestAnimationFrame(frame);
        }

        if (reducedMotion) {
            initPops();
            const { N: n, s: sc, mu: m } = paramsRef.current;
            while (generation < GMAX && !absorbed()) {
                for (let r = 0; r < R; r++) { pops[r] = oneGen(pops[r], n, sc, m, rng); hist[r].push(pops[r]); }
                generation++;
            }
            restartRef.current = false;
            computeStats();
            draw();
            setStats({ ...statsRef.current });
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
            canvas._wf = null;
        };
    }, []);

    function choosePreset(p) {
        setPresetName(p.name);
        setN(p.N); setS(p.s); setMu(p.mu); setP0(p.p0);
        selectedRef.current = -1;
    }
    function restart() { restartRef.current = true; }

    // click a trajectory to follow that population's lineage; a click in open
    // space (far from any line) clears the selection
    function onCanvasPointerDown(e) {
        const canvas = canvasRef.current;
        if (!canvas?._wf?.pick) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
        selectedRef.current = canvas._wf.pick(x, y);
    }

    const followSuffix = stats.selIdx >= 0 && stats.selP >= 0
        ? ` Following population ${stats.selIdx + 1}: now at ${Math.round(stats.selP * 100)}%, ${stats.selFate}.`
        : '';
    const narrationFull = stats.narration + followSuffix;

    return (
        <section className={`section ${styles.evo}`} id="evolution">
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Live Demo · Computational Biology</span>
                    <h2 className="section-header__title">Watch Evolution Roll the Dice</h2>
                    <p className="section-header__description">
                        Evolution is not only survival of the fittest. In any finite population,
                        pure chance also decides which genes survive, an effect called genetic
                        drift. Here are dozens of identical populations evolving in parallel under
                        the Wright-Fisher model. Turn selection off and watch chance alone split
                        them between fixation and loss. Turn it up and watch a favored gene sweep.
                    </p>
                </div>

                <div className={styles.controls}>
                    {PRESETS.map(p => (
                        <button
                            key={p.name}
                            className={`${styles.pill} ${presetName === p.name ? styles.pillActive : ''}`}
                            onClick={() => choosePreset(p)}
                            title={p.note}
                        >
                            {p.name}
                        </button>
                    ))}
                    <button className={styles.pill} onClick={restart}>Restart</button>
                </div>

                <p className={styles.tip}>
                    Tip: click any trajectory to follow that one population&apos;s lineage, and watch
                    where chance takes it. Click empty space to let go.
                </p>

                <div className={styles.lab}>
                    <div className={styles.stagePanel}>
                        <canvas
                            ref={canvasRef}
                            width={720}
                            height={460}
                            className={styles.canvas}
                            onPointerDown={onCanvasPointerDown}
                            aria-label="Allele frequency trajectories of many populations over generations. Click a line to follow one lineage."
                        />
                        <div className={styles.narration} data-phase={stats.phase}>
                            <span className={styles.narrationDot} aria-hidden="true" />
                            <span className={styles.narrationText}>{narrationFull}</span>
                        </div>
                    </div>

                    <div className={styles.side}>
                        <div className={styles.readouts}>
                            <div className={styles.stat}><span className={styles.statLabel}>Generation</span><span className={styles.statValue}>{stats.gen}</span></div>
                            <div className={styles.stat}><span className={styles.statLabel}>Mean freq</span><span className={styles.statValue}>{stats.meanP.toFixed(2)}</span></div>
                            <div className={styles.stat}><span className={styles.statLabel}>Fixed / lost</span><span className={styles.statValue}>{stats.fixed}<small> / {stats.lost}</small></span></div>
                            <div className={styles.stat}><span className={styles.statLabel}>Heterozygosity</span><span className={styles.statValue}>{stats.het.toFixed(2)}</span></div>
                        </div>

                        <div className={styles.sliders}>
                            <label className={styles.slider}>
                                <span>population N <b>{N}</b></span>
                                <input type="range" min="10" max="300" step="10" value={N} onChange={e => { setN(parseInt(e.target.value, 10)); setPresetName('Custom'); }} />
                            </label>
                            <label className={styles.slider}>
                                <span>selection s <b>{s.toFixed(2)}</b></span>
                                <input type="range" min="-0.3" max="0.5" step="0.01" value={s} onChange={e => { setS(parseFloat(e.target.value)); setPresetName('Custom'); }} />
                            </label>
                            <label className={styles.slider}>
                                <span>mutation <b>{mu.toFixed(3)}</b></span>
                                <input type="range" min="0" max="0.02" step="0.001" value={mu} onChange={e => { setMu(parseFloat(e.target.value)); setPresetName('Custom'); }} />
                            </label>
                            <label className={styles.slider}>
                                <span>start freq <b>{p0.toFixed(2)}</b></span>
                                <input type="range" min="0.05" max="0.95" step="0.05" value={p0} onChange={e => { setP0(parseFloat(e.target.value)); setPresetName('Custom'); }} />
                            </label>
                        </div>

                        <div className={styles.legend}>
                            <span className={styles.legendItem}><i style={{ background: '#9d8df0' }} /> still segregating</span>
                            <span className={styles.legendItem}><i style={{ background: '#f6a723' }} /> fixed (reached 100%)</span>
                            <span className={styles.legendItem}><i style={{ background: '#788bd4' }} /> lost (reached 0%)</span>
                            <span className={styles.legendItem}><i style={{ background: '#ffffff', border: '1px solid #999' }} /> mean across populations</span>
                        </div>
                    </div>
                </div>

                <details className={styles.underHood}>
                    <summary className={styles.underHoodSummary}>
                        Under the hood: chance is a force of evolution too
                    </summary>
                    <div className={styles.underHoodBody}>
                        <ul className={styles.underHoodList}>
                            <li>
                                <strong>The model.</strong> The Wright-Fisher model is the standard
                                idealization of a finite population. Each generation of 2N gene
                                copies is drawn by sampling from the current allele frequency, so
                                the next frequency is a binomial random variable. Selection tilts
                                the sampling odds toward the favored allele, mutation flips a small
                                fraction of copies, and everything else is chance.
                            </li>
                            <li>
                                <strong>Drift is not noise, it is a force.</strong> With selection
                                off, the mean frequency across populations stays put, but each
                                individual population wanders until it hits 0 or 1 and sticks. The
                                probability a neutral allele eventually fixes is exactly its
                                starting frequency, which you can read off the demo: set selection
                                to zero and the fraction of populations that fix matches the start
                                frequency slider.
                            </li>
                            <li>
                                <strong>Smaller populations lose variation faster.</strong> The
                                heterozygosity readout, the chance that two random copies differ,
                                decays at a rate set by the population size (about 1 over 2N per
                                generation). Shrink N and watch the populations fix quickly and the
                                variation collapse. This is why small and bottlenecked populations
                                lose diversity, a central concern in conservation genetics.
                            </li>
                            <li>
                                <strong>Selection versus drift.</strong> A beneficial allele is not
                                guaranteed to win. Fixation probability rises with the selection
                                coefficient but stays well below one for weak selection in a small
                                population, which is the tension Fisher (1930), Wright (1931), and
                                later Kimura formalized. Nudge s upward and watch the cloud bend
                                from a random spread into a confident sweep.
                            </li>
                        </ul>
                    </div>
                </details>

                <p className={styles.footnote}>
                    Real binomial sampling, real selection and mutation, a seeded generator so a
                    given setting always plays out the same way. The dice are honest.
                </p>
            </div>
        </section>
    );
}
