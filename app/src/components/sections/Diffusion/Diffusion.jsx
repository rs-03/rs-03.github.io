'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Diffusion.module.css';

/**
 * Diffusion: watch pure noise denoise into a shape, one reverse step at a time.
 *
 * This runs the exact reverse process of a denoising diffusion model (DDPM).
 * A cloud of particles starts as Gaussian noise. At every step we ask, "given
 * where this particle is now, what did the clean data probably look like?",
 * nudge it that way, and add a little noise back, exactly the ancestral
 * sampling rule from Ho, Jain and Abbeel (2020).
 *
 * The one honest simplification: because our target is a known set of points,
 * the denoiser, the score of the noised distribution, has a closed form (the
 * noised mixture is itself a mixture of Gaussians). Real image models cannot
 * write that formula down, so they train a large U-Net to estimate this same
 * score from data. The sampling math you are watching is identical; only the
 * source of the score differs.
 *
 * Lineage: Sohl-Dickstein et al. (2015) cast generation as reversing a
 * diffusion; Ho et al. (2020) made it work as DDPM; Song and Ermon (2019) and
 * Song et al. (2021) framed the same idea as learning the score of the data.
 */

const T = 80;                 // reverse steps from pure noise to data
const HOLD_FRAMES = 90;       // linger on the finished shape before looping
const TARGET_STD = 0.62;      // data scaled to ~unit variance, the DDPM prior
const EPS = 1e-7;

const PRESETS = [
    { key: 'ai', name: '"AI"', note: 'noise resolves into the letters A and I' },
    { key: 'heart', name: 'Heart', note: 'a classic parametric curve' },
    { key: 'spiral', name: 'Spiral', note: 'a two-arm Archimedean spiral' },
    { key: 'moons', name: 'Two moons', note: 'the two-moons benchmark' },
];

const BG = '#0c0c1a';
const PARTICLE = '#8cdcff';

// --- target point clouds (normalized centrally after generation) -----------

function sampleText(str) {
    const w = 260, h = 150;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.font = '700 110px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(str, w / 2, h / 2 + 4);
    const data = g.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
            if (data[(y * w + x) * 4] > 128) pts.push([x, -y]);
        }
    }
    return pts;
}

function sampleHeart(m) {
    const pts = [];
    for (let i = 0; i < m; i++) {
        const t = (i / m) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3;
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const jr = 0.9;
        pts.push([x + (Math.random() - 0.5) * jr, y + (Math.random() - 0.5) * jr]);
    }
    return pts;
}

function sampleSpiral(m) {
    const pts = [];
    for (let i = 0; i < m; i++) {
        const arm = i % 2 === 0 ? 0 : Math.PI;
        const t = (i / m) * 3.2 * Math.PI;
        const r = 0.35 + t * 0.5;
        const jitter = (Math.random() - 0.5) * 0.25;
        pts.push([(r + jitter) * Math.cos(t + arm), (r + jitter) * Math.sin(t + arm)]);
    }
    return pts;
}

function sampleMoons(m) {
    const pts = [];
    for (let i = 0; i < m; i++) {
        const t = Math.PI * (i / m);
        const j = () => (Math.random() - 0.5) * 0.18;
        if (i % 2 === 0) pts.push([Math.cos(t) + j(), Math.sin(t) + j()]);
        else pts.push([1 - Math.cos(t) + j(), 0.5 - Math.sin(t) + j()]);
    }
    return pts;
}

function buildTarget(key) {
    let raw;
    if (key === 'ai') raw = sampleText('AI');
    else if (key === 'heart') raw = sampleHeart(260);
    else if (key === 'spiral') raw = sampleSpiral(260);
    else raw = sampleMoons(260);

    // cap the count so the per-step cost stays predictable, then normalize to
    // zero mean and ~unit spread so the noise prior N(0, I) is well matched.
    const MAXP = 260;
    if (raw.length > MAXP) {
        for (let i = raw.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            const tmp = raw[i]; raw[i] = raw[j]; raw[j] = tmp;
        }
        raw = raw.slice(0, MAXP);
    }
    let mx = 0, my = 0;
    for (const p of raw) { mx += p[0]; my += p[1]; }
    mx /= raw.length; my /= raw.length;
    let v = 0;
    for (const p of raw) { v += (p[0] - mx) ** 2 + (p[1] - my) ** 2; }
    const std = Math.sqrt(v / (2 * raw.length)) || 1;
    const s = TARGET_STD / std;
    const tx = new Float32Array(raw.length);
    const ty = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        tx[i] = (raw[i][0] - mx) * s;
        ty[i] = (raw[i][1] - my) * s;
    }
    return { tx, ty, m: raw.length };
}

