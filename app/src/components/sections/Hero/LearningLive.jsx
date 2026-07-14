'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './LearningLive.module.css';

/**
 * Live neural network training in the hero, shown as the network itself.
 *
 * A small 2-8-8-1 MLP (tanh hidden layers, sigmoid output, momentum SGD)
 * trains on a 2D toy dataset in a requestAnimationFrame loop. The network
 * is drawn as a graph: edges thicken and brighten as weights grow, a pulse
 * of activation sweeps left to right on every forward pass, and a small
 * inset shows the points being classified. Pure JavaScript, no libraries,
 * hand-written backprop.
 */

const DATASETS = ['spirals', 'moons', 'rings'];
const POINTS_PER_CLASS = 90;
const HIDDEN = 8;
const LR = 0.07;
const MOMENTUM = 0.9;
const STEPS_PER_FRAME = 4;
const CANVAS_W = 480;
const CANVAS_H = 360;

/* ---------- data ---------- */

function makeDataset(kind, rand) {
    const xs = [];
    const ys = [];
    const noise = () => (rand() - 0.5) * 0.14;

    for (let c = 0; c < 2; c++) {
        for (let i = 0; i < POINTS_PER_CLASS; i++) {
            const t = i / POINTS_PER_CLASS;
            let x;
            let y;
            if (kind === 'spirals') {
                const r = 0.1 + t * 0.82;
                const angle = t * 2.4 * Math.PI + c * Math.PI;
                x = r * Math.sin(angle) + noise();
                y = r * Math.cos(angle) + noise();
            } else if (kind === 'moons') {
                const angle = t * Math.PI;
                if (c === 0) {
                    x = Math.cos(angle) * 0.7 - 0.18 + noise();
                    y = Math.sin(angle) * 0.7 - 0.25 + noise();
                } else {
                    x = 0.18 - Math.cos(angle) * 0.7 + noise();
                    y = 0.25 - Math.sin(angle) * 0.7 + noise();
                }
            } else {
                const angle = rand() * 2 * Math.PI;
                const r = c === 0 ? 0.12 + rand() * 0.24 : 0.62 + rand() * 0.28;
                x = r * Math.cos(angle) + noise() * 0.5;
                y = r * Math.sin(angle) + noise() * 0.5;
            }
            xs.push([x, y]);
            ys.push(c);
        }
    }
    return { xs, ys };
}

/* ---------- network ---------- */

function makeNet(rand) {
    const init = (rows, cols, scale) => {
        const w = new Float64Array(rows * cols);
        for (let i = 0; i < w.length; i++) w[i] = (rand() * 2 - 1) * scale;
        return w;
    };
    const net = {
        w1: init(2, HIDDEN, 1.3),
        b1: new Float64Array(HIDDEN),
        w2: init(HIDDEN, HIDDEN, Math.sqrt(2 / HIDDEN)),
        b2: new Float64Array(HIDDEN),
        w3: init(HIDDEN, 1, Math.sqrt(2 / HIDDEN)),
        b3: new Float64Array(1),
    };
    net.vel = {};
    for (const key of ['w1', 'b1', 'w2', 'b2', 'w3', 'b3']) {
        net.vel[key] = new Float64Array(net[key].length);
    }
    return net;
}

function forward(net, x0, x1, h1, h2) {
    for (let j = 0; j < HIDDEN; j++) {
        h1[j] = Math.tanh(x0 * net.w1[j] + x1 * net.w1[HIDDEN + j] + net.b1[j]);
    }
    for (let j = 0; j < HIDDEN; j++) {
        let sum = net.b2[j];
        for (let i = 0; i < HIDDEN; i++) sum += h1[i] * net.w2[i * HIDDEN + j];
        h2[j] = Math.tanh(sum);
    }
    let out = net.b3[0];
    for (let i = 0; i < HIDDEN; i++) out += h2[i] * net.w3[i];
    return 1 / (1 + Math.exp(-out));
}

