# Every Token Looks at Every Token: Attention, Computed Live on Your Sentence

*I built a browser demo that runs a real language model on a sentence you type, then computes and draws the self-attention over its tokens. Here is the operation, the code, and an honest account of exactly what the picture is and is not.*

## The idea that unlocked modern AI

Before 2017, models read text the way you read a ticker tape: one token at a time, carrying a summary forward and quietly forgetting the beginning by the time they reached the end. Long-range meaning leaked away, and the strictly sequential processing was hard to parallelize.

Attention replaced that with a simple, radical move: let every token look at every other token in one step and decide which ones matter. "Attention Is All You Need" (Vaswani et al., 2017) showed that this operation, stacked into layers, was enough to build the whole model. Every large language model in use today rests on it.

## The operation

Self-attention turns each token into three vectors: a query, a key, and a value. Then, for every token, it scores that token's query against every token's key with a dot product, scales the scores down by the square root of the dimension so they do not explode, softmaxes each row into weights that sum to one, and mixes the value vectors by those weights:

```
Attention(Q, K, V) = softmax( Q Kᵀ / sqrt(d) ) V
```

The softmax row is the interesting part to look at. For a given token it is a probability distribution over the whole sentence: where does this token pay attention? That distribution is what the demo draws, as both a matrix and a set of arcs.

## What I could get, and what I could not

Here is the honest part, and it matters.

The demo runs a real model in your browser: MiniLM, a small distilled sentence encoder from the transformer family, loaded through the transformers.js library and executed with WebAssembly. Asking it for per-token output is one line:

```javascript
const out = await embed(sentence, { pooling: 'none', normalize: false });
// out.dims === [1, T, 384]: one 384-dim contextual vector per token
```

What I cannot get from it is the model's own internal attention weights. The model is shipped as an ONNX graph exported for inference, and that export emits only the final token embeddings, not the attention tensors from inside each layer. I confirmed this directly: the output has exactly one field, `last_hidden_state`.

So I did the honest thing. Rather than fake internal heads or claim something the export does not provide, the demo computes the self-attention operation over the model's real contextual token vectors. I normalize each token vector and softmax the scaled dot products between them:

```javascript
for (let i = 0; i < T; i++) {
    const row = new Float64Array(T);
    let mx = -Infinity;
    for (let j = 0; j < T; j++) {
        let d = 0;
        for (let k = 0; k < D; k++) d += E[i][k] * E[j][k]; // E rows are unit length
        row[j] = d * tau;                                    // tau is the focus control
        if (row[j] > mx) mx = row[j];
    }
    let sum = 0;
    for (let j = 0; j < T; j++) { row[j] = Math.exp(row[j] - mx); sum += row[j]; }
    for (let j = 0; j < T; j++) row[j] /= sum;               // the row now sums to 1
    A.push(Array.from(row));
}
```

This is the exact attention mechanism, applied to representations a real model actually produced. It is not a read-out of that model's internal heads. Same math, real vectors, no pretending otherwise. Saying so plainly is more useful to anyone technical than an overclaim would be.

## Verify, do not vibe

Because each attention row is supposed to be a genuine softmax distribution, that is a property you can check rather than trust. The demo exposes its computed matrix to an automated test that asserts, for every row:

- The weights are non-negative.
- The weights sum to one, measured deviation on the order of 1e-16, which is floating-point machine precision.
- The matrix is square with one row and column per token, and the tokens are bracketed by the model's `[CLS]` and `[SEP]` markers, matching the embedding rows exactly.

If any of those failed, the softmax or the token alignment would be wrong, and the whole picture would be meaningless.

## What you actually see

Because the vectors are real contextual embeddings, the attention tracks the semantic structure the model encodes, not random noise. Type a sentence with a pronoun and watch it lean toward the noun it refers to. Because a token is always most similar to itself, the matrix has a bright diagonal, so the arc view renormalizes over the other tokens to surface the cross-token structure that is actually interesting. A focus control sharpens or softens how concentrated the attention is, which is the temperature term in the softmax made tangible.

## Where this goes

The single-head, similarity-based view is the floor. The real mechanism has more to show:

- Multiple heads. A transformer layer runs many attention heads in parallel, and different heads specialize, some tracking syntax, some tracking coreference. Visualizing several at once, in the spirit of tools like BertViz, is the natural next step.
- Learned projections. Real queries and keys come from learned weight matrices, not raw embeddings, which is why heads can attend on features that plain similarity misses. Loading a model exported with its attention tensors intact would let the demo show the genuine internal weights.
- Depth. Attention composes across layers. Early layers attend locally, later layers globally, and watching that shift is one of the clearer windows into how a model builds meaning.

## The pattern generalizes

The lesson under the demo is bigger than one visualization. A model is not a black box you can only prod from the outside. Its intermediate representations are real numbers you can pull out, compute on, and check. That habit, treat the internals as inspectable and verify the properties you claim, is the difference between using AI and understanding it, and it is exactly what a client is paying for when they hire someone to build with these systems.

**Try it live** (the model runs on your device, nothing is uploaded): [rs-03.github.io/demos](https://rs-03.github.io/demos/#attention)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Attention Lens component.

*This visualizes the self-attention operation over a real model's token embeddings; it is not a read-out of the model's internal attention heads.*
