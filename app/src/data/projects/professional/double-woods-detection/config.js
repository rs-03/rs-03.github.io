const project = {
    slug: 'double-woods-detection',
    title: 'Double Woods Detection System',
    shortDescription: 'Computer vision system achieving >95% accuracy for utility infrastructure analysis.',
    fullDescription: `Deployed CV system for a Fortune 500 utility to detect double wood poles in infrastructure imagery, enabling proactive maintenance planning.`,
    role: 'Computer Vision Engineer · owned model development, evaluation, and production deployment',
    category: 'professional',
    sector: 'utility',
    type: 'case-study',
    status: 'completed',
    featured: true,
    clientType: 'Fortune 500 Utility',
    techStack: ['PyTorch', 'Computer Vision', 'Custom Rule Logic'],
    impactMetric: '>95% Detection Accuracy',
    problem: `Double wood poles (old poles left standing next to their replacements) are a maintenance liability and a compliance issue. Finding them across a Fortune 500 utility's network meant field crews manually reviewing enormous volumes of pole imagery.`,
    approach: [
        'Trained a PyTorch detection model on utility pole imagery to identify double-wood configurations',
        'Layered a custom rule engine on top of model output to resolve edge cases (occlusion, angles, adjacent structures) that pure detection misses',
        'Tuned the precision/recall trade-off with the client so flagged poles could go straight into maintenance planning without re-review',
        'Integrated results into the client\'s existing maintenance workflow',
    ],
    outcomes: [
        { value: '>95%', label: 'detection accuracy in production' },
        { value: 'Fortune 500', label: 'utility deployment' },
        { value: 'Automated', label: 'screening of imagery that previously required manual field review' },
    ],
    pipeline: ['Pole imagery', 'CV detection', 'Rule engine', 'Maintenance flags'],
    highlights: [
        '>95% detection accuracy',
        'Real-time image processing',
        'Integration with maintenance systems',
        'Custom rule engine for edge cases',
    ],
};

export default project;
