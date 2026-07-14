const project = {
    slug: 'keypoint-detection-llm',
    title: 'Infrastructure Keypoint Detection',
    shortDescription: 'Fine-tuned transformer for precise keypoint extraction in utility infrastructure.',
    fullDescription: `Fine-tuned a transformer model on custom annotations for precise keypoint extraction in utility infrastructure images. Built automated error-analysis loops to continuously improve extraction reliability.`,
    role: 'Computer Vision Engineer · annotation strategy, fine-tuning, and the error-analysis loop',
    category: 'professional',
    sector: 'utility',
    type: 'case-study',
    status: 'completed',
    featured: true,
    techStack: ['Transformers', 'PyTorch', 'Fine-tuning', 'VLM'],
    problem: `Utility infrastructure analysis needs pixel-precise keypoints (attachment heights, wire positions), but generic vision models don't understand domain-specific structures, and expert annotation is too expensive to throw at every failure mode.`,
    approach: [
        'Built a custom annotation pipeline to capture domain-specific keypoints with consistent quality',
        'Fine-tuned a transformer model on those annotations for precise keypoint extraction',
        'Designed automated error-analysis loops: failure cases are mined, categorized, and fed back into training, so the model improves where it actually fails',
        'Deployed for communication-wire detection in production infrastructure analysis',
    ],
    outcomes: [
        { value: 'Fine-tuned', label: 'transformer on custom domain annotations' },
        { value: 'Self-improving', label: 'automated error-analysis loop drives each iteration' },
        { value: 'Production', label: 'communication-wire detection deployment' },
    ],
    pipeline: ['Imagery + annotations', 'Transformer fine-tune', 'Error-analysis loop', 'Keypoint extraction'],
    highlights: [
        'Custom annotation pipeline',
        'Automated error analysis and correction',
        'Communication wire detection',
        'High-precision key-point extraction',
    ],
};

export default project;
