# Unpublished drafts

These are long-form build and science notes drafted but NOT yet published.

They live in this subfolder on purpose: `scripts/publish_articles.mjs` reads
`articles/*.md` non-recursively, so nothing in `articles/drafts/` is ever picked
up by the publisher. To publish one, review it, move it up to `articles/` with
the next number, add its entry to the `TAGS` map in `publish_articles.mjs`, then
run the publish flow.

- `07-morphogenesis.md` - Turing reaction-diffusion / Gray-Scott on the GPU
  (pairs with the /demos#morphogenesis demo).
- `08-attention.md` - self-attention computed over a real model's token
  embeddings in the browser (pairs with the /demos#attention demo).
- `09-protein-folding.md` - the HP lattice model folded by Monte Carlo and
  simulated annealing (pairs with the /demos#folding demo).
- `10-sequence-alignment.md` - Needleman-Wunsch and Smith-Waterman dynamic
  programming, animated (pairs with the /demos#alignment demo).
- `11-hodgkin-huxley.md` - the four-variable Hodgkin-Huxley neuron model
  integrated live (pairs with the /demos#neuron demo).
- `12-evolution.md` - the Wright-Fisher model of drift, selection, and mutation
  across many populations (pairs with the /demos#evolution demo).
- `13-tokenizer.md` - byte-pair encoding trained live, the subword tokenization
  language models use (pairs with the /demos#tokens demo).
