const project = {
    slug: 'hodgkin-huxley',
    title: 'Hodgkin-Huxley: A Neuron Firing, From the Equations',
    shortDescription: 'The 1952 four-variable model of a nerve membrane, integrated live so you can inject current and watch an action potential fire.',
    fullDescription: `An interactive solver for the Hodgkin-Huxley model, the four coupled differential equations that describe how a nerve membrane generates an action potential. A membrane voltage and three ion-channel gating variables are integrated live; inject current with a slider and, once you cross threshold, the sodium channels avalanche open, the voltage overshoots, and potassium repolarizes the cell. The voltage trace and gating variables are plotted like an oscilloscope. Built to make the biophysics of the spike, threshold, and refractory period tangible.`,
    category: 'personal',
    sector: 'life-sciences',
    type: 'demo',
    status: 'live',
    featured: false,
    role: 'Independent build · ODE integrator, the 1952 rate functions, and the oscilloscope visualization',
    techStack: ['JavaScript', 'Numerical ODEs', 'Canvas', 'React'],
    highlights: [
        'The full four-variable Hodgkin-Huxley system integrated in the browser',
        'Inject current and watch threshold, spiking, and refractory dynamics emerge',
        'Live voltage trace plus sodium and potassium gating variables',
        'Grounded in the original literature (Hodgkin & Huxley, J. Physiol. 1952)',
    ],
    demoUrl: '/demos#neuron',
};

export default project;
