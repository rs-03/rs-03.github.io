'use client';

import { useEffect, useRef, useState } from 'react';
import { powerSpectrum, buildMelFilterbank, hammingWindow, dct2 } from '../CoughMonitor/dsp';
import styles from './SignalMicroscope.module.css';

/**
 * The Signal Microscope: the full audio DSP chain, animated live.
 *
 * One 1024-sample frame per animation tick flows through the same
 * hand-written pipeline the cough monitor uses (waveform, Hamming
 * window, FFT, mel filterbank, MFCCs), with every intermediate
 * representation rendered. Sources are synthesized (no permissions
 * needed) or, optionally, the visitor's microphone.
 */

const FRAME = 1024;
const SR = 16000;
const NUM_MEL = 26;
const NUM_MFCC = 12;

const SOURCES = ['chirp', 'chord', 'percussion', 'voice-like'];

/* ---------- synthesized signal generators ---------- */

function synthesize(kind, t0, out) {
    for (let i = 0; i < out.length; i++) {
        const t = (t0 + i) / SR;
        let v = 0;
        if (kind === 'chirp') {
            const phase = 2 * Math.PI * (100 * t + ((3800 - 100) / (2 * 6)) * ((t % 6) ** 2));
            v = 0.7 * Math.sin(phase);
        } else if (kind === 'chord') {
            const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * t);
            v = 0.3 * Math.sin(2 * Math.PI * 220 * vibrato * t)
                + 0.28 * Math.sin(2 * Math.PI * 277.18 * t)
                + 0.26 * Math.sin(2 * Math.PI * 329.63 * vibrato * t)
                + 0.12 * Math.sin(2 * Math.PI * 440 * t);
        } else if (kind === 'percussion') {
            const beat = t % 0.5;
            const envelope = Math.exp(-beat * 18);
            // deterministic noise via harmonically unrelated sines
            const noise = Math.sin(2 * Math.PI * 1123 * t) * Math.sin(2 * Math.PI * 2971 * t + 1.3)
                + Math.sin(2 * Math.PI * 4457 * t + 0.7);
            const thump = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-beat * 30);
            v = 0.5 * envelope * noise * 0.5 + 0.8 * thump;
        } else {
            // voice-like: glottal-ish 120 Hz buzz shaped by moving formants
            const f0 = 120 + 8 * Math.sin(2 * Math.PI * 0.4 * t);
            const buzz = Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * 2 * f0 * t) + 0.33 * Math.sin(2 * Math.PI * 3 * f0 * t);
            const formant1 = Math.sin(2 * Math.PI * (700 + 150 * Math.sin(2 * Math.PI * 0.23 * t)) * t);
            const formant2 = Math.sin(2 * Math.PI * (1200 + 300 * Math.sin(2 * Math.PI * 0.31 * t)) * t);
            v = 0.35 * buzz + 0.25 * buzz * formant1 + 0.18 * buzz * formant2;
        }
        out[i] = v;
    }
}

/* ---------- colormap: navy -> purple -> amber -> white ---------- */

function heat(x) {
    const t = Math.max(0, Math.min(1, x));
    if (t < 0.35) {
        const u = t / 0.35;
        return [16 + u * 108, 16 + u * 90, 34 + u * 205];
    }
    if (t < 0.75) {
        const u = (t - 0.35) / 0.4;
        return [124 + u * 127, 106 + u * 85, 239 - u * 203];
    }
    const u = (t - 0.75) / 0.25;
    return [251 + u * 4, 191 + u * 64, 36 + u * 219];
}

