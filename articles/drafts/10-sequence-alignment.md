# Two Algorithms From the 1970s Still Run Every Genome Comparison. I Animated Them.

*I built a live demo of Needleman-Wunsch and Smith-Waterman, the dynamic programs that align DNA and protein sequences. You watch the scoring matrix fill in cell by cell, then the optimal path trace back. Here is the one recurrence behind both, and how I checked it is exact.*

## The question: are these two sequences related?

Give a biologist two strands of DNA or two proteins and the first question is whether they are related, and if so, how. The answer is an alignment: line the sequences up so their matching parts stack, and account for the differences as either substitutions (a letter changed) or gaps (a letter inserted or deleted). A good alignment maximizes a score that rewards matches and penalizes mismatches and gaps, and the score itself becomes a number you can rank and threshold to decide if two genes are homologous.

The catch is that the number of ways to line up two sequences with gaps is astronomically large. You cannot try them all. Yet the best alignment can be found exactly, and quickly, with one of the most elegant ideas in computer science.

## The recurrence: dynamic programming

Build a grid with one sequence down the side and the other across the top. Each cell holds the best score achievable for aligning the two prefixes that end there, and it is computed from just three neighbors by asking a single question: what is the last thing that happened at this cell?

```javascript
for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
        const s = a[i - 1] === b[j - 1] ? match : mismatch;
        let v = Math.max(
            H[i - 1][j - 1] + s,   // align the two letters (diagonal)
            H[i - 1][j] + gap,     // a gap in one sequence (from above)
            H[i][j - 1] + gap,     // a gap in the other (from the left)
        );
        if (local) v = Math.max(0, v); // the one extra rule, explained below
        H[i][j] = v;
    }
}
```

That is the whole engine. Because each cell only ever needs the three already-computed cells above and to its left, filling the grid once, in order, is guaranteed to find the globally optimal alignment. It runs in time proportional to the product of the two lengths, and the demo animates the fill so you can watch the wavefront of best scores sweep across the grid. When it finishes, following the choices backward from the corner reconstructs the alignment, which the demo draws as a glowing traceback.

## One max() turns global into local

There are two classic versions and the demo does both. Needleman and Wunsch (1970) align the sequences end to end: the path must run from one corner of the grid to the other. Smith and Waterman (1981) added a single rule, never let a cell score drop below zero, and start the traceback from the highest-scoring cell instead of the corner. That one change finds the best matching sub-region rather than forcing a full-length alignment, which is what you want when a short conserved domain sits inside two otherwise different proteins. In the code above it is the lone `Math.max(0, v)`. Toggle the mode in the demo and watch where the path starts.

## Verify, do not vibe

Dynamic programming is easy to write and easy to get subtly wrong: an off-by-one in the initialization, a bad tie-break in the traceback, a mismatch between the score and the path. So the alignment engine is a pure function, and an automated test recomputes the entire scoring matrix with a second, independent implementation and asserts they agree in every single cell. It also confirms that the alignment the demo reports actually achieves the optimal score, by walking the aligned strings and re-summing the match, mismatch, and gap costs. That check runs across three sequence pairs (DNA and protein), both alignment modes, and two different scoring schemes, twelve cases in all, and all twelve match. The matrix on screen is exact, not approximate.

## Why it matters

Alignment is not an academic exercise. It is how we tell whether a newly sequenced gene resembles a known one, how we spot the mutation that distinguishes a variant, and how sequencing reads are placed onto a reference genome. The scoring scheme is a modeling decision, not a detail: change the match reward or the gap penalty and the optimal alignment shifts, because you have changed your assumption about what kind of evolutionary change is cheap. The demo exposes those costs as sliders precisely so you can feel that.

## Beyond the toy

Real tools extend this exact engine in ways worth knowing:

- Substitution matrices. Protein alignment does not use a flat match versus mismatch score. It uses matrices like BLOSUM and PAM that encode how often each amino acid actually substitutes for each other one across evolution, so a conservative swap costs less than a disruptive one.
- Affine gaps. One long insertion is more likely than many separate ones, so real scoring charges a large penalty to open a gap and a small one to extend it. Gotoh (1982) showed how to keep the same big-O time while tracking gap state, and it is the standard everywhere.
- Scale. The quadratic grid is fine for two short sequences but not for aligning against a whole genome, which is why production tools use heuristics like seed-and-extend and why Hirschberg's method recovers the alignment in linear space. The exact grid you see here is still the ground truth those approximations are measured against.

## The pattern generalizes

The lesson under the demo is the shape of dynamic programming itself: when a big problem's optimal solution is built from optimal solutions to smaller overlapping subproblems, you can fill a table once and read off the answer, turning an exponential search into a polynomial fill. That pattern shows up in spell checkers, diff tools, speech recognition, and reinforcement learning. Learn to see it and a surprising number of hard-looking problems become a grid you fill in order.

**Try it live** (nothing leaves your device): [rs-03.github.io/demos](https://rs-03.github.io/demos/#alignment)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Sequence Alignment component and its reference-matched test.

*A demonstration of the exact alignment algorithms, not a production sequence-search tool.*
