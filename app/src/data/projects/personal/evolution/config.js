const project = {
    slug: 'evolution',
    title: 'Evolution in a Bottle: The Wright-Fisher Model, Live',
    shortDescription: 'Dozens of populations evolving in parallel under drift, selection, and mutation, so you can watch chance and fitness compete.',
    fullDescription: `An interactive Wright-Fisher simulation of population genetics. Each generation, a population of N diploid individuals is rebuilt by binomial sampling from the current allele frequency, with a selection coefficient biasing the draw and a mutation rate feeding variation back in. Running many replicate populations at once makes genetic drift visible: with no selection, chance alone sends some populations to fixation and others to loss, and the fraction that fix equals the starting frequency. Built to make drift, fixation probability, and the loss of variation in small populations tangible.`,
    category: 'personal',
    sector: 'life-sciences',
    type: 'demo',
    status: 'live',
    featured: false,
    role: 'Independent build · the stochastic simulation, the seeded generator, and the visualization',
    techStack: ['JavaScript', 'Stochastic Simulation', 'Population Genetics', 'Canvas', 'React'],
    highlights: [
        'Correct Wright-Fisher binomial sampling with selection and mutation',
        'Many replicate populations plotted as live allele-frequency trajectories',
        'Neutral fixation fraction matches the starting frequency, as theory predicts',
        'Grounded in the literature (Fisher 1930, Wright 1931, Kimura)',
    ],
    demoUrl: '/demos#evolution',
};

export default project;
