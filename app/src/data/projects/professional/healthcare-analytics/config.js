const project = {
    slug: 'healthcare-analytics',
    title: 'Healthcare Analytics Platform',
    shortDescription: 'End-to-end Gen-AI analytics platform delivering $20M+ annual savings for a major pharmacy chain.',
    fullDescription: `End-to-end analytics platform for pharmaceutical reshipment optimization: an ETL pipeline consolidates millions of unstructured shipment records, a Gen-AI extraction layer turns them into analyzable signals, and an interactive dashboard lets operations teams explore the drivers behind costly reshipments. The analysis surfaced an estimated $20M+ in annual savings.`,
    role: 'ML & Full-Stack Engineer · owned the platform from data pipeline to analytics UI',
    category: 'professional',
    sector: 'healthcare',
    type: 'card',
    status: 'completed',
    featured: true,
    clientType: 'Major US Pharmacy Chain',
    impactMetric: '$20M+ Annual Savings',
    techStack: ['Gen AI', 'PySpark', 'Databricks', 'PostgreSQL', 'FastAPI', 'React'],
    problem: `Pharmaceutical reshipments were a major recurring cost, but the reasons behind them were buried in millions of unstructured operational records spread across systems, too messy for traditional analytics to explain why shipments were failing.`,
    approach: [
        'Engineered an ETL pipeline (PySpark on Databricks) that ingested and normalized millions of unstructured shipment records into a PostgreSQL analytical store',
        'Designed a Gen-AI feature-extraction layer over the consolidated data to isolate and rank the drivers behind failed and repeated deliveries',
        'Built a FastAPI backend and React dashboard so operations teams could query, filter, and visualize those drivers themselves',
        'Translated the analysis into concrete, ranked intervention opportunities rather than static reports',
    ],
    outcomes: [
        { value: '$20M+', label: 'estimated annual savings identified' },
        { value: 'End-to-end', label: 'one engineer: pipeline, models, and UI' },
        { value: 'Self-serve', label: 'operations teams explore drivers without analysts' },
    ],
    pipeline: ['Operational records', 'ETL (PySpark)', 'Gen-AI extraction', 'Analytics dashboard'],
    highlights: [
        'High-volume ETL into an analytical store',
        'Gen-AI feature extraction over unstructured records',
        'Interactive driver-analysis dashboard',
        '$20M+ estimated annual savings',
    ],
};

export default project;
