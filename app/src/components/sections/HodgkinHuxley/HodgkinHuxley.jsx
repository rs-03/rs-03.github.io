'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './HodgkinHuxley.module.css';

/**
 * Hodgkin-Huxley: a nerve membrane firing, from the real equations.
 *
 * The four coupled differential equations Hodgkin and Huxley fitted to the
 * squid giant axon in 1952, integrated live. A membrane voltage V and three
 * gating variables (m and h for the sodium channel, n for potassium) chase
 * their voltage-dependent rates; inject enough current and the sodium channels
 * open in a runaway that overshoots to positive voltage, then potassium
 * repolarizes and the cell resets. That is an action potential, the unit of
 * every thought and heartbeat, and it is all right here in the math.
 *
 * Reference: A. L. Hodgkin & A. F. Huxley, "A quantitative description of
 * membrane current and its application to conduction and excitation in nerve,"
 * J. Physiol. 117:500-544 (1952). Nobel Prize, 1963.
 */

// membrane and channel constants (standard modern HH, rest near -65 mV)
const C_M = 1.0;
const G_NA = 120.0, E_NA = 50.0;
const G_K = 36.0, E_K = -77.0;
const G_L = 0.3, E_L = -54.387;
const DT = 0.01;              // ms, forward-Euler step
const V_REST = -65;

function safeRatio(num, den) {
    // removable 0/0 singularities in the alpha rate functions
    return Math.abs(den) < 1e-7 ? num * 10 : num / den;
}
function alphaN(V) { return 0.01 * safeRatio(V + 55, 1 - Math.exp(-(V + 55) / 10)); }
function betaN(V) { return 0.125 * Math.exp(-(V + 65) / 80); }
function alphaM(V) { return 0.1 * safeRatio(V + 40, 1 - Math.exp(-(V + 40) / 10)); }
function betaM(V) { return 4 * Math.exp(-(V + 65) / 18); }
function alphaH(V) { return 0.07 * Math.exp(-(V + 65) / 20); }
function betaH(V) { return 1 / (1 + Math.exp(-(V + 35) / 10)); }

function hhRest() {
    const V = V_REST;
    const m = alphaM(V) / (alphaM(V) + betaM(V));
    const h = alphaH(V) / (alphaH(V) + betaH(V));
    const n = alphaN(V) / (alphaN(V) + betaN(V));
    return { V, m, h, n };
}

function hhStep(s, I, dt) {
    const { V, m, h, n } = s;
    const iNa = G_NA * m * m * m * h * (V - E_NA);
    const iK = G_K * n * n * n * n * (V - E_K);
    const iL = G_L * (V - E_L);
    const dV = (I - iNa - iK - iL) / C_M;
    const dm = alphaM(V) * (1 - m) - betaM(V) * m;
    const dh = alphaH(V) * (1 - h) - betaH(V) * h;
    const dn = alphaN(V) * (1 - n) - betaN(V) * n;
    return {
        V: V + dV * dt,
        m: Math.min(1, Math.max(0, m + dm * dt)),
        h: Math.min(1, Math.max(0, h + dh * dt)),
        n: Math.min(1, Math.max(0, n + dn * dt)),
    };
}

const L = 900;                // trace samples (window)
const SAMPLE_SUBSTEPS = 6;    // Euler steps per stored sample (0.06 ms)
const FRAME_SAMPLES = 6;      // samples advanced per animation frame

const PRESETS = [
    { name: 'Rest', I: 0, pulse: false, note: 'no input, sits at rest' },
    { name: 'Single spike', I: 0, pulse: true, note: 'one supra-threshold pulse' },
    { name: 'Spike train', I: 8, pulse: false, note: 'steady current, repetitive firing' },
    { name: 'Strong drive', I: 18, pulse: false, note: 'higher current, faster firing' },
];

const COL_V = '#ffd27a';
const COL_M = '#f6a723';
const COL_H = '#8cdcff';
const COL_N = '#4ade80';

const PHASE_COLORS = { peak: '#ffffff', rise: COL_M, fall: COL_H, refractory: COL_N, rest: COL_V };

// panel geometry, shared by the renderer and the click-to-inject handler
const TRACE_TOP = 20, TRACE_BOT = 320, TRACE_VMIN = -85, TRACE_VMAX = 55;

