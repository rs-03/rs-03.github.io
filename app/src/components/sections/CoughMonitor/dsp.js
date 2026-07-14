/**
 * Audio DSP for the cough baseline monitor — hand-rolled, zero dependencies.
 *
 * Pipeline: peak-centered trim → framing (Hamming) → FFT → mel filterbank
 * → log energies → DCT-II → MFCC fingerprint (mean + std of c1..c12).
 * Similarity between fingerprints is cosine similarity.
 *
 * Pure functions only (no Web Audio APIs) so the whole pipeline is
 * unit-testable in Node — see scripts/test_cough_dsp.mjs.
 */

const FRAME_SIZE = 1024;
const HOP_SIZE = 512;
const NUM_MEL_FILTERS = 26;
const NUM_MFCC = 12; // c1..c12 (c0/energy dropped)
const CLIP_SECONDS = 1.2;

/* ---------- FFT (iterative radix-2, real input) ---------- */

function fft(re, im) {
    const n = re.length;
    if ((n & (n - 1)) !== 0) throw new Error('FFT size must be a power of 2');

    // bit reversal
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }

    for (let len = 2; len <= n; len <<= 1) {
        const angle = (-2 * Math.PI) / len;
        const wRe = Math.cos(angle);
        const wIm = Math.sin(angle);
        for (let i = 0; i < n; i += len) {
            let curRe = 1, curIm = 0;
            for (let j = 0; j < len / 2; j++) {
                const aRe = re[i + j];
                const aIm = im[i + j];
                const bRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
                const bIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
                re[i + j] = aRe + bRe;
                im[i + j] = aIm + bIm;
                re[i + j + len / 2] = aRe - bRe;
                im[i + j + len / 2] = aIm - bIm;
                const nextRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = nextRe;
            }
        }
    }
}

/** Power spectrum of one frame (first n/2+1 bins). */
export function powerSpectrum(frame) {
    const n = frame.length;
    const re = Float64Array.from(frame);
    const im = new Float64Array(n);
    fft(re, im);
    const out = new Float64Array(n / 2 + 1);
    for (let i = 0; i <= n / 2; i++) {
        out[i] = (re[i] * re[i] + im[i] * im[i]) / n;
    }
    return out;
}

/* ---------- Mel filterbank ---------- */

const hzToMel = hz => 2595 * Math.log10(1 + hz / 700);
const melToHz = mel => 700 * (10 ** (mel / 2595) - 1);

/**
 * Triangular mel filterbank as a (numFilters x numBins) sparse weight matrix.
 */
export function buildMelFilterbank(sampleRate, fftSize = FRAME_SIZE, numFilters = NUM_MEL_FILTERS) {
    const numBins = fftSize / 2 + 1;
    const lowMel = hzToMel(60);
    const highMel = hzToMel(Math.min(8000, sampleRate / 2));
    const melPoints = [];
    for (let i = 0; i < numFilters + 2; i++) {
        melPoints.push(melToHz(lowMel + ((highMel - lowMel) * i) / (numFilters + 1)));
    }
    const binOf = hz => Math.floor(((fftSize + 1) * hz) / sampleRate);

    const filters = [];
    for (let f = 0; f < numFilters; f++) {
        const weights = new Float64Array(numBins);
        const left = binOf(melPoints[f]);
        const center = binOf(melPoints[f + 1]);
        const right = binOf(melPoints[f + 2]);
        for (let b = left; b < center; b++) {
            if (b >= 0 && b < numBins && center !== left) weights[b] = (b - left) / (center - left);
        }
        for (let b = center; b <= right; b++) {
            if (b >= 0 && b < numBins && right !== center) weights[b] = (right - b) / (right - center);
        }
        filters.push(weights);
    }
    return filters;
}

/* ---------- MFCC ---------- */

/** Hamming window of a given size (also used by the Signal Microscope demo). */
export function hammingWindow(size) {
    const w = new Float64Array(size);
    for (let i = 0; i < size; i++) {
        w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
    }
    return w;
}

