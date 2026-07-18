# Survival of the Luckiest: Watching Genetic Drift Decide Evolution in the Browser

*I built a live Wright-Fisher simulation that runs dozens of identical populations in parallel. With selection turned off, pure chance still sends some to fixation and others to loss, and the fraction that fix equals the starting frequency exactly. Here is the model, the code, and how I checked it against theory.*

## Evolution is not only survival of the fittest

"Survival of the fittest" makes evolution sound like an optimizer that always finds the better gene. In an infinite population, sure, that would be true. Real populations aren't infinite, though, and the moment they're finite, chance gets the final say a lot more often than intuition wants to admit. Think about what actually happens each generation: which parents leave offspring, which gene copies get passed on. That's a coin-flip sampling process. Stack enough of those flips together and the sampling noise stops being noise. It turns into a real evolutionary force, genetic drift, and drift will happily fix a useless gene or wipe out a helpful one on luck alone.

This isn't a footnote to selection. It's one of the pillars of modern population genetics, worked out by R. A. Fisher ("The Genetical Theory of Natural Selection," 1930) and Sewall Wright ("Evolution in Mendelian Populations," Genetics, 1931), and later pushed much further by Motoo Kimura, whose neutral theory argued that most molecular evolution is drift, not selection, at all.

## The Wright-Fisher model

The standard idealization is almost embarrassingly simple, which is part of why I like it. A population has N diploid individuals, so 2N copies of the gene floating around. To build the next generation you draw 2N new copies at random from the current pool. That one move is the whole trick: it makes the next generation's allele frequency a binomial random variable centered on the current one. Selection tilts the sampling odds toward the fitter allele, mutation flips a small fraction of copies, and that's really it. Here is one generation in full:

```javascript
function oneGen(p, N, s, mu, rng) {
    const twoN = 2 * N;
    let p1 = (p * (1 + s)) / (1 + p * s);    // selection: favored allele has fitness 1 + s
    let p2 = p1 * (1 - mu) + (1 - p1) * mu;  // mutation flips a fraction each way
    return binom(twoN, p2, rng) / twoN;      // the next generation is a binomial draw
}
```

The demo runs dozens of these populations side by side from the same starting frequency. It uses a seeded generator, so a given setting always plays out the same way (handy when you want to point at one specific run and explain it). Each population's allele frequency gets drawn as its own trajectory. What you end up staring at is a spreading tangle of lines colored by fate: the ones climbing to fixation, the ones crashing to loss, and the ones still undecided, with the average across populations drawn in white.

## Drift is a force, not noise

Turn selection off and something genuinely striking happens. The average frequency across all the populations barely budges. And yet every single population wanders on its own until it slams into 0 or 1 and stays there forever. Chance, and nothing else, is sorting one uniform starting condition into winners and losers.

What gets me is that it does this by a precise law, not a fuzzy tendency. The probability that a neutral allele eventually takes over a population is exactly its starting frequency. Start at fifty percent and about half the populations fix it. Start at twenty percent and about a fifth do. You can watch that number fall straight out of the simulation. There's a companion law for variation, too: heterozygosity, the chance that two random gene copies differ, decays at a rate of roughly one over twice the population size per generation. That's why the demo's heterozygosity readout keeps collapsing toward zero as populations fix. Smaller populations bleed out their variation faster, and that's the central worry of conservation genetics.

## Verify, do not vibe

A stochastic simulation is only worth trusting if it actually reproduces the theorems it's supposed to. So the model exposes a deterministic batch runner, and an automated test checks it against known results. Run hundreds of neutral populations and the fraction that fix comes out at 0.492 when the starting frequency is 0.5, and 0.207 when it's 0.2, both landing on the "fixation probability equals starting frequency" law to within sampling error. Crank selection strongly positive and essentially every population fixes the allele; crank it strongly negative and essentially all of them lose it. Every frequency stays a valid probability between zero and one, and nothing diverges. The dice are honest, and, more to the point, checkably so.

## Selection versus drift

This is where the demo earns its keep, because it makes the real tension visible. A beneficial allele is not guaranteed to win. Ever. Its fixation probability rises with the selection coefficient, but it stays well below certainty when selection is weak or the population is small, since drift can snuff out a good gene before selection ever amplifies it. That balance, captured by the product of population size and selection strength, is one of the deepest results in the field and the reason effective population size matters as much as it does. Nudge the selection slider up from zero and watch the cloud of trajectories bend from a random spread into a confident sweep.

## Where this goes

The single-locus model is the foundation. The interesting bit is that its living extensions basically are the field:

- Linked genes. No gene evolves alone. A sweeping beneficial allele drags its neighbors along, a phenomenon called genetic hitchhiking that leaves fingerprints all over real genomes.
- Structure. Real populations aren't well-mixed, and once you allow migration between subpopulations everything changes. That's Wright's own island model and its descendants.
- The coalescent. Run the process backward in time, asking where the shared ancestors of today's copies came from, and you get the coalescent, the workhorse of modern population genomics for inferring history from DNA.

## The pattern generalizes

If there's a lesson that reaches past biology, it's humility about small numbers. Any time outcomes get resampled each round from a finite pool, chance isn't a small correction to the deterministic story. It's part of the story, and when the pool is small it can dominate. That's true of allele frequencies. It's also true of startups, of cultural fads, of any process where success feeds on itself in a finite arena. Fitness matters. Luck matters too. A finite world runs on both.

**Try it live** (nothing leaves your device): [rs-03.github.io/demos](https://rs-03.github.io/demos/#evolution)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Evolution component and its population-genetics test.

*A demonstration of the Wright-Fisher model of population genetics, not a model of any specific species.*
