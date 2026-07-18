# Every Token Looks at Every Token: Attention, Computed Live on Your Sentence

*I built a browser demo that runs a real language model on a sentence you type, then computes and draws the self-attention over its tokens. Here is the operation, the code, and an honest account of exactly what the picture is and is not.*

## The idea that unlocked modern AI

Before 2017, models read text one token at a time. Picture a ticker tape: the model carries a running summary forward and, by the time it reaches the end of a long sentence, it has quietly forgotten the start. Meaning at a distance leaks away. And because each step depends on the one before it, you can't parallelize much of the work.

Attention threw that out. The move is simple and, honestly, a little radical: let every token look at every other token in a single step and decide for itself which ones matter. "Attention Is All You Need" (Vaswani et al., 2017) showed that this one operation, stacked into layers, is enough to build the whole model. Every large language model running today sits on top of it.

## The operation

Self-attention turns each token into three vectors: a query, a key, and a value. For every token it scores that token's query against every token's key with a dot product, then scales the scores down by the square root of the dimension so they don't explode. Each row gets softmaxed into weights that sum to one, and those weights mix the value vectors together:

```
Attention(Q, K, V) = softmax( Q Kᵀ / sqrt(d) ) V
```

The softmax row is the part worth staring at. For a given token it's a probability distribution over the whole sentence, answering one question: where does this token pay attention? That distribution is what the demo draws, both as a matrix and as a set of arcs.

## What I could get, and what I could not

Here's the honest part, and it's the part that matters most.

The demo runs a real model in your browser: MiniLM, a small distilled sentence encoder from the transformer family, loaded through the transformers.js library and executed with WebAssembly. Getting per-token output out of it takes exactly one line:

```javascript
const out = await embed(sentence, { pooling: 'none', normalize: false });
// out.dims === [1, T, 384]: one 384-dim contextual vector per token
```

What I can't get out of it is the model's own internal attention weights. It ships as an ONNX graph exported for inference, and that export emits only the final token embeddings, not the attention tensors buried inside each layer. I checked this directly rather than assume it: the output has exactly one field, `last_hidden_state`. That's it.

So I did the honest thing. Instead of faking internal heads or claiming something the export simply doesn't hand you, the demo computes the self-attention operation over the model's real contextual token vectors. I normalize each token vector and softmax the scaled dot products between them:

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

This is the exact attention mechanism, run over representations a real model actually produced. It is not a read-out of that model's internal heads. Same math, real vectors, and no pretending otherwise. For anyone technical, saying that plainly is worth more than a confident overclaim.

## Verify, do not vibe

Each attention row is supposed to be a genuine softmax distribution. That's a property, which means I can check it instead of taking it on faith. The demo hands its computed matrix to an automated test that asserts, for every row:

- The weights are non-negative.
- The weights sum to one, with measured deviation on the order of 1e-16, i.e. floating-point machine precision.
- The matrix is square, one row and column per token, and the tokens are bracketed by the model's `[CLS]` and `[SEP]` markers, matching the embedding rows exactly.

If any of those checks failed, the softmax or the token alignment would be broken, and the whole picture would mean nothing.

## What you actually see

Since the vectors are real contextual embeddings, the attention tracks the semantic structure the model encodes rather than random noise. Type a sentence with a pronoun and watch it lean toward the noun it refers to. It's oddly satisfying to see.

One wrinkle: a token is always most similar to itself, so the matrix comes out with a bright diagonal. To get around that, the arc view renormalizes over the other tokens and surfaces the cross-token structure, which is the part that's actually interesting. There's also a focus control that sharpens or softens how concentrated the attention is. That's the temperature term in the softmax, made tangible.

## Where this goes

The single-head, similarity-based view is the floor, not the ceiling. The real mechanism has plenty more to show:

- Multiple heads. A transformer layer runs many attention heads in parallel, and they specialize: some track syntax, some track coreference. Drawing several at once, in the spirit of tools like BertViz, is the obvious next step.
- Learned projections. Real queries and keys come from learned weight matrices, not raw embeddings, which is exactly why heads can attend on features that plain similarity misses. Load a model exported with its attention tensors intact and the demo could show the genuine internal weights.
- Depth. Attention composes across layers. Early layers attend locally, later layers globally, and watching that shift happen is one of the clearer windows into how a model builds up meaning.

## The pattern generalizes

The lesson underneath the demo is bigger than one visualization. A model isn't a black box you can only poke from the outside. Its intermediate representations are just real numbers, and you can pull them out, compute on them, and check them. Treat the internals as inspectable, then verify the properties you claim. That habit is the whole difference between using AI and actually understanding it, and it's what a client is really paying for when they hire someone to build with these systems.

**Try it live** (the model runs on your device, nothing is uploaded): [rs-03.github.io/demos](https://rs-03.github.io/demos/#attention)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Attention Lens component.

*This visualizes the self-attention operation over a real model's token embeddings; it is not a read-out of the model's internal attention heads.*
