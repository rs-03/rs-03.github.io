const project = {
    slug: 'tokenizer',
    title: 'Byte-Pair Encoding, Learned Live in the Browser',
    shortDescription: 'A tiny tokenizer that trains itself on sample text by merging the most frequent character pairs, then splits whatever you type.',
    fullDescription: `An interactive visualization of byte-pair encoding, the subword tokenization every modern language model relies on. Starting from single characters, the demo repeatedly finds the most frequent adjacent pair of symbols in a sample corpus and merges it into a new token, animating each merge and the shrinking token count, then segments the visitor's own text with the learned merges. Built to make tokenization, the very first step of how a model reads text, visible and honest, and it pairs with the attention demo as the how-a-model-reads-text story.`,
    category: 'personal',
    sector: 'research',
    type: 'demo',
    status: 'live',
    featured: false,
    role: 'Independent build · the byte-pair encoding trainer, the tokenizer, and the visualization',
    techStack: ['JavaScript', 'Byte-Pair Encoding', 'Tokenization', 'React'],
    highlights: [
        'Real BPE training: merge the most frequent adjacent pair, repeat',
        'Live animation of the merges and the shrinking corpus token count',
        'Tokenize your own text with the learned merges, reversibly',
        'Grounded in the literature (Gage 1994, Sennrich et al. 2016)',
    ],
    demoUrl: '/demos#tokens',
};

export default project;
