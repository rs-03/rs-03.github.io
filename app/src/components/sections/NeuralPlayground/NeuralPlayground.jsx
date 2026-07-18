'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { siteConfig } from '@/data/siteConfig';
import modelData from './model.json';
import { createModel } from './inference';
import { pixelsToInput } from './preprocess';
import styles from './NeuralPlayground.module.css';

const ARTICLE_URL = 'https://dev.to/rahul_sangamker_653e0c1ba/i-put-a-neural-network-inside-my-portfolio-no-tensorflow-no-server-145-kb-32k7';

const CANVAS_SIZE = 280;
// Sampled neuron indices shown in the visualization
const H1_INDICES = Array.from({ length: 32 }, (_, i) => i * 4);
const H2_INDICES = Array.from({ length: 16 }, (_, i) => i * 4);
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function sampleActivations(layer, indices) {
    let max = 0;
    for (let i = 0; i < layer.length; i++) {
        if (layer[i] > max) max = layer[i];
    }
    return indices.map(i => (max > 0 ? layer[i] / max : 0));
}

/**
 * Live Demo - a real neural network (trained from scratch, int8-quantized)
 * classifying hand-drawn digits entirely in the browser.
 */
export default function NeuralPlayground() {
    const canvasRef = useRef(null);
    const previewRef = useRef(null);
    const saliencyRef = useRef(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef(null);
    const lastPredictRef = useRef(0);

    const model = useMemo(() => createModel(modelData), []);
    const [result, setResult] = useState(null);
    const [hasInk, setHasInk] = useState(false);

    const predict = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { data } = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const input = pixelsToInput(data, CANVAS_SIZE, CANVAS_SIZE);

        if (!input) {
            setResult(null);
            return;
        }

        const { probs, hidden } = model.forward(input);
        let digit = 0;
        for (let i = 1; i < 10; i++) {
            if (probs[i] > probs[digit]) digit = i;
        }

        setResult({
            digit,
            confidence: probs[digit],
            probs: Array.from(probs),
            h1: sampleActivations(hidden[0], H1_INDICES),
            h2: sampleActivations(hidden[1], H2_INDICES),
        });

        // Render what the network actually sees (28x28)
        const preview = previewRef.current;
        if (preview) {
            const pctx = preview.getContext('2d');
            const img = pctx.createImageData(28, 28);
            for (let i = 0; i < 784; i++) {
                const v = Math.round(input[i] * 255);
                img.data[i * 4] = v;
                img.data[i * 4 + 1] = v;
                img.data[i * 4 + 2] = v;
                img.data[i * 4 + 3] = 255;
            }
            pctx.putImageData(img, 0, 0);
        }

        // Saliency: how much each pixel pushed the winning digit's score up or
        // down (gradient of the logit times the ink actually present there).
        const salCanvas = saliencyRef.current;
        if (salCanvas) {
            const grad = model.saliency(input, digit);
            let maxAbs = 1e-6;
            const contrib = new Float32Array(784);
            for (let i = 0; i < 784; i++) {
                const c = grad[i] * input[i];
                contrib[i] = c;
                const m = Math.abs(c);
                if (m > maxAbs) maxAbs = m;
            }
            const sctx = salCanvas.getContext('2d');
            const simg = sctx.createImageData(28, 28);
            for (let i = 0; i < 784; i++) {
                const n = contrib[i] / maxAbs; // [-1, 1]
                const t = Math.pow(Math.min(1, Math.abs(n)), 0.6);
                if (n >= 0) {
                    simg.data[i * 4] = 255 * t;
                    simg.data[i * 4 + 1] = 70 * t;
                    simg.data[i * 4 + 2] = 70 * t;
                } else {
                    simg.data[i * 4] = 70 * t;
                    simg.data[i * 4 + 1] = 130 * t;
                    simg.data[i * 4 + 2] = 255 * t;
                }
                simg.data[i * 4 + 3] = 255;
            }
            sctx.putImageData(simg, 0, 0);
        }
    }, [model]);

    const getPoint = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) * canvas.width) / rect.width,
            y: ((e.clientY - rect.top) * canvas.height) / rect.height,
        };
    };

    const handlePointerDown = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        canvas.setPointerCapture(e.pointerId);
        drawingRef.current = true;
        lastPointRef.current = getPoint(e);
        setHasInk(true);
    };

    const handlePointerMove = (e) => {
        if (!drawingRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const point = getPoint(e);
        const last = lastPointRef.current;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPointRef.current = point;

        // Live prediction while drawing, throttled
        const now = performance.now();
        if (now - lastPredictRef.current > 120) {
            lastPredictRef.current = now;
            predict();
        }
    };

    const handlePointerUp = () => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        predict();
    };

    const clear = () => {
        const canvas = canvasRef.current;
        canvas.getContext('2d').clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const preview = previewRef.current;
        if (preview) {
            preview.getContext('2d').clearRect(0, 0, 28, 28);
        }
        const sal = saliencyRef.current;
        if (sal) {
            sal.getContext('2d').clearRect(0, 0, 28, 28);
        }
        setResult(null);
        setHasInk(false);
    };

    return (
        <section className={`section ${styles.playground}`} id="live-demo">
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Live Demo · No Smoke, No Mirrors</span>
                    <h2 className="section-header__title">Draw a Digit. Watch a Neural Net Think.</h2>
                    <p className="section-header__description">
                        A neural network I trained from scratch with just Python and math, no ML
                        frameworks, compressed to 145&nbsp;KB and running in your browser right
                        now as pure JavaScript. No libraries, no GPU, no API calls.
                    </p>
                </div>

                <div className={styles.lab}>
                    {/* Draw panel */}
                    <div className={styles.panel}>
                        <span className={styles.panelLabel}>Your Canvas</span>
                        <div className={styles.canvasWrapper}>
                            <canvas
                                ref={canvasRef}
                                width={CANVAS_SIZE}
                                height={CANVAS_SIZE}
                                className={styles.drawCanvas}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                            />
                            {!hasInk && (
                                <span className={styles.canvasHint}>✏️ Draw a digit (0–9) here</span>
                            )}
                        </div>
                        <button onClick={clear} className={styles.clearBtn} disabled={!hasInk}>
                            Clear
                        </button>
                    </div>

                    {/* Network visualization */}
                    <div className={`${styles.panel} ${styles.networkPanel}`}>
                        <span className={styles.panelLabel}>Inside the Network</span>
                        <div className={styles.network}>
                            <div className={styles.layer}>
                                <canvas
                                    ref={previewRef}
                                    width={28}
                                    height={28}
                                    className={styles.inputPreview}
                                />
                                <span className={styles.layerLabel}>input 28×28</span>
                            </div>

                            <div className={styles.flow} aria-hidden="true">
                                <span /><span /><span />
                            </div>

                            <div className={styles.layer}>
                                <div className={styles.neuronGrid}>
                                    {H1_INDICES.map((idx, i) => (
                                        <span
                                            key={idx}
                                            className={styles.neuron}
                                            style={{ '--a': result ? result.h1[i] : 0 }}
                                        />
                                    ))}
                                </div>
                                <span className={styles.layerLabel}>dense 128 · relu</span>
                            </div>

                            <div className={styles.flow} aria-hidden="true">
                                <span /><span /><span />
                            </div>

                            <div className={styles.layer}>
                                <div className={`${styles.neuronGrid} ${styles.neuronGridSmall}`}>
                                    {H2_INDICES.map((idx, i) => (
                                        <span
                                            key={idx}
                                            className={styles.neuron}
                                            style={{ '--a': result ? result.h2[i] : 0 }}
                                        />
                                    ))}
                                </div>
                                <span className={styles.layerLabel}>dense 64 · relu</span>
                            </div>

                            <div className={styles.flow} aria-hidden="true">
                                <span /><span /><span />
                            </div>

                            <div className={styles.layer}>
                                <div className={styles.outputColumn}>
                                    {DIGITS.map(d => (
                                        <span
                                            key={d}
                                            className={`${styles.outputNode} ${result?.digit === d ? styles.outputActive : ''}`}
                                            style={{ '--a': result ? result.probs[d] : 0 }}
                                        >
                                            {d}
                                        </span>
                                    ))}
                                </div>
                                <span className={styles.layerLabel}>softmax</span>
                            </div>
                        </div>
                    </div>

                    {/* Prediction panel */}
                    <div className={styles.panel}>
                        <span className={styles.panelLabel}>Prediction</span>
                        <div className={styles.verdict}>
                            <span className={styles.verdictDigit}>
                                {result ? result.digit : '·'}
                            </span>
                            <span className={styles.verdictConf}>
                                {result
                                    ? `${(result.confidence * 100).toFixed(1)}% confident`
                                    : 'waiting for ink…'}
                            </span>
                        </div>
                        <div className={styles.bars}>
                            {DIGITS.map(d => (
                                <div key={d} className={styles.barRow}>
                                    <span className={styles.barDigit}>{d}</span>
                                    <div className={styles.barTrack}>
                                        <div
                                            className={`${styles.barFill} ${result?.digit === d ? styles.barTop : ''}`}
                                            style={{ width: `${result ? Math.max(result.probs[d] * 100, 1) : 1}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.saliency}>
                            <span className={styles.saliencyLabel}>Why this digit? Pixel influence</span>
                            <div className={styles.saliencyBody}>
                                <canvas
                                    ref={saliencyRef}
                                    width={28}
                                    height={28}
                                    className={styles.saliencyCanvas}
                                    aria-label="Saliency map: pixels that most influenced the prediction"
                                />
                                <div className={styles.saliencyText}>
                                    {result ? (
                                        <>
                                            <span className={styles.salItem}><i style={{ background: '#ef4444' }} /> pushed toward <b>{result.digit}</b></span>
                                            <span className={styles.salItem}><i style={{ background: '#3b82f6' }} /> pushed away</span>
                                            <span className={styles.salHint}>gradient of the score for {result.digit}, per pixel</span>
                                        </>
                                    ) : (
                                        <span className={styles.salHint}>Draw a digit to see which strokes the network leans on.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <p className={styles.specs}>
                    {model.info.params.toLocaleString('en-US')} parameters
                    <span className={styles.specDot}>·</span>
                    {(model.info.testAccuracy * 100).toFixed(1)}% test accuracy
                    <span className={styles.specDot}>·</span>
                    int8-quantized
                    <span className={styles.specDot}>·</span>
                    zero dependencies
                </p>

                <details className={styles.howItsBuilt}>
                    <summary className={styles.howSummary}>
                        How this was built: see the actual code
                    </summary>
                    <div className={styles.howBody}>
                        <ul className={styles.howList}>
                            <li>
                                <strong>Trained from scratch</strong> in raw NumPy: hand-written
                                forward/backward passes and Adam optimizer, no ML framework.
                                Shift augmentation makes it tolerant of off-center drawings.
                                {' '}
                                <a href={`${siteConfig.social.repo}/blob/main/scripts/train_digit_model.py`} target="_blank" rel="noopener noreferrer">
                                    train_digit_model.py →
                                </a>
                            </li>
                            <li>
                                <strong>Compressed for the web</strong>: weights int8-quantized
                                (~4× smaller) with no measurable accuracy loss, shipped as a
                                145&nbsp;KB JSON file inside this page.
                            </li>
                            <li>
                                <strong>Inference is ~80 lines of plain JavaScript</strong>: the
                                matrix math runs right here, no TensorFlow.js, no API.
                                {' '}
                                <a href={`${siteConfig.social.repo}/blob/main/app/src/components/sections/NeuralPlayground/inference.js`} target="_blank" rel="noopener noreferrer">
                                    inference.js →
                                </a>
                            </li>
                            <li>
                                <strong>Verified, not vibes</strong>: a parity test asserts the
                                JS engine reproduces the Python model&apos;s probabilities to
                                within 1e-6.
                                {' '}
                                <a href={`${siteConfig.social.repo}/blob/main/scripts/test_inference_parity.mjs`} target="_blank" rel="noopener noreferrer">
                                    test_inference_parity.mjs →
                                </a>
                            </li>
                            <li>
                                <strong>It shows its reasoning</strong>: the saliency map is the
                                exact gradient of the winning digit&apos;s score with respect to
                                every pixel (Simonyan, Vedaldi &amp; Zisserman, 2013),
                                backpropagated through these same weights and multiplied by the ink
                                that&apos;s actually there. Red strokes raised that score, blue
                                lowered it. Interpretability, not a decorative heatmap.
                            </li>
                        </ul>
                    </div>
                </details>

                {ARTICLE_URL && (
                    <p className="demo-article-link">
                        <a href={ARTICLE_URL} target="_blank" rel="noopener noreferrer">
                            📝 Read the build deep-dive on Medium →
                        </a>
                    </p>
                )}
            </div>
        </section>
    );
}
