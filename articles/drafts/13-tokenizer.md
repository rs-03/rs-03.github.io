# Language Models Do Not Read Words. Watch One Learn What It Reads Instead.

*I built a demo that trains a byte-pair-encoding tokenizer live: starting from single letters, it merges the most frequent pair over and over until common chunks like "low" and "est" become single tokens. Then it splits whatever you type. Here is the algorithm, the code, and why every language model reads this way.*

## The gap between words and characters

Hand a sentence to a language model and it sees neither the words nor the letters you typed. It sees tokens, which are subword pieces sitting somewhere in between.

So why not just feed it whole words? Because a word list is never finished. Names, typos, code, hashtags, a stray sentence of French: all of it would arrive as unknown symbols. Fine, then why not go the other way and use single characters, which are always complete? Because now every sequence balloons in length and each symbol means almost nothing on its own, and that makes the model's job harder.

Subwords are the compromise, and the usual way to find them is byte-pair encoding. It started life as a compression trick (Gage, "A New Algorithm for Data Compression," 1994) and got repurposed for language by Sennrich, Haddow, and Birch ("Neural Machine Translation of Rare Words with Subword Units," 2016). Nearly every large language model running today tokenizes with some descendant of it.

## The algorithm is almost too simple

Split every word into its characters. Then repeat a single move: count how often each adjacent pair of symbols occurs across the whole corpus, grab the most frequent pair, and merge it into one new symbol everywhere it appears. Every merge adds one entry to the vocabulary and shrinks the corpus a little. That's the entire training loop, and I do mean the entire thing:

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

Point it at a corpus stuffed with "lower", "lowest", "slower", "slowest" and it finds "er" fast, then "est", then "low", because those are the fragments that keep recurring. That little tie-break in the comment, count first and alphabetical order second, is doing quiet but load-bearing work: it's the only reason two runs on the same text come out identical. The demo animates each merge as it lands, drawing every word as colored chips that fuse together, so you can watch the vocabulary get built from the bottom up. Applying the finished tokenizer to new text is just those same merges replayed in the order they were learned.

## Why this is the right compromise

What makes subwords work is graceful degradation. A word the tokenizer has seen a lot collapses into a single token, which is cheap and efficient. A word it has never seen isn't an error at all; it just falls back to the largest known pieces, all the way down to individual characters if it has to. You can poke at this directly in the demo: type a word from the training text and it snaps down to one or two tokens, type some made-up word and it shatters into small fragments. Same tokenizer either way, and it never once throws up its hands at an unknown word. That open-vocabulary property is exactly why a model can cope with names, code, and typos nobody trained it on.

## Verify, do not vibe

A tokenizer has one property it cannot get wrong: it has to be reversible. If you can't glue a word's tokens back into the word you started with, there's no unambiguous way to turn the model's output back into text. So I wired the tokenizer up to an automated test that tokenizes every word in the corpus, throws in a few deliberately out-of-vocabulary ones, and asserts that concatenating the tokens reproduces the input exactly, character for character. It also checks that training is deterministic and that in-vocabulary words genuinely compress to fewer tokens than they have letters. Losslessness is the kind of thing that's easy to assume and embarrassing to get wrong, so I check it rather than trust it.

## Honest scope

This is the real algorithm, just shrunk until you can actually see it work. Two honest simplifications. It operates on letters, whereas production tokenizers like GPT's work on raw bytes, which is why they never choke on emoji or some oddball character. And it merges only within words; it skips the word-boundary marker that real tokenizers add so a piece at the end of a word is told apart from the same piece in the middle. It also trains on a single paragraph, not the billions of characters a real vocabulary is built from. The loop on screen is the genuine one. The scale and the alphabet are the toy parts.

## Beyond the basics

Tokenization is quietly one of the most consequential and least appreciated parts of a language model. A few threads worth pulling:

- Byte-level BPE. Merge bytes instead of characters and any input at all is guaranteed representable. This is what most modern models actually use.
- Other approaches. Unigram language-model tokenization, the kind SentencePiece uses, picks a vocabulary by a probabilistic criterion rather than greedy merging, and often segments text a little differently.
- It leaks into behavior. Arithmetic, spelling, and rhyming are all harder for models partly because of the way tokenization chops up numbers and words. And rare "glitch tokens," ones that showed up almost never in training, can make models misbehave. The tokenizer isn't a neutral preprocessing step; it shapes what the model finds easy.

## The pattern generalizes

Here's the part that sticks with me. A startlingly dumb, greedy, local rule, merge the most common pair and repeat, ends up producing a globally useful structure: a compact vocabulary that balances efficiency against coverage. That same greedy-merge motif turns up in compression, clustering, and Huffman coding, and it's a good tool to reach for whenever you need to build a vocabulary of reusable chunks out of raw data. Simple rules, run in a loop, are one of the more reliable ways useful structure gets built.

**Try it live** (nothing leaves your device): [rs-03.github.io/demos](https://rs-03.github.io/demos/#tokens)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Tokenizer component and its lossless-reconstruction test.

*A demonstration of the byte-pair-encoding algorithm at small scale, not a production tokenizer.*
