/**
 * Pure retrieval logic for Ask My Portfolio. Mirrors the math used by
 * scripts/test_rag_retrieval.mjs so the browser behavior is exactly
 * what the eval harness measured.
 */

export const NO_MATCH_THRESHOLD = 0.2;

/** Decode a base64 int8 vector and renormalize to unit length. */
export function decodeVector(b64, dim) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const int8 = new Int8Array(bytes.buffer, bytes.byteOffset, dim);
    const v = new Float32Array(dim);
    let norm = 0;
    for (let i = 0; i < dim; i++) {
        v[i] = int8[i] / 127;
        norm += v[i] * v[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) v[i] /= norm;
    return v;
}

/** Build a searcher over the static index. Decodes all vectors once. */
export function buildSearcher(index) {
    const vectors = index.chunks.map(chunk => decodeVector(chunk.v, index.dim));

    function search(queryVector, k = 4) {
        const scored = index.chunks.map((chunk, i) => {
            let dot = 0;
            const v = vectors[i];
            for (let j = 0; j < index.dim; j++) dot += queryVector[j] * v[j];
            return { chunk, score: dot };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, k);
    }

    return { search };
}

/** Project a query embedding into the index's 3D PCA space. */
export function projectTo3d(queryVector, pca) {
    return pca.components.map(component => {
        let dot = 0;
        for (let i = 0; i < component.length; i++) {
            dot += (queryVector[i] - pca.mean[i]) * component[i];
        }
        return dot;
    });
}
