# Show HN submission (ready to post)

Not a dev.to article. This is a Hacker News "Show HN" submission: a title, the
URL to submit, and a first comment to post yourself right after. Post during a
weekday morning US time for the best odds. Do not editorialize the title.

---

## Title

Show HN: In-browser AI/ML demos, from RAG to diffusion, each with a correctness test

## URL

https://rs-03.github.io/demos

## First comment (post this yourself, right after submitting)

I kept seeing portfolio demos that were really just screen recordings or calls to a hosted API, so I built the opposite: about fifteen AI/ML and computational-science demos that run entirely in your browser, with nothing uploaded and nothing faked. Open devtools and you can watch each one compute on your own machine.

The theme is "try, don't trust." Where a demo makes a scientific claim, it exposes a small hook and an automated test that checks it against known results. A few examples: the Hodgkin-Huxley neuron rests near -65 mV and only spikes past +20 mV when you push it over threshold, straight from the 1952 equations; the Wright-Fisher evolution demo fixes neutral alleles at a fraction matching their starting frequency (0.49 from a 0.5 start, across hundreds of runs); the sequence-alignment matrices match an independent dynamic-programming recompute cell for cell; the 2D diffusion demo denoises a noise cloud from a spread near 1.0 down to about 0.6 and lands the particles essentially on the target shape.

The range is deliberately wide: retrieval-augmented search over the site's own text with a MiniLM model running in WASM, transformer self-attention over real token embeddings, a byte-pair tokenizer trained live, denoising diffusion, protein folding by simulated annealing on the HP lattice, the Hodgkin-Huxley neuron, Wright-Fisher drift and selection, Needleman-Wunsch and Smith-Waterman alignment, Turing reaction-diffusion, plus a few computer-vision demos (hand keypoints, an object-detection camouflage test, and a from-scratch digit recognizer with hand-written backprop). Many are interactive now: click the neuron trace to inject current, paste your own sequences to align, fold your own H/P string, or click a population to follow its lineage.

Stack: Next.js exported as static files, so there is no server at all. Transformers.js, TensorFlow.js, and MediaPipe carry the heavy models; the rest is hand-written numerics. It respects prefers-reduced-motion and pauses offscreen. Source is linked from the site. I would especially value feedback on the science and the correctness checks, and on which demos are worth expanding.
