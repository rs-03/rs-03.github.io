const project = {
    slug: 'sequence-alignment',
    title: 'Sequence Alignment: Dynamic Programming, Animated',
    shortDescription: 'The Needleman-Wunsch and Smith-Waterman algorithms filling their scoring matrix and tracing back the optimal alignment, live.',
    fullDescription: `An interactive visualization of the two foundational algorithms of bioinformatics. Needleman-Wunsch aligns two sequences end to end, Smith-Waterman finds the best matching sub-region, and both are exact dynamic programs that fill a scoring matrix where every cell is the best score reachable there. The demo animates the matrix computing cell by cell as a color heatmap, then traces back the optimal path, and shows the aligned sequences with the score. Match, mismatch, and gap costs are adjustable so you can see how the scoring scheme changes the answer. Built to make the recurrence behind homology search tangible.`,
    category: 'personal',
    sector: 'life-sciences',
    type: 'demo',
    status: 'live',
    featured: false,
    role: 'Independent build · exact DP implementation, traceback, and the animated visualization',
    techStack: ['JavaScript', 'Dynamic Programming', 'Canvas', 'React'],
    highlights: [
        'Exact Needleman-Wunsch (global) and Smith-Waterman (local) alignment',
        'Animated matrix fill and glowing optimal-path traceback',
        'Adjustable match, mismatch, and gap scoring with live re-derivation',
        'Grounded in the literature (Needleman & Wunsch 1970, Smith & Waterman 1981)',
    ],
    demoUrl: '/demos#alignment',
};

export default project;