// cosine noise schedule (Nichol and Dhariwal, 2021): smooth, robust cumulative
// alpha-bar from 1 (clean) down to nearly 0 (pure noise).
function buildSchedule() {
    const abar = new Float64Array(T + 1);
    const s = 0.008;
    const f0 = Math.cos((s / (1 + s)) * Math.PI / 2) ** 2;
    for (let t = 0; t <= T; t++) {
        const ft = Math.cos(((t / T + s) / (1 + s)) * Math.PI / 2) ** 2;
        abar[t] = ft / f0;
    }
    return abar;
}

export default function Diffusion() {
    const canvasRef = useRef(null);
    const sparkRef = useRef(null);
    const paramsRef = useRef({ paused: false, speed: 1 });
    const pendingRef = useRef({ preset: 'ai', restart: true });
    const statsRef = useRef({ step: T, spread: 1, progress: 0, particles: 0 });

    const [presetIdx, setPresetIdx] = useState(0);
    const [paused, setPaused] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [stats, setStats] = useState({ step: T, spread: 1, progress: 0, particles: 0 });

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

        const N = window.innerWidth < 720 ? 620 : 1000; // particle count (perf guard)
        const abar = buildSchedule();

        // diffusion state (closure)
        let target = buildTarget('ai');
        let wScratch = new Float32Array(target.m);
        const pxr = new Float32Array(N);
        const pyr = new Float32Array(N);
        let t = T;            // current noise level, counts down to 0
        let hold = 0;
        let history = [];
        let spare = null;     // cached second gaussian from Box-Muller

        function randn() {
            if (spare !== null) { const s = spare; spare = null; return s; }
            let u = 0, v = 0, s = 0;
            do {
                u = Math.random() * 2 - 1;
                v = Math.random() * 2 - 1;
                s = u * u + v * v;
            } while (s >= 1 || s === 0);
            const f = Math.sqrt(-2 * Math.log(s) / s);
            spare = v * f;
            return u * f;
        }

        function seedNoise() {
            for (let i = 0; i < N; i++) { pxr[i] = randn(); pyr[i] = randn(); }
            t = T;
            hold = 0;
            history = [];
        }

        function setTarget(key) {
            target = buildTarget(key);
            wScratch = new Float32Array(target.m);
        }

        // one exact DDPM ancestral step from noise level t down to t-1
        function reverseStep() {
            if (t <= 0) return;
            const abT = abar[t];
            const abTm1 = abar[t - 1];
            const oneMinusAbT = Math.max(1 - abT, EPS);
            const alphaT = abT / abTm1;
            let betaT = 1 - alphaT;
            if (betaT < 1e-6) betaT = 1e-6;
            if (betaT > 0.999) betaT = 0.999;
            const sqrtAbT = Math.sqrt(abT);
            const sqrtAbTm1 = Math.sqrt(abTm1);
            const sqrtAlphaT = Math.sqrt(alphaT);
            const coefX0 = (sqrtAbTm1 * betaT) / oneMinusAbT;
            const coefXt = (sqrtAlphaT * (1 - abTm1)) / oneMinusAbT;
            const postStd = Math.sqrt(Math.max((betaT * (1 - abTm1)) / oneMinusAbT, 0));
            const invScale = 1 / (2 * oneMinusAbT);
            const tx = target.tx, ty = target.ty, m = target.m;
            const w = wScratch;

            for (let i = 0; i < N; i++) {
                const xi = pxr[i], yi = pyr[i];
                // logits of the posterior over target points, softmax-stabilized
                let maxLog = -Infinity;
                for (let k = 0; k < m; k++) {
                    const dx = xi - sqrtAbT * tx[k];
                    const dy = yi - sqrtAbT * ty[k];
                    const lg = -(dx * dx + dy * dy) * invScale;
                    w[k] = lg;
                    if (lg > maxLog) maxLog = lg;
                }
                let sum = 0, ex = 0, ey = 0;
                for (let k = 0; k < m; k++) {
                    const e = Math.exp(w[k] - maxLog);
                    sum += e;
                    ex += e * tx[k];
                    ey += e * ty[k];
                }
                // x0hat = posterior mean of the clean data = E[x0 | xt]
                const x0x = ex / sum;
                const x0y = ey / sum;
                let nx = coefX0 * x0x + coefXt * xi;
                let ny = coefX0 * x0y + coefXt * yi;
                if (postStd > 0 && t > 1) {
                    nx += postStd * randn();
                    ny += postStd * randn();
                }
                pxr[i] = nx;
                pyr[i] = ny;
            }
            t -= 1;
        }

        function cloudSpread() {
            let mx = 0, my = 0;
            for (let i = 0; i < N; i++) { mx += pxr[i]; my += pyr[i]; }
            mx /= N; my /= N;
            let v = 0;
            for (let i = 0; i < N; i++) { v += (pxr[i] - mx) ** 2 + (pyr[i] - my) ** 2; }
            return Math.sqrt(v / (2 * N));
        }

        function render() {
            const W = canvas.width, H = canvas.height;
            ctx.fillStyle = BG;
            ctx.fillRect(0, 0, W, H);

            const pad = 42;
            const R = 2.05; // data half-range shown
            const sc = Math.min((W - 2 * pad) / (2 * R), (H - 2 * pad) / (2 * R));
            const sx = x => W / 2 + x * sc;
            const sy = y => H / 2 - y * sc;

            // ghost of the target so the destination is always legible
            ctx.fillStyle = 'rgba(157, 141, 240, 0.22)';
            for (let k = 0; k < target.m; k++) {
                ctx.beginPath();
                ctx.arc(sx(target.tx[k]), sy(target.ty[k]), 1.6, 0, Math.PI * 2);
                ctx.fill();
            }

            // particles, drawn additively so overlap on the shape glows bright
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = PARTICLE;
            const done = 1 - t / T;
            const rad = 1.5 + done * 0.6;
            ctx.globalAlpha = 0.5;
            for (let i = 0; i < N; i++) {
                ctx.beginPath();
                ctx.arc(sx(pxr[i]), sy(pyr[i]), rad, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
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

        function pushStats() {
            statsRef.current.step = t;
            statsRef.current.spread = cloudSpread();
            statsRef.current.progress = 1 - t / T;
            statsRef.current.particles = N;
        }

        const session = { rafId: 0, running: true, sinceStats: 0 };
        let frozen = false; // test affordance: hold the current frame exactly

        function frame() {
            if (!session.running) return;
            if (frozen) { session.rafId = requestAnimationFrame(frame); return; }
            const p = paramsRef.current;

            if (pendingRef.current) {
                if (pendingRef.current.preset) setTarget(pendingRef.current.preset);
                seedNoise();
                pendingRef.current = null;
            }

            if (!p.paused) {
                if (t > 0) {
                    const steps = Math.max(1, p.speed | 0);
                    for (let s = 0; s < steps && t > 0; s++) reverseStep();
                    pushStats();
                    history.push(statsRef.current.spread);
                    if (history.length > 160) history.shift();
                } else {
                    hold += 1;
                    if (hold > HOLD_FRAMES) seedNoise();
                }
            }

            render();
            renderSpark();

            session.sinceStats += 1;
            if (session.sinceStats >= 4) {
                session.sinceStats = 0;
                setStats({ ...statsRef.current });
            }
            session.rafId = requestAnimationFrame(frame);
        }

        // test + control hook: run the whole reverse process and report whether
        // the cloud actually collapsed onto the target (the honest correctness gate)
        canvas._diffusion = {
            setPreset: key => { pendingRef.current = { preset: key, restart: true }; },
            restart: () => { pendingRef.current = { preset: null, restart: true }; },
            freeze: () => { frozen = true; },
            unfreeze: () => { frozen = false; },
            state: () => ({ step: t, spread: cloudSpread(), particles: N, targetPts: target.m }),
            targetPoints: () => ({ tx: Array.from(target.tx), ty: Array.from(target.ty) }),
            settle: (key) => {
                if (key) setTarget(key);
                seedNoise();
                const startSpread = cloudSpread();
                while (t > 0) reverseStep();
                // mean nearest-neighbor distance from a particle sample to the target
                let acc = 0, cnt = 0;
                for (let i = 0; i < N; i += 7) {
                    let best = Infinity;
                    for (let k = 0; k < target.m; k++) {
                        const dx = pxr[i] - target.tx[k];
                        const dy = pyr[i] - target.ty[k];
                        const d = dx * dx + dy * dy;
                        if (d < best) best = d;
                    }
                    acc += Math.sqrt(best); cnt++;
                }
                let finite = true;
                for (let i = 0; i < N; i++) {
                    if (!Number.isFinite(pxr[i]) || !Number.isFinite(pyr[i])) { finite = false; break; }
                }
                const out = {
                    finite,
                    startSpread,
                    endSpread: cloudSpread(),
                    targetSpread: TARGET_STD,
                    meanNearest: acc / cnt,
                };
                render();
                return out;
            },
        };

        seedNoise();
        pendingRef.current = null;

        if (reducedMotion) {
            session.running = false;
            while (t > 0) reverseStep();
            pushStats();
            render();
            const snap = { ...statsRef.current };
            setTimeout(() => setStats(snap), 0);
            return () => { canvas._diffusion = null; };
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
            canvas._diffusion = null;
        };
    }, []);

    function choosePreset(i) {
        setPresetIdx(i);
        canvasRef.current?._diffusion?.setPreset(PRESETS[i].key);
    }
    function restart() {
        canvasRef.current?._diffusion?.restart();
    }

    const stepShown = Math.max(0, stats.step);

    return (
        <section className={`section ${styles.diffusion}`} id="diffusion">
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Live Demo · Generative Models</span>
                    <h2 className="section-header__title">Watch Noise Become a Shape</h2>
                    <p className="section-header__description">
                        This is how image generators actually work, shrunk to two dimensions so it
                        runs in your tab. A cloud of pure noise is denoised one step at a time until
                        it lands on a target. Each step asks the same question a diffusion model
                        asks: given this noisy point, what did the clean data probably look like?
                    </p>
                </div>

                <div className={styles.controls}>
                    {PRESETS.map((p, i) => (
                        <button
                            key={p.key}
                            className={`${styles.pill} ${presetIdx === i ? styles.pillActive : ''}`}
                            onClick={() => choosePreset(i)}
                            title={p.note}
                        >
                            {p.name}
                        </button>
                    ))}
                    <button className={styles.pill} onClick={restart}>Re-noise</button>
                    <button
                        className={`${styles.pill} ${paused ? styles.pillActive : ''}`}
                        onClick={() => setPaused(v => !v)}
                    >
                        {paused ? 'Play' : 'Pause'}
                    </button>
                    <button
                        className={`${styles.pill} ${speed === 2 ? styles.pillActive : ''}`}
                        onClick={() => setSpeed(v => (v === 2 ? 1 : 2))}
                        title="Take two reverse steps per frame"
                    >
                        {speed === 2 ? 'Fast' : 'Slow'}
                    </button>
                </div>

                <div className={styles.lab}>
                    <div className={styles.stagePanel}>
                        <canvas
                            ref={canvasRef}
                            width={720}
                            height={520}
                            className={styles.canvas}
                            aria-label="A cloud of noise particles denoising into a target shape via reverse diffusion"
                        />
                    </div>

                    <div className={styles.side}>
                        <div className={styles.progressWrap}>
                            <div className={styles.progressHead}>
                                <span className={styles.progressLabel}>Denoising</span>
                                <span className={styles.progressVal}>{Math.round(stats.progress * 100)}%</span>
                            </div>
                            <div className={styles.progressTrack}>
                                <div className={styles.progressFill} style={{ width: `${stats.progress * 100}%` }} />
                            </div>
                        </div>

                        <div className={styles.readouts}>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>Noise level t</span>
                                <span className={styles.statValue}>{stepShown}<span className={styles.statSub}>/{T}</span></span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>Cloud spread</span>
                                <span className={styles.statValue}>{stats.spread.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className={styles.sparkWrap}>
                            <span className={styles.sparkLabel}>Spread over time</span>
                            <canvas ref={sparkRef} width={300} height={70} className={styles.spark} />
                        </div>

                        <div className={styles.legend}>
                            <span className={styles.legendItem}><i style={{ background: PARTICLE }} /> denoising particles</span>
                            <span className={styles.legendItem}><i style={{ background: '#9d8df0' }} /> target the noise is pulled toward</span>
                        </div>

                        <p className={styles.meta}>
                            {stats.particles.toLocaleString('en-US')} particles · {T}-step schedule · exact DDPM sampler
                        </p>
                    </div>
                </div>

                <div className={styles.disclaimer}>
                    <span className={styles.disclaimerIcon} aria-hidden="true">⚙️</span>
                    <p>
                        <strong>A note on compute.</strong> This is deliberately a two-dimensional
                        toy so it stays smooth in a browser. Real image diffusion (Stable Diffusion,
                        DALL-E, Imagen) runs this same reverse process over millions of pixels with a
                        large neural network at every step, which needs a GPU and seconds to minutes
                        per image. The math on screen is the real thing; only the scale is small. On
                        an older laptop this demo does genuine per-particle work each frame, so if the
                        fan spins up, hit Pause.
                    </p>
                </div>

                <details className={styles.underHood}>
                    <summary className={styles.underHoodSummary}>
                        Under the hood: the reverse process, and where the neural net normally goes
                    </summary>
                    <div className={styles.underHoodBody}>
                        <ul className={styles.underHoodList}>
                            <li>
                                <strong>Forward is easy, reverse is the trick.</strong> Adding noise to
                                data is trivial: after enough steps anything becomes a formless Gaussian
                                blob. Generation runs that film backward. Sohl-Dickstein et al. (2015)
                                showed that if you can undo one small step of noising, you can walk all
                                the way from noise back to data.
                            </li>
                            <li>
                                <strong>Each step predicts the clean data.</strong> The optimal denoiser
                                at noise level t is the posterior mean E[x0 | xt], a weighted average of
                                the possible clean points, with nearer points weighted more heavily. We
                                take that estimate, step toward it, and add back a precise amount of
                                noise. That is exactly the DDPM update of Ho, Jain and Abbeel (2020).
                            </li>
                            <li>
                                <strong>The score, in closed form here.</strong> Because our target is a
                                fixed set of points, the noised distribution is a mixture of Gaussians,
                                so its gradient, the score that points toward data, is a formula, not a
                                guess. Song and Ermon (2019) and Song et al. (2021) showed diffusion is
                                equivalent to learning this score.
                            </li>
                            <li>
                                <strong>Where the U-Net lives.</strong> Swap our point cloud for the set
                                of all natural images and the score has no formula. That is the one and
                                only job of the giant network in a real diffusion model: estimate this
                                score from data. Everything else you are watching, the schedule, the
                                posterior step, the added noise, stays the same.
                            </li>
                            <li>
                                <strong>Watch the spread.</strong> The trace tracks how tightly the cloud
                                is packed. It starts wide as pure noise and shrinks as particles commit
                                to the shape, a direct, honest readout that generation is converging
                                rather than a canned animation.
                            </li>
                        </ul>
                    </div>
                </details>

                <p className={styles.footnote}>
                    The schedule, the posterior mean, and the noise added at each step are computed
                    from the DDPM equations. The particles land where the math sends them. No
                    pre-rendered frames.
                </p>
            </div>
        </section>
    );
}
