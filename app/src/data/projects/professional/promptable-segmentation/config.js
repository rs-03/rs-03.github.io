const project = {
    slug: 'promptable-segmentation',
    title: 'Promptable Segmentation for Infrastructure',
    shortDescription: 'VLM + SAM2.1 deployed on utility infrastructure imagery: describe the object, get the mask.',
    fullDescription: `Production segmentation tooling for utility infrastructure imagery: analysts describe what they need ("the transformer", "the lowest communication wire") and a Vision-Language Model grounds the prompt for SAM2.1 to segment, with interactive refinement when the first mask isn't right. Built to accelerate annotation and analysis workflows on complex pole and wire scenes.`,
    role: 'CV/ML Engineer · designed and built the tooling end to end',
    category: 'professional',
    sector: 'utility',
    type: 'card',
    status: 'completed',
    featured: false,
    techStack: ['VLM', 'SAM2.1', 'Python', 'React'],
    highlights: [
        'Language-grounded segmentation of poles, wires, and equipment',
        'Interactive mask refinement for hard cases',
        'Annotation acceleration for infrastructure analysis workflows',
        'Integrated into existing utility pipelines',
    ],
};

export default project;
