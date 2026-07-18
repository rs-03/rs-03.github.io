const project = {
    slug: 'diffusion',
    title: 'Diffusion: Watch Noise Become a Shape',
    shortDescription: 'The reverse process behind image generators, shrunk to two dimensions: a cloud of pure noise denoised step by step onto a target, live in the browser.',
    fullDescription: `An interactive, in-browser demonstration of denoising diffusion, the method behind Stable Diffusion, DALL-E, and Imagen. A cloud of Gaussian-noise particles is denoised one step at a time using the exact ancestral sampling rule of Ho, Jain and Abbeel (2020): at each noise level the demo estimates the clean data as a posterior mean over the target points, steps toward it, and adds back a precise amount of noise. Because the target is a known set of points, the noised distribution is a mixture of Gaussians and its score has a closed form, so no training is needed. That is the one honest simplification: real image models cannot write the score down and instead train a large U-Net to estimate it, while the schedule, the posterior step, and the added noise you are watching are identical. A live cloud-spread trace shows the sample converging rather than replaying a canned animation.`,
    category: 'personal',
    sector: 'creative',
    type: 'demo',
    status: 'live',
    featured: false,
    role: 'Independent build · the DDPM sampler, the closed-form score, and the visualization',
    techStack: ['JavaScript', 'Diffusion Models', 'DDPM', 'Canvas', 'React'],
    highlights: [
        'Exact DDPM ancestral sampling (Ho et al., 2020) run per particle in real time',
        'Closed-form denoising score for a known target mixture, no training required',
        'Honest framing: the same sampling math as real image diffusion, only in 2D',
        'Live cloud-spread readout is direct evidence the sample is converging',
    ],
    demoUrl: '/demos#diffusion',
};

export default project;
