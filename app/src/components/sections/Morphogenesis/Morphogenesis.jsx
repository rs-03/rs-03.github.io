'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Morphogenesis.module.css';

/**
 * Morphogenesis: Turing's reaction-diffusion, live on the GPU.
 *
 * Two virtual chemicals (an activator and an inhibitor) diffuse and
 * react across a grid using the Gray-Scott model. From a nearly uniform
 * start, diffusion-driven instability breaks symmetry into the same
 * spots, stripes, and labyrinths that pattern real animal skin, coral,
 * and fingerprint ridges. Everything runs in a WebGL2 fragment shader:
 * ping-pong float framebuffers hold the chemical field, and the visitor
 * can paint fresh activator into it and steer the parameters live.
 *
 * The science: A. Turing, "The Chemical Basis of Morphogenesis" (1952);
 * Gray & Scott's cubic autocatalator; Pearson, "Complex Patterns in a
 * Simple System," Science (1993). The biology is real and recent, cited
 * in the panel below.
 */

const SIM_W = 512;
const SIM_H = 320;
const RENDER_W = 1024;
const RENDER_H = 640;
const STEPS_PER_FRAME = 12;

// Diffusion rates and timestep: Karl Sims' well-tested normalization of
// Gray-Scott (activator diffuses twice as fast is WRONG for Turing; here
// the inhibitor V diffuses slower so the activator wins locally).
const DU = 1.0;
const DV = 0.5;
const DT = 1.0;

// Feed (F) and kill (k) rates selected from Pearson's parameter map so
// each one lands in a visually distinct regime. The biological labels are
// honest analogies to systems shown to be reaction-diffusion driven.
const PRESETS = [
    { name: 'Leopard spots', f: 0.03, k: 0.062, note: 'stable spots, like big-cat coats' },
    { name: 'Coral', f: 0.0545, k: 0.062, note: 'branching growth fronts' },
    { name: 'Fingerprints', f: 0.037, k: 0.06, note: 'ridged labyrinth' },
    { name: 'Cell division', f: 0.0367, k: 0.0649, note: 'self-replicating spots' },
    { name: 'Flow', f: 0.018, k: 0.051, note: 'travelling waves' },
    { name: 'Worms', f: 0.058, k: 0.065, note: 'elongating stripes' },
];

const PALETTES = ['Ink', 'Membrane', 'Ember'];

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const SIM_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_state;
uniform vec2 u_texel;
uniform float u_f;
uniform float u_k;
uniform float u_du;
uniform float u_dv;
uniform float u_dt;

vec2 S(vec2 off) { return texture(u_state, v_uv + off * u_texel).xy; }

void main() {
    vec2 c = S(vec2(0.0));
    vec2 lap = vec2(0.0);
    lap += S(vec2(-1.0, 0.0)) * 0.2;
    lap += S(vec2(1.0, 0.0)) * 0.2;
    lap += S(vec2(0.0, -1.0)) * 0.2;
    lap += S(vec2(0.0, 1.0)) * 0.2;
    lap += S(vec2(-1.0, -1.0)) * 0.05;
    lap += S(vec2(1.0, -1.0)) * 0.05;
    lap += S(vec2(-1.0, 1.0)) * 0.05;
    lap += S(vec2(1.0, 1.0)) * 0.05;
    lap += c * -1.0;

    float u = c.x;
    float v = c.y;
    float reaction = u * v * v;
    float du = u_du * lap.x - reaction + u_f * (1.0 - u);
    float dv = u_dv * lap.y + reaction - (u_f + u_k) * v;
    vec2 n = clamp(c + vec2(du, dv) * u_dt, 0.0, 1.0);
    outColor = vec4(n, 0.0, 1.0);
}`;

const SPLAT_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_state;
uniform vec2 u_point;
uniform float u_radius;
uniform float u_aspect;
void main() {
    vec2 c = texture(u_state, v_uv).xy;
    vec2 d = v_uv - u_point;
    d.x *= u_aspect;
    float add = 0.9 * smoothstep(u_radius, 0.0, length(d));
    c.y = clamp(c.y + add, 0.0, 1.0);
    outColor = vec4(c, 0.0, 1.0);
}`;

