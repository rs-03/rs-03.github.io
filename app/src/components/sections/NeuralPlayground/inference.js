/**
 * Pure-JavaScript MLP inference for the digit recognition demo.
 * No ML libraries — weights are int8-quantized, dequantized once on load.
 *
 * Framework-free on purpose: the same code is unit-tested in Node
 * against logits produced by the Python training script.
 */

function decodeWeights(layer) {
    const bytes = Uint8Array.from(atob(layer.w), c => c.charCodeAt(0));
    const int8 = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length);
    const w = new Float32Array(int8.length);
    for (let i = 0; i < int8.length; i++) {
        w[i] = int8[i] * layer.scale;
    }
    return w;
}

/**
 * @param {object} modelData - parsed model.json
 * @returns {{ forward: (input: Float32Array) => { probs: Float32Array, hidden: Float32Array[] }, info: object }}
 */
export function createModel(modelData) {
    const layers = modelData.layers.map(layer => ({
        w: decodeWeights(layer),
        b: Float32Array.from(layer.b),
        rows: layer.rows,
        cols: layer.cols,
    }));

    function forward(input) {
        let a = input;
        const hidden = [];

        for (let li = 0; li < layers.length; li++) {
            const { w, b, rows, cols } = layers[li];
            const out = new Float32Array(cols);
            for (let j = 0; j < cols; j++) {
                let sum = b[j];
                for (let i = 0; i < rows; i++) {
                    sum += a[i] * w[i * cols + j];
                }
                out[j] = sum;
            }

            if (li < layers.length - 1) {
                for (let j = 0; j < cols; j++) {
                    if (out[j] < 0) out[j] = 0;
                }
                hidden.push(out);
            } else {
                // softmax
                let max = -Infinity;
                for (let j = 0; j < cols; j++) {
                    if (out[j] > max) max = out[j];
                }
                let sum = 0;
                for (let j = 0; j < cols; j++) {
                    out[j] = Math.exp(out[j] - max);
                    sum += out[j];
                }
                for (let j = 0; j < cols; j++) {
                    out[j] /= sum;
                }
                return { probs: out, hidden };
            }

            a = out;
        }

        throw new Error('model has no layers');
    }

    // Vanilla-gradient saliency (Simonyan, Vedaldi & Zisserman, 2013): the exact
    // gradient of the chosen class logit with respect to every input pixel,
    // obtained by backpropagating a one-hot through the same weights. Positive
    // values mean a pixel raises that class score, negative values lower it.
    function saliency(input, classIdx) {
        // forward, caching each layer's pre-activation for the ReLU masks
        let a = input;
        const preacts = [];
        for (let li = 0; li < layers.length; li++) {
            const { w, b, rows, cols } = layers[li];
            const z = new Float32Array(cols);
            for (let j = 0; j < cols; j++) {
                let sum = b[j];
                for (let i = 0; i < rows; i++) sum += a[i] * w[i * cols + j];
                z[j] = sum;
            }
            preacts.push(z);
            if (li < layers.length - 1) {
                const out = new Float32Array(cols);
                for (let j = 0; j < cols; j++) out[j] = z[j] > 0 ? z[j] : 0;
                a = out;
            }
        }

        // backprop a one-hot on the output logits down to the input
        const L = layers.length;
        let grad = new Float32Array(layers[L - 1].cols);
        grad[classIdx] = 1;
        for (let li = L - 1; li >= 0; li--) {
            const { w, rows, cols } = layers[li];
            const dIn = new Float32Array(rows);
            for (let i = 0; i < rows; i++) {
                let s = 0;
                const base = i * cols;
                for (let j = 0; j < cols; j++) s += grad[j] * w[base + j];
                dIn[i] = s;
            }
            // the activation feeding this layer came through a ReLU (except the input)
            if (li > 0) {
                const zPrev = preacts[li - 1];
                for (let i = 0; i < rows; i++) if (zPrev[i] <= 0) dIn[i] = 0;
            }
            grad = dIn;
        }
        return grad; // Float32Array(784): d logit[classIdx] / d input
    }

    // Raw pre-softmax logits (used by the saliency finite-difference test).
    function logits(input) {
        let a = input;
        for (let li = 0; li < layers.length; li++) {
            const { w, b, rows, cols } = layers[li];
            const out = new Float32Array(cols);
            for (let j = 0; j < cols; j++) {
                let sum = b[j];
                for (let i = 0; i < rows; i++) sum += a[i] * w[i * cols + j];
                out[j] = sum;
            }
            if (li < layers.length - 1) {
                for (let j = 0; j < cols; j++) if (out[j] < 0) out[j] = 0;
            }
            a = out;
        }
        return a;
    }

    return {
        forward,
        saliency,
        logits,
        info: {
            arch: modelData.arch,
            params: modelData.params,
            testAccuracy: modelData.testAccuracy,
        },
    };
}
