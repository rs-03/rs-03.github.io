# Language Models Do Not Read Words. Watch One Learn What It Reads Instead.

*I built a demo that trains a byte-pair-encoding tokenizer live: starting from single letters, it merges the most frequent pair over and over until common chunks like "low" and "est" become single tokens. Then it splits whatever you type. Here is the algorithm, the code, and why every language model reads this way.*

## The gap between words and characters

When you hand a sentence to a language model, it does not see words and it does not see letters. It sees tokens: subword pieces that sit in between. Why not just use words? Because a word vocabulary can never be finished. New names, typos, code, hashtags, and other languages would all be unknown symbols. Why not just use single characters, which are always complete? Because then every sequence gets long and each symbol carries almost no meaning, which makes learning harder.

Subwords are the compromise, and the standard way to find them is byte-pair encoding. It was invented as a data-compression trick (Gage, "A New Algorithm for Data Compression," 1994) and repurposed for language by Sennrich, Haddow, and Birch ("Neural Machine Translation of Rare Words with Subword Units," 2016). Nearly every large language model in use today tokenizes with a descendant of it.

## The algorithm is almost too simple

Start by splitting every word into characters. Then repeat one move: count how often each adjacent pair of symbols occurs across the whole corpus, find the single most frequent pair, and merge it into a new symbol everywhere it appears. Each merge adds one entry to the vocabulary and makes the corpus a little shorter. That is the entire training loop:

```javascript
for (let k = 0; k < maxMerges; k++) {
    const pairs = new Map();
    for (const v of vocab)                       // every unique word, weighted
        for (let i = 0; i < v.symbols.length - 1; i++) {
            const key = v.symbols[i] + ' ' + v.symbols[i + 1];
            pairs.set(key, (pairs.get(key) || 0) + v.count);
        }
    // pick the most frequent pair (ties broken by count, then lexically,
    // so training is fully deterministic), merge it, and record the merge
}
```

Run it on a corpus full of "lower", "lowest", "slower", "slowest" and it quickly discovers "er", then "est", then "low", because those are the pieces that keep recurring. The demo animates every merge as it happens, drawing the words as colored chips that fuse together, so you can literally watch the tokenizer assemble its vocabulary from the bottom up. Applying it to new text is the same merges replayed in the order they were learned.

## Why this is the right compromise

The magic of subwords is graceful degradation. A word the tokenizer has seen a lot becomes a single token, which is efficient. A word it has never seen is not an error; it simply falls back to the largest pieces it does know, down to individual characters if it must. In the demo you can watch this directly: type a word from the training text and it collapses to one or two tokens, type a made-up word and it shatters into small fragments. Same tokenizer, no unknown-word failure, ever. That open-vocabulary property is exactly why models can handle names, code, and typos they were never explicitly trained on.

## Verify, do not vibe

A tokenizer has one non-negotiable property: it must be reversible. If you cannot glue a word's tokens back into the original word, the model's output could not be turned back into text unambiguously. So the demo exposes its tokenizer to an automated test that tokenizes every word in the corpus, plus some deliberately out-of-vocabulary ones, and asserts that concatenating the tokens reproduces the input exactly, character for character. It also checks that training is deterministic and that in-vocabulary words genuinely compress to fewer tokens than they have letters. Losslessness is not assumed here, it is checked.

## Honest scope

This is the real algorithm, shrunk so the mechanism is visible. Two honest simplifications: it works on letters, whereas production tokenizers like GPT's work on raw bytes, so they never choke on emoji or unusual characters; and it merges only within words and skips the word-boundary marker that real tokenizers add so that a piece at the end of a word is distinguished from the same piece in the middle. It also trains on a paragraph, not the billions of characters a real vocabulary is built from. The loop on screen is the genuine one; the scale and the alphabet are the toy parts.

## Beyond the basics

Tokenization is quietly one of the most consequential and underappreciated parts of a language model:

- Byte-level BPE. Working on bytes instead of characters guarantees any input is representable and is what most modern models actually use.
- Alternatives. Unigram language-model tokenization, as in SentencePiece, picks a vocabulary by a probabilistic criterion rather than greedy merging, and often segments a little differently.
- It leaks into behavior. Arithmetic, spelling, and rhyming are all harder for models partly because of how tokenization chops numbers and words, and rare "glitch tokens" that were seen almost never in training can make models misbehave. The tokenizer is not a neutral preprocessing step; it shapes what the model finds easy.

## The pattern generalizes

The lesson is that a startlingly simple, greedy, local rule, merge the most common pair and repeat, produces a globally useful structure: a compact vocabulary that balances efficiency against coverage. That greedy-merge motif shows up in compression, clustering, and Huffman coding, and it is a good tool to reach for whenever you need to build a vocabulary of reusable chunks from raw data. Simple rules, iterated, are a recurring way that useful structure gets built.

**Try it live** (nothing leaves your device): [rs-03.github.io/demos](https://rs-03.github.io/demos/#tokens)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Tokenizer component and its lossless-reconstruction test.

*A demonstration of the byte-pair-encoding algorithm at small scale, not a production tokenizer.*