// a short, phase-accurate caption for whatever the membrane is doing right now
function narrate(V, dv, m) {
    if (V >= 0) return { key: 'peak', text: 'Overshoot: the voltage rockets past 0 mV as sodium floods in.' };
    if (dv > 3 && m > 0.3) return { key: 'rise', text: 'Depolarizing: the sodium channels avalanche open.' };
    if (dv < -3) return { key: 'fall', text: 'Repolarizing: potassium pulls the voltage back down.' };
    if (V < V_REST - 2) return { key: 'refractory', text: 'Refractory: the cell briefly cannot fire again.' };
    return { key: 'rest', text: 'At rest near -65 mV. Inject current to cross threshold.' };
}

const REST_NARRATION = 'At rest near -65 mV. Inject current to cross threshold.';

export default function HodgkinHuxley() {
    const canvasRef = useRef(null);
    const phaseRef = useRef(null);
    const paramsRef = useRef({ I: 0 });
    const pulseRef = useRef({ remaining: 0, amp: 20 });
    const injectRef = useRef({ x: 0, y: 0, life: 0 });
    const soundRef = useRef(false);
    const audioRef = useRef(null);
    const statsRef = useRef({ V: V_REST, spikes: 0, rateHz: 0, phase: 'rest', narration: REST_NARRATION });

    const [presetName, setPresetName] = useState('Rest');
    const [current, setCurrent] = useState(0);
    const [sound, setSound] = useState(false);
    const [stats, setStats] = useState({ V: V_REST, spikes: 0, rateHz: 0, phase: 'rest', narration: REST_NARRATION });

    useEffect(() => { paramsRef.current = { I: current }; }, [current]);
    useEffect(() => { soundRef.current = sound; }, [sound]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // a short percussive tick per spike, only when the visitor has asked for sound
        function blip() {
            if (!soundRef.current) return;
            const ac = audioRef.current;
            if (!ac) return;
            if (ac.state === 'suspended') ac.resume();
            const t0 = ac.currentTime;
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(900, t0);
            osc.frequency.exponentialRampToValueAtTime(240, t0 + 0.05);
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
            osc.connect(gain); gain.connect(ac.destination);
            osc.start(t0); osc.stop(t0 + 0.15);
        }

        const vBuf = new Float32Array(L).fill(V_REST);
        const mBuf = new Float32Array(L);
        const hBuf = new Float32Array(L);
        const nBuf = new Float32Array(L);
        const rest = hhRest();
        mBuf.fill(rest.m); hBuf.fill(rest.h); nBuf.fill(rest.n);
        let head = 0;
        let s = hhRest();
        let spikeCount = 0;
        let prevV = s.V;
        const spikeTimes = [];
        let simMs = 0;
        let lastFrameV = s.V;
        let phaseKey = 'rest';

        canvas._hh = {
            peek: () => ({ V: s.V, spikes: spikeCount }),
            // deterministic fresh run for the correctness test
            simulate: (durationMs, I) => {
                let t = hhRest();
                let maxV = -1e9, minV = 1e9, sp = 0, pv = t.V, finite = true;
                const steps = Math.round(durationMs / DT);
                for (let i = 0; i < steps; i++) {
                    t = hhStep(t, I, DT);
                    if (!Number.isFinite(t.V)) { finite = false; break; }
                    if (t.V > maxV) maxV = t.V;
                    if (t.V < minV) minV = t.V;
                    if (pv < 0 && t.V >= 0) sp++;
                    pv = t.V;
                }
                return { maxV, minV, spikes: sp, finite, endV: t.V };
            },
        };

        function pushSample() {
            let I = paramsRef.current.I;
            if (pulseRef.current.remaining > 0) {
                I += pulseRef.current.amp;
                pulseRef.current.remaining -= SAMPLE_SUBSTEPS * DT;
            }
            for (let k = 0; k < SAMPLE_SUBSTEPS; k++) {
                s = hhStep(s, I, DT);
                simMs += DT;
                if (prevV < 0 && s.V >= 0) { spikeCount++; spikeTimes.push(simMs); blip(); }
                prevV = s.V;
            }
            vBuf[head] = s.V; mBuf[head] = s.m; hBuf[head] = s.h; nBuf[head] = s.n;
            head = (head + 1) % L;
            while (spikeTimes.length && spikeTimes[0] < simMs - 1000) spikeTimes.shift();
        }

        function line(buf, y0, y1, vmin, vmax, color, glow) {
            const W = canvas.width;
            ctx.beginPath();
            for (let i = 0; i < L; i++) {
                const v = buf[(head + i) % L];
                const x = (i / (L - 1)) * W;
                const y = y1 - ((v - vmin) / (vmax - vmin)) * (y1 - y0);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            if (glow) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 8; }
            ctx.strokeStyle = color;
            ctx.lineWidth = glow ? 2.4 : 1.6;
            ctx.stroke();
            if (glow) ctx.restore();
        }

        function draw() {
            const W = canvas.width, H = canvas.height;
            ctx.fillStyle = '#101022';
            ctx.fillRect(0, 0, W, H);

            const vTop = TRACE_TOP, vBot = TRACE_BOT;
            const VMIN = TRACE_VMIN, VMAX = TRACE_VMAX;
            const yOf = v => vBot - ((v - VMIN) / (VMAX - VMIN)) * (vBot - vTop);

            // reference lines: 0 mV, threshold ~ -55, rest -65
            ctx.font = '12px ui-monospace, monospace';
            ctx.textBaseline = 'middle';
            const refs = [[0, '0 mV', 'rgba(230,232,255,0.28)'], [-55, 'threshold', 'rgba(246,167,35,0.35)'], [V_REST, 'rest -65', 'rgba(140,220,255,0.3)']];
            for (const [v, label, col] of refs) {
                const y = yOf(v);
                ctx.strokeStyle = col;
                ctx.setLineDash([4, 4]);
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = col;
                ctx.textAlign = 'left';
                ctx.fillText(label, 8, y - 8);
            }

            line(vBuf, vTop, vBot, VMIN, VMAX, COL_V, true);

            // leading-edge marker coloured by the live phase, tying caption to trace
            const yTip = yOf(s.V);
            const dotCol = PHASE_COLORS[phaseKey] || COL_V;
            ctx.save();
            ctx.shadowColor = dotCol; ctx.shadowBlur = 14;
            ctx.fillStyle = dotCol;
            ctx.beginPath(); ctx.arc(W - 4, yTip, 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            // fading ring where the visitor clicked to inject current
            if (injectRef.current.life > 0) {
                const fr = injectRef.current.life / 22;
                ctx.strokeStyle = `rgba(255, 210, 122, ${fr})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(injectRef.current.x, injectRef.current.y, (1 - fr) * 24 + 6, 0, Math.PI * 2);
                ctx.stroke();
            }

            // gating variables panel
            const gTop = 356, gBot = 500;
            ctx.strokeStyle = 'rgba(230,232,255,0.12)';
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(0, gBot); ctx.lineTo(W, gBot); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, gTop); ctx.lineTo(W, gTop); ctx.stroke();
            line(mBuf, gTop, gBot, 0, 1, COL_M, false);
            line(hBuf, gTop, gBot, 0, 1, COL_H, false);
            line(nBuf, gTop, gBot, 0, 1, COL_N, false);

            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(230,232,255,0.55)';
            ctx.fillText('gating variables', 8, gTop - 12);
            ctx.fillStyle = COL_M; ctx.fillText('m Na open', 150, gTop - 12);
            ctx.fillStyle = COL_H; ctx.fillText('h Na block', 260, gTop - 12);
            ctx.fillStyle = COL_N; ctx.fillText('n K open', 380, gTop - 12);
        }

        // phase plane: the trajectory in state space (V against the K gate n).
        // A spike is a loop, rest is a point; it is the dynamical-systems view of
        // the same four equations.
        function drawPhase() {
            const pc = phaseRef.current;
            if (!pc) return;
            const pctx = pc.getContext('2d');
            const W = pc.width, H = pc.height;
            pctx.fillStyle = '#101022';
            pctx.fillRect(0, 0, W, H);
            const padL = 30, padB = 22, padT = 10, padR = 10;
            const plotW = W - padL - padR, plotH = H - padT - padB;
            const xOf = v => padL + ((v - TRACE_VMIN) / (TRACE_VMAX - TRACE_VMIN)) * plotW;
            const yOf = n => padT + (1 - n) * plotH;
            pctx.strokeStyle = 'rgba(230,232,255,0.14)';
            pctx.lineWidth = 1;
            pctx.strokeRect(padL, padT, plotW, plotH);
            pctx.lineWidth = 1.5;
            let px = null, py = null;
            for (let i = 0; i < L; i++) {
                const idx = (head + i) % L;
                const x = xOf(vBuf[idx]), y = yOf(nBuf[idx]);
                if (px !== null) {
                    const a = i / L;
                    pctx.strokeStyle = `rgba(140,220,255,${0.04 + a * 0.5})`;
                    pctx.beginPath(); pctx.moveTo(px, py); pctx.lineTo(x, y); pctx.stroke();
                }
                px = x; py = y;
            }
            pctx.fillStyle = '#ffd27a';
            pctx.beginPath(); pctx.arc(xOf(s.V), yOf(s.n), 3, 0, Math.PI * 2); pctx.fill();
            pctx.fillStyle = 'rgba(230,232,255,0.5)';
            pctx.font = '10px ui-monospace, monospace';
            pctx.textAlign = 'center';
            pctx.fillText('V (mV)', W / 2, H - 6);
            pctx.save();
            pctx.translate(9, H / 2); pctx.rotate(-Math.PI / 2);
            pctx.fillText('n (K gate)', 0, 0);
            pctx.restore();
        }

        const session = { rafId: 0, running: true, sinceStats: 0 };
        function frame() {
            if (!session.running) return;
            for (let f = 0; f < FRAME_SAMPLES; f++) pushSample();
            const dv = s.V - lastFrameV;
            lastFrameV = s.V;
            const nar = narrate(s.V, dv, s.m);
            phaseKey = nar.key;
            if (injectRef.current.life > 0) injectRef.current.life -= 1;
            draw();
            drawPhase();
            session.sinceStats += 1;
            if (session.sinceStats >= 6) {
                session.sinceStats = 0;
                statsRef.current = { V: s.V, spikes: spikeCount, rateHz: spikeTimes.length, phase: nar.key, narration: nar.text };
                setStats(statsRef.current);
            }
            session.rafId = requestAnimationFrame(frame);
        }

        if (reducedMotion) {
            // show a single evoked spike as a static trace
            pulseRef.current = { remaining: 1.5, amp: 20 };
            for (let i = 0; i < L; i++) pushSample();
            phaseKey = 'rest';
            draw();
            drawPhase();
            const nar = narrate(s.V, 0, s.m);
            setStats({ V: s.V, spikes: spikeCount, rateHz: 0, phase: nar.key, narration: nar.text });
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
            canvas._hh = null;
            if (audioRef.current) {
                try { audioRef.current.close(); } catch { /* already closed */ }
                audioRef.current = null;
            }
        };
    }, []);

    function choosePreset(p) {
        setPresetName(p.name);
        setCurrent(p.I);
        if (p.pulse) pulseRef.current = { remaining: 1.5, amp: 20 };
    }

    // click the trace to inject a brief current; higher clicks jolt harder, so a
    // low click stays sub-threshold and a high one triggers a spike
    function onCanvasPointerDown(e) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
        const frac = 1 - Math.min(1, Math.max(0, (y - TRACE_TOP) / (TRACE_BOT - TRACE_TOP)));
        const amp = 3 + frac * 33;
        pulseRef.current = { remaining: 1.2, amp };
        injectRef.current = { x, y, life: 22 };
        setPresetName('Custom');
    }

    // build/resume the AudioContext inside the click (a user gesture) so the
    // browser's autoplay policy is satisfied
    function toggleSound() {
        const next = !soundRef.current;
        if (next) {
            if (!audioRef.current) {
                try {
                    const AC = window.AudioContext || window.webkitAudioContext;
                    if (AC) audioRef.current = new AC();
                } catch { /* audio unavailable */ }
            }
            if (audioRef.current && audioRef.current.state === 'suspended') audioRef.current.resume();
        }
        setSound(next);
    }

    return (
        <section className={`section ${styles.hh}`} id="neuron">
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Live Demo · Computational Biology</span>
                    <h2 className="section-header__title">Fire a Neuron</h2>
                    <p className="section-header__description">
                        This is the exact model Hodgkin and Huxley built in 1952 to explain how
                        nerves fire, four coupled differential equations solved in your browser.
                        Turn up the injected current. Below a threshold the membrane just leaks
                        back to rest. Cross it and the sodium channels avalanche open, the voltage
                        spikes past zero, and potassium slams it back down. That spike is an
                        action potential.
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
                    <button className={styles.pill} onClick={() => { pulseRef.current = { remaining: 1.5, amp: 20 }; }}>
                        Zap (pulse)
                    </button>
                    <button
                        className={`${styles.pill} ${sound ? styles.pillActive : ''}`}
                        onClick={toggleSound}
                        aria-pressed={sound}
                        title="Play a tick on every spike"
                    >
                        {sound ? '🔊 Sound on' : '🔈 Sound off'}
                    </button>
                </div>

                <p className={styles.tip}>
                    Tip: click anywhere on the voltage trace to inject current. Click high for a
                    strong jolt that fires a spike, low for a sub-threshold nudge that just leaks away.
                </p>

                <div className={styles.lab}>
                    <div className={styles.stagePanel}>
                        <canvas
                            ref={canvasRef}
                            width={720}
                            height={520}
                            className={styles.canvas}
                            onPointerDown={onCanvasPointerDown}
                            aria-label="Live membrane voltage and gating variables of a Hodgkin-Huxley neuron. Click the trace to inject current."
                        />
                        <div className={styles.narration} data-phase={stats.phase}>
                            <span className={styles.narrationDot} aria-hidden="true" />
                            <span className={styles.narrationText}>{stats.narration}</span>
                        </div>
                    </div>

                    <div className={styles.side}>
                        <div className={styles.readouts}>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>Membrane V</span>
                                <span className={styles.statValue}>{stats.V.toFixed(1)}<small> mV</small></span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>Firing rate</span>
                                <span className={styles.statValue}>{stats.rateHz}<small> Hz</small></span>
                            </div>
                        </div>

                        <div className={styles.sliderCard}>
                            <label className={styles.slider}>
                                <span>injected current <b>{current.toFixed(1)}</b> uA/cm2</span>
                                <input
                                    type="range" min="0" max="25" step="0.5"
                                    value={current}
                                    onChange={e => { setCurrent(parseFloat(e.target.value)); setPresetName('Custom'); }}
                                />
                            </label>
                            <p className={styles.hint}>
                                Nudge it up slowly. Somewhere around 6 the cell switches from
                                silent to firing over and over, and firing faster as you push
                                harder.
                            </p>
                        </div>

                        <div className={styles.legend}>
                            <span className={styles.legendItem}><i style={{ background: COL_V }} /> membrane voltage</span>
                            <span className={styles.legendItem}><i style={{ background: COL_M }} /> m · Na activation</span>
                            <span className={styles.legendItem}><i style={{ background: COL_H }} /> h · Na inactivation</span>
                            <span className={styles.legendItem}><i style={{ background: COL_N }} /> n · K activation</span>
                        </div>

                        <div className={styles.phaseCard}>
                            <span className={styles.phaseLabel}>State space · V vs n</span>
                            <canvas
                                ref={phaseRef}
                                width={280}
                                height={200}
                                className={styles.phaseCanvas}
                                aria-label="Phase plane of membrane voltage against the potassium gating variable"
                            />
                            <span className={styles.phaseHint}>each spike traces a loop, rest is a point</span>
                        </div>
                    </div>
                </div>

                <details className={styles.underHood}>
                    <summary className={styles.underHoodSummary}>
                        Under the hood: four equations that explain every spike
                    </summary>
                    <div className={styles.underHoodBody}>
                        <ul className={styles.underHoodList}>
                            <li>
                                <strong>The membrane is a capacitor with leaky, voltage-gated
                                resistors.</strong> One equation tracks the voltage as injected
                                current charges the membrane against three ionic currents: sodium,
                                potassium, and a passive leak. Each channel&apos;s conductance
                                depends on the voltage, which is what makes the system nonlinear
                                and excitable.
                            </li>
                            <li>
                                <strong>Three gates, three more equations.</strong> Sodium opens
                                fast (m) but then inactivates (h); potassium opens slowly (n). The
                                fast positive feedback of m against the slower brakes of h and n is
                                exactly what produces an all-or-nothing spike followed by a
                                refractory pause. Watch m jump first, then h fall and n rise to end
                                each spike.
                            </li>
                            <li>
                                <strong>Threshold and frequency are emergent.</strong> Nobody codes
                                in a threshold; it falls out of the dynamics. Below a critical
                                current the fixed point is stable and the cell is silent. Above it,
                                a limit cycle appears and the neuron fires repetitively, faster with
                                more current. Slide the current across that point and you can feel
                                the bifurcation.
                            </li>
                            <li>
                                <strong>Solved honestly.</strong> The four equations are integrated
                                with a forward-Euler step of {DT} ms using the original 1952 rate
                                functions (with the removable 0/0 points handled analytically). No
                                lookup tables, no faked spikes; if you find a spike on screen, the
                                math produced it.
                            </li>
                        </ul>
                    </div>
                </details>

                <p className={styles.footnote}>
                    The same equations that won a Nobel Prize in 1963, running at 60 frames a
                    second on your device.
                </p>
            </div>
        </section>
    );
}
