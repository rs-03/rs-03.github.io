const project = {
    slug: 'workflow-builder',
    title: 'AI-Powered Workflow Builder',
    shortDescription: 'Drag-and-drop automation platform with intelligent code generation and automatic workflow creation.',
    fullDescription: `Enterprise-grade visual workflow builder that enables teams to create complex AI pipelines without writing code. Features intelligent node connection, automatic code generation, and real-time workflow validation.`,
    role: 'AI/ML Engineer · sole builder, from architecture through delivery',
    category: 'professional',
    sector: 'enterprise',
    type: 'case-study',
    status: 'completed',
    featured: true,
    techStack: ['React', 'Python', 'FastAPI', 'Node-based UI'],
    problem: `Evaluation and data workflows lived in scattered scripts and notebooks. Every new multi-step pipeline meant a developer writing glue code, and nobody outside engineering could modify, rerun, or even inspect what a pipeline actually did.`,
    approach: [
        'Built a node-based visual canvas (React) where pipelines are assembled by dragging and connecting blocks, no code required',
        'Added intelligent auto-connection and real-time validation so invalid flows are caught while building, not at runtime',
        'Designed a Python/FastAPI execution engine that generates and runs code from the visual graph',
        'Shipped a reusable node library covering evaluation, routing, model testing, and data transformation steps',
    ],
    outcomes: [
        { value: 'No-code', label: 'pipeline assembly; visual flows replace handwritten glue scripts' },
        { value: 'Reusable', label: 'node library shared across evaluation and model-testing workflows' },
        { value: 'Local-first', label: 'runs entirely on-prem; sensitive data never leaves the network' },
    ],
    pipeline: ['Drag & drop nodes', 'Auto-connect & validate', 'Code generation', 'Execute & monitor'],
    highlights: [
        'Drag-and-drop interface for pipeline creation',
        'Intelligent code generation from visual flows',
        'Automatic node connection suggestions',
        'Support for multi-step evaluation pipelines',
    ],
    useCases: [
        'Automated data processing pipelines',
        'ML model evaluation workflows',
        'Document processing automation',
        'API integration orchestration',
    ],
};

export default project;
