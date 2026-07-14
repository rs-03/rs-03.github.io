const project = {
    slug: 'morphogenesis',
    title: 'Morphogenesis: Turing Patterns in the Browser',
    shortDescription: 'A live reaction-diffusion engine that grows the same patterns found on animal skin, coral, and fingerprints.',
    fullDescription: `A GPU-accelerated implementation of Alan Turing's reaction-diffusion theory of biological pattern formation. Two virtual morphogens, an activator and an inhibitor, diffuse and react across a grid using the Gray-Scott model, and a nearly uniform starting field breaks symmetry into spots, stripes, and labyrinths on its own. The visitor can paint fresh activator into the field and walk the feed and kill parameter map that Pearson catalogued in 1993. Built to understand how the mathematics behind zebrafish stripes, limb digit spacing, and fingerprint ridges actually works.`,
    category: 'personal',
    sector: 'life-sciences',
    type: 'demo',
    status: 'live',
    featured: false,
    role: 'Independent build · reaction-diffusion solver, WebGL2 shaders, and the interaction design',
    techStack: ['WebGL2', 'GLSL', 'Reaction-Diffusion', 'React'],
    highlights: [
        'Gray-Scott PDE solved in a fragment shader with ping-pong float textures',
        'Interactive: paint activator and steer the feed/kill parameter map live',
        'Grounded in the literature (Turing 1952, Pearson 1993, Kondo 2010, Glover 2023)',
        'Runs entirely on-device, no data leaves the browser',
    ],
    demoUrl: '/demos#morphogenesis',
};

export default project;