const RENDER_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_state;
uniform vec2 u_texel;
uniform int u_palette;

float sampleV(vec2 uv) {
    vec2 texSize = 1.0 / u_texel;
    vec2 p = uv * texSize - 0.5;
    vec2 f = fract(p);
    vec2 base = (floor(p) + 0.5) * u_texel;
    float v00 = texture(u_state, base).y;
    float v10 = texture(u_state, base + vec2(u_texel.x, 0.0)).y;
    float v01 = texture(u_state, base + vec2(0.0, u_texel.y)).y;
    float v11 = texture(u_state, base + u_texel).y;
    return mix(mix(v00, v10, f.x), mix(v01, v11, f.x), f.y);
}

vec3 ramp(float t, vec3 a, vec3 b, vec3 cc, vec3 d) {
    if (t < 0.33) return mix(a, b, t / 0.33);
    if (t < 0.66) return mix(b, cc, (t - 0.33) / 0.33);
    return mix(cc, d, (t - 0.66) / 0.34);
}

void main() {
    float v = sampleV(v_uv);
    float t = clamp(v * 2.4, 0.0, 1.0);
    vec3 col;
    if (u_palette == 0) {
        col = ramp(t, vec3(0.055, 0.055, 0.10), vec3(0.31, 0.28, 0.85),
                      vec3(0.86, 0.55, 0.30), vec3(1.0, 0.98, 0.90));
    } else if (u_palette == 1) {
        col = ramp(t, vec3(0.02, 0.05, 0.07), vec3(0.04, 0.32, 0.34),
                      vec3(0.29, 0.87, 0.50), vec3(0.98, 0.87, 0.40));
    } else {
        col = ramp(t, vec3(0.03, 0.02, 0.05), vec3(0.42, 0.08, 0.24),
                      vec3(0.95, 0.42, 0.16), vec3(1.0, 0.94, 0.72));
    }
    // subtle glow lift on the bright ridges
    col += pow(t, 3.0) * 0.12;
    outColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('shader compile failed: ' + log);
    }
    return sh;
}

function program(gl, fragSrc) {
    const prog = gl.createProgram();
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('link failed: ' + gl.getProgramInfoLog(prog));
    }
    return prog;
}

// Deterministic initial field: activator (U) fills the plane, and many small
// strong patches of inhibitor (V) are stamped across it. Localized high-V
// seeds are what reliably nucleate Gray-Scott patterns; a diffuse low-V wash
// just decays back to the uniform state in the low-feed regimes. Using a lot
// of patches means the whole field fills with pattern within a second or two.
function initialState() {
    const data = new Float32Array(SIM_W * SIM_H * 2);
    for (let i = 0; i < SIM_W * SIM_H; i++) {
        data[i * 2] = 1.0;
        data[i * 2 + 1] = 0.0;
    }
    let seed = 1337;
    const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
    const blobs = 90;
    for (let b = 0; b < blobs; b++) {
        const cx = Math.floor(rand() * SIM_W);
        const cy = Math.floor(rand() * SIM_H);
        const r = 3 + Math.floor(rand() * 5);
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r) continue;
                const x = (cx + dx + SIM_W) % SIM_W;
                const y = (cy + dy + SIM_H) % SIM_H;
                const idx = (y * SIM_W + x) * 2;
                data[idx] = 0.5;
                data[idx + 1] = 0.9;
            }
        }
    }
    return data;
}