export function dct2(input, numCoeffs) {
    const n = input.length;
    const out = new Float64Array(numCoeffs);
    for (let k = 0; k < numCoeffs; k++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += input[i] * Math.cos((Math.PI * k * (i + 0.5)) / n);
        }
        out[k] = sum;
    }
    return out;
}

/**
 * Trim to the highest-energy CLIP_SECONDS window (centers on the cough).
 */
export function trimToPeak(samples, sampleRate, clipSeconds = CLIP_SECONDS) {
    const clipLength = Math.min(samples.length, Math.floor(sampleRate * clipSeconds));
    if (samples.length <= clipLength) return samples;

    const block = Math.floor(sampleRate * 0.05);
    let bestStart = 0;
    let bestEnergy = -1;
    for (let start = 0; start + clipLength <= samples.length; start += block) {
        let energy = 0;
        for (let i = start; i < start + clipLength; i += 4) {
            energy += samples[i] * samples[i];
        }
        if (energy > bestEnergy) {
            bestEnergy = energy;
            bestStart = start;
        }
    }
    return samples.subarray(bestStart, bestStart + clipLength);
}

/**
 * Mel spectrogram (numFrames x numFilters log energies) — also used for display.
 */
export function melSpectrogram(samples, sampleRate) {
    const filters = buildMelFilterbank(sampleRate);
    const frames = [];
    const window = new Float64Array(FRAME_SIZE);
    for (let i = 0; i < FRAME_SIZE; i++) {
        window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1)); // Hamming
    }

    for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
        const frame = new Float64Array(FRAME_SIZE);
        for (let i = 0; i < FRAME_SIZE; i++) {
            frame[i] = samples[start + i] * window[i];
        }
        const power = powerSpectrum(frame);
        const melEnergies = new Float64Array(filters.length);
        for (let f = 0; f < filters.length; f++) {
            let sum = 0;
            const weights = filters[f];
            for (let b = 0; b < power.length; b++) {
                if (weights[b] !== 0) sum += weights[b] * power[b];
            }
            melEnergies[f] = Math.log(sum + 1e-10);
        }
        frames.push(melEnergies);
    }
    return frames;
}

/**
 * Fixed-size acoustic fingerprint: mean + std of MFCC c1..c12 across frames.
 * @returns {{ fingerprint: number[], spectrogram: number[][] } | null}
 */
export function computeFingerprint(samples, sampleRate) {
    const trimmed = trimToPeak(samples, sampleRate);
    const spectrogram = melSpectrogram(trimmed, sampleRate);
    if (spectrogram.length < 4) return null;

    const mfccFrames = spectrogram.map(mel => dct2(mel, NUM_MFCC + 1).slice(1)); // drop c0

    const mean = new Array(NUM_MFCC).fill(0);
    const std = new Array(NUM_MFCC).fill(0);
    for (const coeffs of mfccFrames) {
        for (let i = 0; i < NUM_MFCC; i++) mean[i] += coeffs[i];
    }
    for (let i = 0; i < NUM_MFCC; i++) mean[i] /= mfccFrames.length;
    for (const coeffs of mfccFrames) {
        for (let i = 0; i < NUM_MFCC; i++) std[i] += (coeffs[i] - mean[i]) ** 2;
    }
    for (let i = 0; i < NUM_MFCC; i++) std[i] = Math.sqrt(std[i] / mfccFrames.length);

    return {
        fingerprint: [...mean, ...std],
        spectrogram: spectrogram.map(row => Array.from(row)),
    };
}

/** Cosine similarity between two fingerprints, in [-1, 1]. */
export function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compare a new fingerprint against baseline fingerprints.
 * @returns {{ similarity: number, deviation: number, verdict: string }}
 */
export function compareToBaseline(fingerprint, baselineFingerprints) {
    let best = -1;
    for (const baseline of baselineFingerprints) {
        best = Math.max(best, cosineSimilarity(fingerprint, baseline));
    }
    const similarity = Math.max(0, best);
    const deviation = (1 - similarity) * 100;

    let verdict;
    if (similarity >= 0.92) verdict = 'consistent';
    else if (similarity >= 0.8) verdict = 'some-deviation';
    else verdict = 'significant-deviation';

    return { similarity, deviation, verdict };
}