function trainStep(net, data, buffers) {
    const { xs, ys } = data;
    const n = xs.length;
    const { h1, h2, g } = buffers;

    for (const key of Object.keys(g)) g[key].fill(0);

    let loss = 0;
    let correct = 0;

    for (let s = 0; s < n; s++) {
        const [x0, x1] = xs[s];
        const label = ys[s];
        const p = forward(net, x0, x1, h1, h2);

        loss += -(label * Math.log(p + 1e-9) + (1 - label) * Math.log(1 - p + 1e-9));
        if ((p > 0.5 ? 1 : 0) === label) correct++;

        const dOut = (p - label) / n;

        for (let i = 0; i < HIDDEN; i++) {
            g.w3[i] += dOut * h2[i];
            buffers.d2[i] = dOut * net.w3[i] * (1 - h2[i] * h2[i]);
        }
        g.b3[0] += dOut;

        for (let i = 0; i < HIDDEN; i++) buffers.d1[i] = 0;
        for (let j = 0; j < HIDDEN; j++) {
            const dH2 = buffers.d2[j];
            g.b2[j] += dH2;
            for (let i = 0; i < HIDDEN; i++) {
                g.w2[i * HIDDEN + j] += dH2 * h1[i];
                buffers.d1[i] += dH2 * net.w2[i * HIDDEN + j];
            }
        }

        for (let j = 0; j < HIDDEN; j++) {
            const dH1 = buffers.d1[j] * (1 - h1[j] * h1[j]);
            g.w1[j] += dH1 * x0;
            g.w1[HIDDEN + j] += dH1 * x1;
            g.b1[j] += dH1;
        }
    }

    for (const key of ['w1', 'b1', 'w2', 'b2', 'w3', 'b3']) {
        const param = net[key];
        const vel = net.vel[key];
        const grad = g[key];
        for (let i = 0; i < param.length; i++) {
            vel[i] = MOMENTUM * vel[i] - LR * grad[i];
            param[i] += vel[i];
        }
    }

    return [loss / n, correct / n];
}

function makeRand(seed) {
    let s = seed || 1;
    return () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
    };
}

/* ---------- component ---------- */

