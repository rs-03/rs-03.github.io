const project = {
    slug: 'attention-lens',
    title: 'Attention Lens: Transformer Attention, Live',
    shortDescription: 'Type a sentence and watch a self-attention head score every token against every other, computed on-device over a real model.',
    fullDescription: `An interactive visualization of self-attention, the operation at the heart of every transformer. A visitor's sentence is embedded by a language model running in the browser, producing one vector per token, and a self-attention head then scores every token against every other with a scaled dot product and softmaxes each row into a distribution over what that token attends to. The result is drawn as an attention matrix and as token-to-token arcs. Honest by construction: it is the attention mechanism applied to a real model's token representations, not a read-out of the model's internal heads.`,
    category: 'personal',
    sector: 'research',
    type: 'demo',
    status: 'live',
    featured: false,
    role: 'Independent build · in-browser model inference, the attention computation, and the visualization',
    techStack: ['Transformers.js', 'WebAssembly', 'Self-Attention', 'Canvas', 'React'],
    highlights: [
        'Real MiniLM token embeddings computed on-device via WebAssembly',
        'Correct scaled-dot-product self-attention with softmax rows that sum to one',
        'Interactive attention matrix and token-to-token arc view',
        'Grounded in the literature (Vaswani et al., Attention Is All You Need, 2017)',
    ],
    demoUrl: '/demos#attention',
};

export default project;