export default function Morphogenesis() {
    const canvasRef = useRef(null);
    const glRef = useRef(null);
    const paramsRef = useRef({ f: PRESETS[0].f, k: PRESETS[0].k, palette: 0, playing: true });
    const splatQueueRef = useRef([]);
    const pointerRef = useRef({ down: false, last: null });
    const mapRef = useRef(null);

    const [presetIdx, setPresetIdx] = useState(0);
    const [feed, setFeed] = useState(PRESETS[0].f);
    const [kill, setKill] = useState(PRESETS[0].k);
    const [palette, setPalette] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [supported, setSupported] = useState(true);

    // keep the animation loop reading live values without re-initializing GL
    useEffect(() => {
        paramsRef.current = { f: feed, k: kill, palette, playing };
    }, [feed, kill, palette, playing]);

    // parameter-space map: where the current feed and kill sit among the named
    // regimes on Pearson's Gray-Scott phase diagram.
    useEffect(() => {
        const c = mapRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        const W = c.width, H = c.height;
        ctx.fillStyle = '#101022';
        ctx.fillRect(0, 0, W, H);
        const padL = 34, padB = 24, padT = 12, padR = 12;
        const plotW = W - padL - padR, plotH = H - padT - padB;
        const K0 = 0.045, K1 = 0.07, F0 = 0.01, F1 = 0.09;
        const xOf = k => padL + ((k - K0) / (K1 - K0)) * plotW;
        const yOf = f => padT + (1 - (f - F0) / (F1 - F0)) * plotH;
        ctx.strokeStyle = 'rgba(230,232,255,0.14)';
        ctx.lineWidth = 1;
        ctx.strokeRect(padL, padT, plotW, plotH);
        ctx.fillStyle = 'rgba(230,232,255,0.5)';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('kill rate k', W / 2, H - 5);
        ctx.save();
        ctx.translate(10, H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('feed rate F', 0, 0);
        ctx.restore();
        for (const p of PRESETS) {
            ctx.fillStyle = 'rgba(157,141,240,0.85)';
            ctx.beginPath(); ctx.arc(xOf(p.k), yOf(p.f), 3, 0, Math.PI * 2); ctx.fill();
        }
        const cx = xOf(kill), cy = yOf(feed);
        ctx.strokeStyle = '#ffd27a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffd27a';
        ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    }, [feed, kill]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        canvas.width = RENDER_W;
        canvas.height = RENDER_H;

        const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
        if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
            setSupported(false);
            return undefined;
        }
        glRef.current = gl;

        let simProg, splatProg, renderProg, quad, vao, texA, texB, fboA, fboB;
        try {
            simProg = program(gl, SIM_FRAG);
            splatProg = program(gl, SPLAT_FRAG);
            renderProg = program(gl, RENDER_FRAG);
        } catch (err) {
            console.error('[morphogenesis]', err.message);
            setSupported(false);
            return undefined;
        }

        // fullscreen quad
        quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        function makeTex(data) {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, SIM_W, SIM_H, 0, gl.RG, gl.FLOAT, data);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            return tex;
        }
        function makeFBO(tex) {
            const fbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            return fbo;
        }

        function reset() {
            // reset BOTH ping-pong textures so the next frame reads fresh data
            // no matter which one is currently the read source
            const data = initialState();
            gl.bindTexture(gl.TEXTURE_2D, texA);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, SIM_W, SIM_H, 0, gl.RG, gl.FLOAT, data);
            gl.bindTexture(gl.TEXTURE_2D, texB);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, SIM_W, SIM_H, 0, gl.RG, gl.FLOAT, data);
        }

        texA = makeTex(initialState());
        texB = makeTex(null);
        fboA = makeFBO(texA);
        fboB = makeFBO(texB);

        const texel = [1 / SIM_W, 1 / SIM_H];
        const loc = {
            simState: gl.getUniformLocation(simProg, 'u_state'),
            simTexel: gl.getUniformLocation(simProg, 'u_texel'),
            simF: gl.getUniformLocation(simProg, 'u_f'),
            simK: gl.getUniformLocation(simProg, 'u_k'),
            simDu: gl.getUniformLocation(simProg, 'u_du'),
            simDv: gl.getUniformLocation(simProg, 'u_dv'),
            simDt: gl.getUniformLocation(simProg, 'u_dt'),
            splatState: gl.getUniformLocation(splatProg, 'u_state'),
            splatPoint: gl.getUniformLocation(splatProg, 'u_point'),
            splatRadius: gl.getUniformLocation(splatProg, 'u_radius'),
            splatAspect: gl.getUniformLocation(splatProg, 'u_aspect'),
            renderState: gl.getUniformLocation(renderProg, 'u_state'),
            renderTexel: gl.getUniformLocation(renderProg, 'u_texel'),
            renderPalette: gl.getUniformLocation(renderProg, 'u_palette'),
        };

        // ping-pong bookkeeping: `src` is the readable texture
        let src = { tex: texA, fbo: fboA };
        let dst = { tex: texB, fbo: fboB };
        const swap = () => { const t = src; src = dst; dst = t; };

        function applySplat(point) {
            gl.useProgram(splatProg);
            gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
            gl.viewport(0, 0, SIM_W, SIM_H);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, src.tex);
            gl.uniform1i(loc.splatState, 0);
            gl.uniform2f(loc.splatPoint, point[0], point[1]);
            gl.uniform1f(loc.splatRadius, 0.03);
            gl.uniform1f(loc.splatAspect, SIM_W / SIM_H);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            swap();
        }

        function simStep(f, k) {
            gl.useProgram(simProg);
            gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
            gl.viewport(0, 0, SIM_W, SIM_H);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, src.tex);
            gl.uniform1i(loc.simState, 0);
            gl.uniform2f(loc.simTexel, texel[0], texel[1]);
            gl.uniform1f(loc.simF, f);
            gl.uniform1f(loc.simK, k);
            gl.uniform1f(loc.simDu, DU);
            gl.uniform1f(loc.simDv, DV);
            gl.uniform1f(loc.simDt, DT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            swap();
        }

        function renderToScreen(pal) {
            gl.useProgram(renderProg);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, src.tex);
            gl.uniform1i(loc.renderState, 0);
            gl.uniform2f(loc.renderTexel, texel[0], texel[1]);
            gl.uniform1i(loc.renderPalette, pal);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        const session = { rafId: 0, running: true };
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function frame() {
            if (!session.running) return;
            gl.bindVertexArray(vao);
            const p = paramsRef.current;

            const queue = splatQueueRef.current;
            if (queue.length) {
                for (const pt of queue) applySplat(pt);
                splatQueueRef.current = [];
            }

            if (p.playing) {
                for (let i = 0; i < STEPS_PER_FRAME; i++) simStep(p.f, p.k);
            }
            renderToScreen(p.palette);
            session.rafId = requestAnimationFrame(frame);
        }

        let observer = null;
        const onVisibility = () => {
            const wasRunning = session.running;
            session.running = !document.hidden;
            if (session.running && !wasRunning) session.rafId = requestAnimationFrame(frame);
            else if (!session.running) cancelAnimationFrame(session.rafId);
        };

        if (reducedMotion) {
            // static developed frame, no animation loop or auto-start on scroll
            session.running = false;
            gl.bindVertexArray(vao);
            for (let i = 0; i < 1400; i++) simStep(PRESETS[0].f, PRESETS[0].k);
            renderToScreen(0);
        } else {
            session.rafId = requestAnimationFrame(frame);
            observer = new IntersectionObserver(([entry]) => {
                const wasRunning = session.running;
                session.running = entry.isIntersecting && !document.hidden;
                if (session.running && !wasRunning) session.rafId = requestAnimationFrame(frame);
            });
            observer.observe(canvas);
            document.addEventListener('visibilitychange', onVisibility);
        }

        // pointer painting: queue splats in texture uv space (y flipped)
        function toUV(e) {
            const rect = canvas.getBoundingClientRect();
            const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
            return [cx / rect.width, 1 - cy / rect.height];
        }
        function queueLine(a, b) {
            const steps = Math.max(1, Math.floor(Math.hypot((b[0] - a[0]) * SIM_W, (b[1] - a[1]) * SIM_H) / 4));
            for (let i = 1; i <= steps; i++) {
                splatQueueRef.current.push([a[0] + (b[0] - a[0]) * (i / steps), a[1] + (b[1] - a[1]) * (i / steps)]);
            }
        }
        const onDown = e => { pointerRef.current = { down: true, last: toUV(e) }; splatQueueRef.current.push(pointerRef.current.last); e.preventDefault(); };
        const onMove = e => {
            if (!pointerRef.current.down) return;
            const uv = toUV(e);
            queueLine(pointerRef.current.last, uv);
            pointerRef.current.last = uv;
            e.preventDefault();
        };
        const onUp = () => { pointerRef.current.down = false; };

        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        canvas.addEventListener('touchstart', onDown, { passive: false });
        canvas.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);

        // expose reset for the button via a ref on the canvas element
        canvas._morphReset = reset;

        return () => {
            session.running = false;
            cancelAnimationFrame(session.rafId);
            observer?.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            canvas.removeEventListener('mousedown', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            canvas.removeEventListener('touchstart', onDown);
            canvas.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
            gl.deleteProgram(simProg);
            gl.deleteProgram(splatProg);
            gl.deleteProgram(renderProg);
            gl.deleteTexture(texA);
            gl.deleteTexture(texB);
            gl.deleteFramebuffer(fboA);
            gl.deleteFramebuffer(fboB);
            gl.deleteBuffer(quad);
            gl.deleteVertexArray(vao);
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        };
        // GL is initialized once; live params flow through paramsRef.
    }, []);

    function choosePreset(i) {
        setPresetIdx(i);
        setFeed(PRESETS[i].f);
        setKill(PRESETS[i].k);
    }

    function onReset() {
        canvasRef.current?._morphReset?.();
    }

    return (
        <section className={`section ${styles.morph}`} id="morphogenesis">
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Live Demo · Computational Biology</span>
                    <h2 className="section-header__title">How the Leopard Got Its Spots</h2>
                    <p className="section-header__description">
                        In 1952 Alan Turing showed that two diffusing chemicals, an activator
                        and an inhibitor, can turn a featureless sheet of cells into spots and
                        stripes on their own. That single idea explains animal coats, coral,
                        and the ridges of your fingerprints. Here it is running live on your
                        GPU. Pick a regime, then click and drag on the canvas to paint fresh
                        activator and watch the pattern heal around your strokes.
                    </p>
                </div>

                {supported ? (
                    <>
                        <div className={styles.controls}>
                            {PRESETS.map((p, i) => (
                                <button
                                    key={p.name}
                                    className={`${styles.pill} ${presetIdx === i ? styles.pillActive : ''}`}
                                    onClick={() => choosePreset(i)}
                                    title={p.note}
                                >
                                    {p.name}
                                </button>
                            ))}
                            <button className={styles.pill} onClick={onReset}>Reset</button>
                            <button
                                className={`${styles.pill} ${!playing ? styles.pillActive : ''}`}
                                onClick={() => setPlaying(v => !v)}
                            >
                                {playing ? 'Pause' : 'Play'}
                            </button>
                        </div>

                        <div className={styles.stage}>
                            <canvas ref={canvasRef} className={styles.canvas} aria-label="Live reaction-diffusion pattern you can paint into" />
                            <span className={styles.readout}>
                                {presetIdx >= 0 ? PRESETS[presetIdx].name : 'Custom'} · F {feed.toFixed(4)} · k {kill.toFixed(4)}
                            </span>
                            <span className={styles.hint}>click and drag to paint</span>
                        </div>

                        <div className={styles.sliders}>
                            <label className={styles.slider}>
                                <span>feed rate F <b>{feed.toFixed(4)}</b></span>
                                <input
                                    type="range" min="0.01" max="0.09" step="0.0005"
                                    value={feed}
                                    onChange={e => { setFeed(parseFloat(e.target.value)); setPresetIdx(-1); }}
                                />
                            </label>
                            <label className={styles.slider}>
                                <span>kill rate k <b>{kill.toFixed(4)}</b></span>
                                <input
                                    type="range" min="0.045" max="0.07" step="0.0005"
                                    value={kill}
                                    onChange={e => { setKill(parseFloat(e.target.value)); setPresetIdx(-1); }}
                                />
                            </label>
                            <div className={styles.paletteRow}>
                                {PALETTES.map((name, i) => (
                                    <button
                                        key={name}
                                        className={`${styles.paletteBtn} ${palette === i ? styles.paletteActive : ''}`}
                                        onClick={() => setPalette(i)}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.mapWrap}>
                            <span className={styles.mapLabel}>Where you are in Gray-Scott space</span>
                            <canvas
                                ref={mapRef}
                                width={280}
                                height={200}
                                className={styles.mapCanvas}
                                aria-label="Feed versus kill parameter map with the current point among the named pattern regimes"
                            />
                            <span className={styles.mapHint}>purple: named presets · amber ring: your F and k (Pearson, 1993)</span>
                        </div>
                    </>
                ) : (
                    <p className={styles.fallback}>
                        This demo needs WebGL2 with float textures, which this browser did not
                        provide. The other live demos on this page run without it.
                    </p>
                )}

                <details className={styles.underHood}>
                    <summary className={styles.underHoodSummary}>
                        Under the hood: this is real developmental biology
                    </summary>
                    <div className={styles.underHoodBody}>
                        <ul className={styles.underHoodList}>
                            <li>
                                <strong>Diffusion-driven instability.</strong> Turing&apos;s
                                counterintuitive result: diffusion, which normally smooths things
                                out, can instead <em>create</em> structure when a slow-spreading
                                activator is chased by a fast-spreading inhibitor. Short-range
                                activation plus long-range inhibition is the whole trick. The
                                model here is the Gray-Scott system, an autocatalytic reaction
                                U + 2V &rarr; 3V balanced by a feed rate F and a kill rate k.
                            </li>
                            <li>
                                <strong>The parameter map is the science.</strong> Pearson&apos;s
                                1993 <em>Science</em> paper catalogued how tiny changes in F and k
                                move the system between spots, stripes, mazes, and
                                self-replicating solitons. Drag the two sliders and you are
                                walking that map yourself; the presets are just named coordinates
                                in it.
                            </li>
                            <li>
                                <strong>It matches real organisms.</strong> Kondo &amp; Miura
                                (<em>Science</em>, 2010) showed zebrafish stripes rearrange exactly
                                as a Turing system predicts. Sheth et al. (<em>Science</em>, 2012)
                                found digit spacing in the limb is set by a Turing mechanism whose
                                wavelength Hox genes tune. Glover et al. (<em>Cell</em>, 2023)
                                traced human fingerprint ridges to a reaction-diffusion system of
                                WNT, BMP, and EDAR signals. The spots you are painting into are
                                the same mathematics.
                            </li>
                            <li>
                                <strong>Engineered for the browser.</strong> The chemical field
                                lives in a pair of 512&times;320 floating-point textures. A
                                fragment shader advances {STEPS_PER_FRAME} Euler steps of the
                                reaction-diffusion PDE per animation frame by ping-ponging between
                                them, a second shader injects activator where you paint, and a
                                third maps concentration through a colour ramp with in-shader
                                bilinear upsampling. No pixel ever leaves the GPU.
                            </li>
                        </ul>
                    </div>
                </details>

                <p className={styles.footnote}>
                    Same instinct as the rest of this site: take a deep idea, implement it
                    correctly from the equations up, and make it something you can touch.
                </p>
            </div>
        </section>
    );
}
