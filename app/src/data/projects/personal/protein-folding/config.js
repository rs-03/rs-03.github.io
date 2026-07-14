const project = {
    slug: 'protein-folding',
    title: 'Protein Folding: The HP Lattice Model, Live',
    shortDescription: 'A chain of hydrophobic and polar residues folds itself on a lattice by simulated annealing, watched in real time.',
    fullDescription: `An interactive implementation of Ken Dill's HP lattice model of protein folding. Each residue is either hydrophobic or polar, the chain lives on a 2D square lattice as a self-avoiding walk, and the only energy is a bonus for burying hydrophobic residues next to each other. A Metropolis Monte Carlo search over the standard lattice move set (end moves, corner flips, crankshafts), wrapped in simulated annealing, hunts for the lowest-energy fold while the hydrophobic core forms on screen. Built to understand hydrophobic collapse, energy landscapes, Levinthal's paradox, and why folding is NP-hard.`,
    category: 'personal',
    sector: 'life-sciences',
    type: 'demo',
    status: 'live',
    featured: false,
    role: 'Independent build · lattice Monte Carlo engine, annealing schedule, and visualization',
    techStack: ['JavaScript', 'Monte Carlo', 'Simulated Annealing', 'Canvas', 'React'],
    highlights: [
        'Correct HP energy and self-avoiding-walk move set (end, corner, crankshaft)',
        'Metropolis acceptance with a simulated-annealing temperature schedule',
        'Live hydrophobic-core visualization and an energy-over-time trace',
        'Grounded in the literature (Dill 1985, Anfinsen 1973, Levinthal 1969)',
    ],
    demoUrl: '/demos#folding',
};

export default project;
