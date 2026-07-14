const project = {
    slug: 'digit-recognition-network',
    title: 'In-Browser Neural Network (From Scratch)',
    shortDescription: 'A digit-recognition network hand-built in raw NumPy, int8-quantized to 145 KB, running as pure JavaScript. Try it live.',
    fullDescription: `A complete neural network built without any ML framework: hand-written forward and backward passes, Adam optimizer, and shift augmentation in raw NumPy, reaching 98.2% test accuracy. The weights are int8-quantized (4× smaller, no accuracy loss) and shipped as a 145 KB JSON file, with inference running as ~80 lines of dependency-free JavaScript directly in the visitor's browser. A parity test verifies the JavaScript engine reproduces the Python model's probabilities to within 1e-6.`,
    category: 'personal',
    sector: 'research',
    type: 'demo',
    status: 'live',
    featured: false,
    techStack: ['NumPy', 'Neural Networks', 'Quantization', 'JavaScript', 'React'],
    highlights: [
        'Trained from scratch, no TensorFlow, no PyTorch',
        '98.2% test accuracy, preserved after int8 quantization',
        'Zero-dependency JavaScript inference in the browser',
        'Python↔JS parity verified to 1e-6',
    ],
    demoUrl: '/demos#live-demo',
};

export default project;