export default function LearningLive() {
    const canvasRef = useRef(null);
    const stateRef = useRef(null);
    const [dataset, setDataset] = useState('spirals');
    const [stats, setStats] = useState({ step: 0, loss: 0, acc: 0 });
    const datasetRef = useRef(dataset);
    useEffect(() => { datasetRef.current = dataset; }, [dataset]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let seed = 1234567;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };

        const buffers = {
            h1: new Float64Array(HIDDEN),
            h2: new Float64Array(HIDDEN),
            d1: new Float64Array(HIDDEN),
            d2: new Float64Array(HIDDEN),
            probeH1: new Float64Array(HIDDEN),
            probeH2: new Float64Array(HIDDEN),
            g: {
                w1: new Float64Array(2 * HIDDEN),
                b1: new Float64Array(HIDDEN),
                w2: new Float64Array(HIDDEN * HIDDEN),
                b2: new Float64Array(HIDDEN),
                w3: new Float64Array(HIDDEN),
                b3: new Float64Array(1),
            },
        };

        // network geometry (precomputed node positions)
        const layerSizes = [2, HIDDEN, HIDDEN, 1];
        const colX = [0.12, 0.39, 0.66, 0.9].map(f => f * CANVAS_W);
        const padY = 46;
        const nodePos = layerSizes.map((count, L) => {
            const arr = [];
            for (let k = 0; k < count; k++) {
                const y = count === 1 ? CANVAS_H / 2 : padY + (k * (CANVAS_H - 2 * padY)) / (count - 1);
                arr.push({ x: colX[L], y });
            }
            return arr;
        });

        function weightAt(gap, s, t) {
            if (gap === 0) return state.net.w1[s * HIDDEN + t];
            if (gap === 1) return state.net.w2[s * HIDDEN + t];
            return state.net.w3[s];
        }

        const state = {
            data: null,
            net: null,
            step: 0,
            lossHistory: [],
            rafId: 0,
            running: true,
            settled: 0,
            flow: 0,
        };
        stateRef.current = state;

        function reset(kind, freshSeed) {
            if (freshSeed !== undefined) seed = freshSeed;
            state.data = makeDataset(kind, rand);
            state.net = makeNet(rand);
            state.step = 0;
            state.settled = 0;
            state.lossHistory = [];
            state.flow = 0;
        }

        function draw(now) {
            ctx.fillStyle = '#101022';
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

            // probe input that slowly moves, so the network visibly responds
            const px = 0.92 * Math.sin(now * 0.00042);
            const py = 0.92 * Math.sin(now * 0.00058 + 1.3);
            const pOut = forward(state.net, px, py, buffers.probeH1, buffers.probeH2);
            const act = [
                [Math.min(1, Math.abs(px)), Math.min(1, Math.abs(py))],
                Array.from(buffers.probeH1, v => Math.abs(v)),
                Array.from(buffers.probeH2, v => Math.abs(v)),
                [Math.abs(pOut - 0.5) * 2],
            ];

            // edges
            for (let gap = 0; gap < 3; gap++) {
                const src = nodePos[gap];
                const dst = nodePos[gap + 1];
                for (let s = 0; s < src.length; s++) {
                    for (let t = 0; t < dst.length; t++) {
                        const w = weightAt(gap, s, t);
                        const mag = Math.abs(w);
                        ctx.beginPath();
                        ctx.moveTo(src[s].x, src[s].y);
                        ctx.lineTo(dst[t].x, dst[t].y);
                        ctx.strokeStyle = w >= 0
                            ? `rgba(140, 220, 255, ${Math.min(0.85, 0.05 + mag * 0.45)})`
                            : `rgba(190, 150, 255, ${Math.min(0.85, 0.05 + mag * 0.45)})`;
                        ctx.lineWidth = Math.max(0.4, Math.min(3.2, mag * 1.7));
                        ctx.stroke();
                    }
                }
            }

            // signal sweep: a pulse travelling forward through the active gap
            const activeGap = Math.floor(state.flow) % 3;
            const frac = state.flow - Math.floor(state.flow);
            {
                const src = nodePos[activeGap];
                const dst = nodePos[activeGap + 1];
                for (let s = 0; s < src.length; s++) {
                    for (let t = 0; t < dst.length; t++) {
                        const w = weightAt(activeGap, s, t);
                        const mag = Math.abs(w);
                        if (mag < 0.35) continue;
                        const bright = Math.min(1, mag * act[activeGap][s] * 1.8);
                        if (bright < 0.08) continue;
                        const x = src[s].x + (dst[t].x - src[s].x) * frac;
                        const y = src[s].y + (dst[t].y - src[s].y) * frac;
                        ctx.beginPath();
                        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255, 255, 255, ${bright})`;
                        ctx.fill();
                    }
                }
            }

            // nodes
            const nodeColors = ['#8cdcff', '#c8b8ff', '#c8b8ff', '#fbbf24'];
            for (let L = 0; L < nodePos.length; L++) {
                for (let k = 0; k < nodePos[L].length; k++) {
                    const { x, y } = nodePos[L][k];
                    const a = act[L][k] || 0;
                    ctx.save();
                    ctx.shadowColor = nodeColors[L];
                    ctx.shadowBlur = 4 + a * 16;
                    ctx.beginPath();
                    ctx.arc(x, y, L === 0 || L === 3 ? 8 : 7, 0, Math.PI * 2);
                    ctx.fillStyle = nodeColors[L];
                    ctx.globalAlpha = 0.45 + a * 0.55;
                    ctx.fill();
                    ctx.restore();
                    ctx.lineWidth = 1.4;
                    ctx.strokeStyle = 'rgba(16,16,34,0.85)';
                    ctx.stroke();
                }
            }

            // inset: the points being classified, coloured by the live prediction
            const iw = 104;
            const ih = 80;
            const ix = CANVAS_W - iw - 12;
            const iy = CANVAS_H - ih - 12;
            ctx.fillStyle = 'rgba(20, 20, 40, 0.82)';
            ctx.strokeStyle = 'rgba(230,232,255,0.16)';
            ctx.lineWidth = 1;
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(ix, iy, iw, ih, 8);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillRect(ix, iy, iw, ih);
                ctx.strokeRect(ix, iy, iw, ih);
            }
            const pad = 8;
            const mapX = v => ix + pad + ((v + 1.15) / 2.3) * (iw - 2 * pad);
            const mapY = v => iy + pad + ((v + 1.15) / 2.3) * (ih - 2 * pad);
            const dxs = state.data.xs;
            const dys = state.data.ys;
            for (let i = 0; i < dxs.length; i++) {
                const p = forward(state.net, dxs[i][0], dxs[i][1], buffers.h1, buffers.h2);
                const wrong = (p > 0.5 ? 1 : 0) !== dys[i];
                ctx.beginPath();
                ctx.arc(mapX(dxs[i][0]), mapY(dxs[i][1]), 1.7, 0, Math.PI * 2);
                ctx.fillStyle = p > 0.5 ? '#fbbf24' : '#9d8df0';
                ctx.globalAlpha = wrong ? 0.5 : 1;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            ctx.fillStyle = 'rgba(230,232,255,0.5)';
            ctx.font = '9px ui-monospace, monospace';
            ctx.fillText('what it sees', ix + pad, iy + ih - 5);
        }

        let lastStats = 0;

        function frame(now) {
            if (!state.running) return;

            let loss = 0;
            let acc = 0;
            for (let i = 0; i < STEPS_PER_FRAME; i++) {
                [loss, acc] = trainStep(state.net, state.data, buffers);
                state.step++;
            }
            state.lossHistory.push(loss);
            if (state.lossHistory.length > 160) state.lossHistory.shift();
            state.flow = (state.flow + 0.05) % 3;

            if (acc >= 0.99) state.settled++;
            else state.settled = 0;
            if (state.settled > 200 || state.step > 5000) {
                const next = DATASETS[(DATASETS.indexOf(datasetRef.current) + 1) % DATASETS.length];
                setDataset(next);
                reset(next);
            }

            draw(now);

            if (now - lastStats > 180) {
                lastStats = now;
                setStats({ step: state.step, loss, acc });
            }

            state.rafId = requestAnimationFrame(frame);
        }

        reset(datasetRef.current);

        if (reducedMotion) {
            let loss = 0;
            let acc = 0;
            for (let i = 0; i < 1400; i++) {
                [loss, acc] = trainStep(state.net, state.data, buffers);
                state.step++;
            }
            draw(0);
            const snapshot = { step: state.step, loss, acc };
            setTimeout(() => setStats(snapshot), 0);
            return undefined;
        }

        state.rafId = requestAnimationFrame(frame);

        const observer = new IntersectionObserver(([entry]) => {
            const wasRunning = state.running;
            state.running = entry.isIntersecting && !document.hidden;
            if (state.running && !wasRunning) state.rafId = requestAnimationFrame(frame);
        });
        observer.observe(canvas);

        const onVisibility = () => {
            const wasRunning = state.running;
            state.running = !document.hidden;
            if (state.running && !wasRunning) state.rafId = requestAnimationFrame(frame);
            else if (!state.running) cancelAnimationFrame(state.rafId);
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            state.running = false;
            cancelAnimationFrame(state.rafId);
            observer.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
        };
        // network is initialized once; dataset switches flow through datasetRef
    }, []);

    const restartSeedRef = useRef(24680);

    function pickDataset(kind) {
        setDataset(kind);
        const state = stateRef.current;
        if (!state) return;
        restartSeedRef.current = (restartSeedRef.current * 16807 + 12345) % 2147483647;
        const r = makeRand(restartSeedRef.current);
        state.data = makeDataset(kind, r);
        state.net = makeNet(r);
        state.step = 0;
        state.settled = 0;
        state.lossHistory = [];
        state.flow = 0;
    }

    function restart() {
        pickDataset(datasetRef.current);
    }

    return (
        <div className={styles.panel}>
            <div className={styles.panelHeader}>
                <span className={styles.liveDot} aria-hidden="true" />
                <span className={styles.panelTitle}>A neural network, learning right now</span>
            </div>

            <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className={styles.canvas}
                aria-label="Live visualization of a neural network: nodes and weighted connections learning to classify points"
            />

            <div className={styles.accRow}>
                <div className={styles.accTrack}>
                    <div className={styles.accFill} style={{ width: `${(stats.acc * 100).toFixed(0)}%` }} />
                </div>
                <span className={styles.accVal}>{(stats.acc * 100).toFixed(0)}% correct</span>
            </div>

            <div className={styles.statsRow}>
                <span className={styles.stat}>epoch <b>{stats.step.toLocaleString('en-US')}</b></span>
                <span className={styles.stat}>loss <b>{stats.loss.toFixed(3)}</b></span>
                <span className={styles.stat}>learning to separate <b>{dataset}</b></span>
            </div>

            <div className={styles.controls}>
                {DATASETS.map(kind => (
                    <button
                        key={kind}
                        onClick={() => pickDataset(kind)}
                        className={`${styles.pill} ${dataset === kind ? styles.pillActive : ''}`}
                    >
                        {kind}
                    </button>
                ))}
                <button onClick={restart} className={styles.pill} title="Reinitialize the weights and learn again">
                    ↺ restart
                </button>
            </div>

            <p className={styles.caption}>
                Watch the connections strengthen and a pulse sweep through on each pass. Real
                backprop, hand-written in plain JavaScript, no libraries, nothing downloaded.
            </p>
        </div>
    );
}