export default function SignalMicroscope() {
    const refs = {
        waterfall: useRef(null),
        waveform: useRef(null),
        windowed: useRef(null),
        spectrum: useRef(null),
        mel: useRef(null),
        mfcc: useRef(null),
    };
    const sessionRef = useRef(null);
    const [source, setSource] = useState('chirp');
    const [micState, setMicState] = useState('off'); // off | on | denied
    const sourceRef = useRef(source);
    sourceRef.current = source;
    const micRef = useRef(null);

    useEffect(() => {
        const canvases = {};
        for (const key of Object.keys(refs)) {
            const el = refs[key].current;
            if (!el) return undefined;
            canvases[key] = el.getContext('2d');
        }
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const window1024 = hammingWindow(FRAME);
        const filters = buildMelFilterbank(SR, FRAME, NUM_MEL);
        const frame = new Float64Array(FRAME);
        const windowed = new Float64Array(FRAME);

        const session = { rafId: 0, running: true, t: 0 };
        sessionRef.current = session;

        const W = el => el.canvas.width;
        const H = el => el.canvas.height;

        function drawWaveform(ctx, data, color) {
            const w = W(ctx);
            const h = H(ctx);
            ctx.fillStyle = '#101022';
            ctx.fillRect(0, 0, w, h);
            ctx.beginPath();
            for (let i = 0; i < data.length; i += 2) {
                const x = (i / data.length) * w;
                const y = h / 2 - data[i] * h * 0.42;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.4;
            ctx.stroke();
        }

        function step() {
            if (!session.running) return;

            // 1. acquire a frame
            if (micRef.current) {
                micRef.current.analyser.getFloatTimeDomainData(micRef.current.buffer);
                for (let i = 0; i < FRAME; i++) frame[i] = micRef.current.buffer[i];
            } else {
                synthesize(sourceRef.current, session.t, frame);
                session.t += FRAME / 2; // overlap for smoother motion
            }

            // 2. window
            for (let i = 0; i < FRAME; i++) windowed[i] = frame[i] * window1024[i];

            // 3. FFT power spectrum (the hand-written, parity-tested one)
            const power = powerSpectrum(windowed);

            // 4. mel energies
            const melEnergies = new Float64Array(NUM_MEL);
            for (let f = 0; f < NUM_MEL; f++) {
                let sum = 0;
                const weights = filters[f];
                for (let b = 0; b < power.length; b++) {
                    if (weights[b] !== 0) sum += weights[b] * power[b];
                }
                melEnergies[f] = Math.log(sum + 1e-10);
            }

            // 5. MFCCs
            const mfcc = dct2(melEnergies, NUM_MFCC + 1).slice(1);

            /* ---- render every stage ---- */

            drawWaveform(canvases.waveform, frame, '#9d8df0');

            // windowed frame + the window shape itself
            drawWaveform(canvases.windowed, windowed, '#8cdcff');
            const wCtx = canvases.windowed;
            wCtx.beginPath();
            for (let i = 0; i < FRAME; i += 8) {
                const x = (i / FRAME) * W(wCtx);
                const y = H(wCtx) / 2 - window1024[i] * H(wCtx) * 0.42;
                if (i === 0) wCtx.moveTo(x, y);
                else wCtx.lineTo(x, y);
            }
            wCtx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
            wCtx.lineWidth = 1;
            wCtx.stroke();

            // spectrum (log magnitude, log-ish frequency emphasis via sqrt axis)
            const sCtx = canvases.spectrum;
            const sw = W(sCtx);
            const sh = H(sCtx);
            sCtx.fillStyle = '#101022';
            sCtx.fillRect(0, 0, sw, sh);
            sCtx.beginPath();
            const bins = power.length;
            for (let px = 0; px < sw; px++) {
                const bin = Math.floor(((px / sw) ** 2) * (bins - 1));
                const db = Math.log10(power[bin] + 1e-9);
                const y = sh - Math.max(0, Math.min(1, (db + 6) / 6.5)) * sh;
                if (px === 0) sCtx.moveTo(px, y);
                else sCtx.lineTo(px, y);
            }
            sCtx.strokeStyle = '#fbbf24';
            sCtx.lineWidth = 1.4;
            sCtx.stroke();

            // mel filterbank energies as glowing bars
            const mCtx = canvases.mel;
            const mw = W(mCtx);
            const mh = H(mCtx);
            mCtx.fillStyle = '#101022';
            mCtx.fillRect(0, 0, mw, mh);
            const barW = mw / NUM_MEL;
            for (let f = 0; f < NUM_MEL; f++) {
                const level = Math.max(0, Math.min(1, (melEnergies[f] + 9) / 10));
                const [r, g, b] = heat(level);
                mCtx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
                const bh = Math.max(2, level * (mh - 4));
                mCtx.fillRect(f * barW + 1, mh - bh, barW - 2, bh);
            }

            // MFCC barcode
            const cCtx = canvases.mfcc;
            const cw = W(cCtx);
            const ch = H(cCtx);
            const cellW = cw / NUM_MFCC;
            for (let k = 0; k < NUM_MFCC; k++) {
                const level = Math.max(0, Math.min(1, (mfcc[k] + 12) / 24));
                const [r, g, b] = heat(level);
                cCtx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
                cCtx.fillRect(k * cellW + 1, 0, cellW - 2, ch);
            }

            // waterfall: shift left, paint new spectrum column at right edge
            const fCtx = canvases.waterfall;
            const fw = W(fCtx);
            const fh = H(fCtx);
            fCtx.drawImage(fCtx.canvas, -1, 0);
            for (let py = 0; py < fh; py++) {
                const bin = Math.floor(((1 - py / fh) ** 2) * (bins - 1));
                const db = Math.log10(power[bin] + 1e-9);
                const [r, g, b] = heat((db + 6) / 6.5);
                fCtx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
                fCtx.fillRect(fw - 1, py, 1, 1);
            }

            session.rafId = requestAnimationFrame(step);
        }

        // prime the waterfall background
        canvases.waterfall.fillStyle = '#101022';
        canvases.waterfall.fillRect(0, 0, refs.waterfall.current.width, refs.waterfall.current.height);

        if (reducedMotion) {
            // render a single still frame of every stage
            session.running = true;
            step();
            session.running = false;
            cancelAnimationFrame(session.rafId);
            return undefined;
        }

        session.rafId = requestAnimationFrame(step);

        const observer = new IntersectionObserver(([entry]) => {
            const wasRunning = session.running;
            session.running = entry.isIntersecting && !document.hidden;
            if (session.running && !wasRunning) session.rafId = requestAnimationFrame(step);
        });
        observer.observe(refs.waterfall.current);

        const onVisibility = () => {
            const wasRunning = session.running;
            session.running = !document.hidden;
            if (session.running && !wasRunning) session.rafId = requestAnimationFrame(step);
            else if (!session.running) cancelAnimationFrame(session.rafId);
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            session.running = false;
            cancelAnimationFrame(session.rafId);
            observer.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            stopMic();
        };
        // refs are stable; sources are read through sourceRef each frame
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function stopMic() {
        if (micRef.current) {
            micRef.current.stream.getTracks().forEach(track => track.stop());
            micRef.current.audioCtx.close();
            micRef.current = null;
        }
    }

    async function toggleMic() {
        if (micRef.current) {
            stopMic();
            setMicState('off');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const audioCtx = new AudioContext({ sampleRate: SR });
            const sourceNode = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = FRAME;
            sourceNode.connect(analyser);
            micRef.current = { stream, audioCtx, analyser, buffer: new Float32Array(FRAME) };
            setMicState('on');
        } catch {
            setMicState('denied');
        }
    }

    return (
        <section className={`section ${styles.microscope}`} id="microscope">
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Live Demo · The Signal Microscope</span>
                    <h2 className="section-header__title">Watch Sound Become Numbers</h2>
                    <p className="section-header__description">
                        Every stage of the audio pipeline behind the cough monitor, animated
                        live: raw signal, Hamming window, hand-written FFT, mel filterbank,
                        MFCC fingerprint. Pick a synthesized sound, or turn on your microphone
                        and watch your own voice flow through the math.
                    </p>
                </div>

                <div className={styles.controls}>
                    {SOURCES.map(kind => (
                        <button
                            key={kind}
                            className={`${styles.pill} ${!micRef.current && source === kind ? styles.pillActive : ''}`}
                            onClick={() => {
                                stopMic();
                                setMicState('off');
                                setSource(kind);
                            }}
                        >
                            {kind}
                        </button>
                    ))}
                    <button
                        className={`${styles.pill} ${micState === 'on' ? styles.pillActive : ''}`}
                        onClick={toggleMic}
                    >
                        {micState === 'on' ? '🎙️ mic on (tap to stop)' : '🎙️ use microphone'}
                    </button>
                    {micState === 'denied' && (
                        <span className={styles.denied}>Microphone was denied; synthesized sources still work.</span>
                    )}
                </div>

                <div className={styles.lab}>
                    <div className={styles.waterfallPanel}>
                        <span className={styles.stageLabel}>Spectrogram · frequency over time</span>
                        <canvas ref={refs.waterfall} width={640} height={430} className={styles.waterfall} />
                    </div>

                    <div className={styles.chain}>
                        <div className={styles.stagePanel}>
                            <span className={styles.stageLabel}>1 · Raw waveform</span>
                            <canvas ref={refs.waveform} width={520} height={64} className={styles.stageCanvas} />
                        </div>
                        <div className={styles.stagePanel}>
                            <span className={styles.stageLabel}>2 · Hamming window tames the edges</span>
                            <canvas ref={refs.windowed} width={520} height={64} className={styles.stageCanvas} />
                        </div>
                        <div className={styles.stagePanel}>
                            <span className={styles.stageLabel}>3 · FFT spectrum (the 40-line, parity-tested one)</span>
                            <canvas ref={refs.spectrum} width={520} height={64} className={styles.stageCanvas} />
                        </div>
                        <div className={styles.stagePanel}>
                            <span className={styles.stageLabel}>4 · 26 mel filters, hearing-shaped</span>
                            <canvas ref={refs.mel} width={520} height={64} className={styles.stageCanvas} />
                        </div>
                        <div className={styles.stagePanel}>
                            <span className={styles.stageLabel}>5 · MFCC fingerprint, the barcode of sound</span>
                            <canvas ref={refs.mfcc} width={520} height={40} className={styles.stageCanvas} />
                        </div>
                    </div>
                </div>

                <p className={styles.footnote}>
                    Same hand-written DSP that powers the cough baseline monitor, verified
                    against a reference DFT to 1e-14. Audio never leaves your device.
                </p>
            </div>
        </section>
    );
}
