# Survival of the Luckiest: Watching Genetic Drift Decide Evolution in the Browser

*I built a live Wright-Fisher simulation that runs dozens of identical populations in parallel. With selection turned off, pure chance still sends some to fixation and others to loss, and the fraction that fix equals the starting frequency exactly. Here is the model, the code, and how I checked it against theory.*

## Evolution is not only survival of the fittest

The phrase "survival of the fittest" makes evolution sound like an optimizer that always finds the better gene. In an infinite population that would be true. But real populations are finite, and in a finite population chance has the final say more often than intuition allows. Which parents happen to leave offspring, which gene copies happen to get passed on, is a coin-flip sampling process, and over generations that sampling noise accumulates into a real evolutionary force called genetic drift. Drift can fix a useless gene and eliminate a helpful one, purely by luck.

This is not a footnote to selection. It is one of the pillars of modern population genetics, worked out by R. A. Fisher ("The Genetical Theory of Natural Selection," 1930) and Sewall Wright ("Evolution in Mendelian Populations," Genetics, 1931), and pushed further by Motoo Kimura, whose neutral theory argued that most molecular evolution is drift, not selection, at all.

## The Wright-Fisher model

The standard idealization is beautifully simple. A population has N diploid individuals, so 2N copies of the gene. Each generation is built by drawing 2N new copies at random from the current pool, which means the next generation's allele frequency is a binomial random variable centered on the current one. Selection tilts the sampling odds toward the fitter allele, and mutation flips a small fraction of copies. One generation, in full:

```javascript
function oneGen(p, N, s, mu, rng) {
    const twoN = 2 * N;
    let p1 = (p * (1 + s)) / (1 + p * s);    // selection: favored allele has fitness 1 + s
    let p2 = p1 * (1 - mu) + (1 - p1) * mu;  // mutation flips a fraction each way
    return binom(twoN, p2, rng) / twoN;      // the next generation is a binomial draw
}
```

The demo runs dozens of these populations side by side from the same starting frequency, using a seeded generator so a given setting always plays out the same way, and draws each population's allele frequency as a trajectory. The result is a spreading tangle of lines, colored by fate: the ones that climb to fixation, the ones that crash to loss, and the ones still undecided, with the average across populations drawn in white.

## Drift is a force, not noise

Turn selection off and something striking happens. The average frequency across all the populations barely moves, yet every individual population wanders until it slams into 0 or 1 and sticks there forever. Chance alone is sorting a uniform starting condition into winners and losers.

And it does so with a precise law. The probability that a neutral allele eventually takes over a population is exactly its starting frequency. Start at fifty percent and about half the populations fix it; start at twenty percent and about a fifth do. You can watch that number fall out of the simulation. A related law governs variation: heterozygosity, the chance that two random gene copies differ, decays at a rate of roughly one over twice the population size per generation, which is why the demo shows a heterozygosity readout collapsing toward zero as populations fix. Smaller populations lose their genetic variation faster, which is the central worry of conservation genetics.

## Verify, do not vibe

A stochastic simulation is only trustworthy if it reproduces the theorems it is supposed to, so the model exposes a deterministic batch runner and an automated test compares it to known results. Running hundreds of neutral populations, the fraction that fix comes out at 0.492 when the starting frequency is 0.5, and 0.207 when it is 0.2, matching the "fixation probability equals starting frequency" law to within sampling error. Turn selection strongly positive and essentially all populations fix the allele; turn it strongly negative and essentially all lose it. Every frequency stays a valid probability between zero and one, and nothing diverges. The dice are honest, and checkably so.

## Selection versus drift

The demo makes the real tension visible. A beneficial allele is not guaranteed to win. Its fixation probability rises with the selection coefficient but stays well below certainty when selection is weak or the population is small, because drift can snuff out a good gene before selection amplifies it. This balance, captured by the product of population size and selection strength, is one of the deepest results in the field and the reason effective population size matters so much in evolution. Nudge the selection slider up from zero and watch the cloud of trajectories bend from a random spread into a confident sweep.

## Where this goes

The single-locus model is the foundation. The living extensions are the field:

- Linked genes. Genes do not evolve alone; a sweeping beneficial allele drags its neighbors along, a phenomenon called genetic hitchhiking that shapes real genomes.
- Structure. Populations are not well-mixed; migration between subpopulations changes everything, which is Wright's own island model and its descendants.
- The coalescent. Running the process backward in time, asking where the shared ancestors of today's copies are, gives the coalescent, the workhorse of modern population genomics for inferring history from DNA.

## The pattern generalizes

The lesson beyond biology is humility about small numbers. In any system where outcomes are resampled each round from a finite pool, chance is not a small correction to the deterministic story, it is part of the story, and it can dominate when the pool is small. That is true of allele frequencies, and it is true of startups, of cultural fads, and of any process where success feeds on itself in a finite arena. Fitness matters, but so does luck, and a finite world runs on both.

**Try it live** (nothing leaves your device): [rs-03.github.io/demos](https://rs-03.github.io/demos/#evolution)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Evolution component and its population-genetics test.

*A demonstration of the Wright-Fisher model of population genetics, not a model of any specific species.*
