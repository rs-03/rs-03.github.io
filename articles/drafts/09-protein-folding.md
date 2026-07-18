# A Protein Is a String That Ties Itself Into a Machine. I Made One Fold in the Browser.

*I built a live protein-folding demo using the HP lattice model: a chain of water-fearing and water-loving beads that searches for the fold burying the most hydrophobic contacts, driven by Monte Carlo and simulated annealing. Here is the model, the search, and how I proved it is correct.*

## One sequence, one shape

A protein is a chain of amino acids that folds into one precise three-dimensional shape, and that shape is the whole point. It catalyzes a reaction, carries oxygen, forms a muscle fiber. Christian Anfinsen won a Nobel Prize for showing that the sequence alone determines the fold, and that the fold sits at the minimum of the molecule's free energy (Anfinsen, "Principles that Govern the Folding of Protein Chains," Science, 1973). Denature a protein and it refolds to the same structure, unprompted. Nobody tells it how.

So folding is really an optimization problem: given the sequence, find the lowest-energy shape. The catch is that it's one of the hardest optimization problems there is.

## The HP model: keep only the dominant force

Ken Dill's move was to strip the problem down to its single most important ingredient (K. Dill, "Theory for the Folding and Stability of Globular Proteins," Biochemistry, 1985). Water is the driver. Hydrophobic residues want to hide from it, polar residues don't much care, and that push to bury the hydrophobic parts in a core is most of what shapes a protein.

So the HP model labels every residue either H (hydrophobic) or P (polar), lays the chain on a square lattice as a self-avoiding walk, and defines the energy with a single rule: every pair of H residues that end up next to each other on the lattice, without being neighbors in the chain, lowers the energy by one. Maximize those buried H-H contacts and you've found the fold. It sounds almost too crude to work, but it reproduces the real behavior: a compact hydrophobic core, a polar surface, cooperative folding.

## The search: Monte Carlo plus annealing

Finding the best fold means searching the space of self-avoiding walks, and the demo does it with Metropolis Monte Carlo. Each step proposes a small change. It's accepted always if it lowers the energy, or with probability e to the minus delta-E over T if it raises it, so the chain can climb out of shallow traps. The move set is what makes or breaks it:

```
end move        rotate a terminal residue to a free neighbor
corner flip     flip a residue across the diagonal of an L bend
crankshaft      flip a U-shaped 4-residue segment to the other side
pivot           rotate the entire tail 90 or 180 degrees about a residue
```

The first three are gentle local moves. The pivot is the powerful global one that lets the chain make large rearrangements in a single step. Wrapped around all of it is simulated annealing: the temperature starts hot so the chain explores freely, then cools so it settles into a deep minimum, with gentle reheating cycles to keep escaping local traps. My first version used only local moves and folded weakly. Adding pivots and reheating is what let it reach genuinely compact structures.

## A parity surprise

Building this taught me something I hadn't appreciated. The square lattice is bipartite, like a checkerboard, and because every step along the chain flips color, a residue's color is fixed by whether its position in the sequence is even or odd. Two residues can only touch if they sit on opposite colors, so their positions have to differ by an odd number. Follow that through and a strictly alternating H, P, H, P sequence, with every H on an even position, can form exactly zero H-H contacts no matter how it folds. The alphabet sets the ceiling, not just the search. I like that: the structure of a space quietly constrains what any algorithm can do inside it.

## Verify, don't vibe

A folding simulator is easy to get subtly wrong. An invalid move can quietly break the chain or let two residues overlap, and the energy can drift out of sync with the actual structure. So the demo exposes its state to an automated test that checks, on every sampled step, that the conformation is still a legal self-avoiding walk (all positions distinct, every consecutive pair adjacent) and that the reported energy equals a contact count recomputed independently from the coordinates. On the standard 20-residue benchmark the search reaches an energy of minus nine, the known optimum; on a 36-residue sequence it reaches minus eleven. The number on screen is what the search actually found, not what I hoped it found.

## Why folding is genuinely hard

Two facts make this more than a toy.

- Levinthal's paradox. A real chain has astronomically many possible shapes, far more than could be tried in the age of the universe, yet proteins fold in microseconds. How? The resolution is that folding isn't a search among equals; the energy landscape is a funnel, and each favorable contact steers the chain downhill. That funnel is exactly what the annealing here exploits.
- NP-hardness. Even this stripped-down model is provably hard: finding the optimal fold in the HP model is NP-hard, shown for both the two- and three-dimensional lattice (Crescenzi et al., 1998; Berger and Leighton, 1998). So no demo can promise the true global minimum. That's why this one reports the best energy found and shows the search working, rather than claiming to have solved it.

## The pattern generalizes

The shape of this problem, a huge combinatorial space with an energy to minimize and a physically motivated move set, shows up all over: circuit layout, scheduling, structure prediction with real force fields, even the way modern protein-design tools search sequence space. The habit worth stealing from it is the one in the middle section. When you build a heuristic search, make the state checkable and check it, so that when you report a number you can actually defend it.

**Try it live** (nothing leaves your device): [rs-03.github.io/demos](https://rs-03.github.io/demos/#folding)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Protein Folding component and its self-avoiding-walk test.

*A demonstration of the HP lattice model and the search behind it, not a production structure predictor.*
