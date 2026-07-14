const project = {
    slug: 'agentic-rag',
    title: 'Advanced Multimodal Agentic RAG',
    shortDescription: 'Enterprise RAG platform with multi-database connectivity enabling natural language data interaction.',
    fullDescription: `Advanced Retrieval-Augmented Generation system with agentic capabilities that connects to multiple enterprise data sources including Azure SQL, AWS S3, PostgreSQL, and more. Enables users to have natural conversations with their data across multiple databases and file systems using multimodal understanding.`,
    role: 'AI/ML Engineer · system architecture and implementation',
    category: 'professional',
    sector: 'enterprise',
    type: 'case-study',
    status: 'completed',
    featured: true,
    techStack: ['LangChain', 'LangGraph', 'Azure SQL', 'AWS S3', 'PostgreSQL', 'FastAPI', 'React'],
    problem: `Enterprise data was split across Azure SQL, AWS S3, PostgreSQL, and file systems. Answering one business question meant knowing which system held the data, who could query it, and how, so most questions simply didn't get asked.`,
    approach: [
        'Built an agentic query planner (LangGraph) that decomposes a natural-language question and decides which sources to hit',
        'Implemented natural-language-to-SQL/API translation with multimodal document understanding for unstructured sources',
        'Added retrieval evaluation and causal analysis so answers are graded for grounding, not just generated',
        'Closed the loop with iterative prompt optimization; the system tunes its own retrieval prompts from evaluation results',
    ],
    outcomes: [
        { value: '4+', label: 'data sources behind a single conversational interface' },
        { value: 'Graded', label: 'retrieval evaluation; answers are scored for grounding' },
        { value: 'Self-tuning', label: 'iterative prompt optimization built into the loop' },
    ],
    pipeline: ['Natural language', 'Agent planning', 'Multi-source retrieval', 'Grounded answer'],
    highlights: [
        'Multi-database connectivity (Azure SQL, AWS S3, PostgreSQL)',
        'Agentic query planning and execution',
        'Natural language to SQL/API translation',
        'Multimodal document understanding',
        'Context-aware response generation',
        'Enterprise-grade security and access control',
    ],
    useCases: [
        'Enterprise data exploration and analysis',
        'Cross-database business intelligence',
        'Document Q&A across file systems',
        'Automated report generation',
    ],
};

export default project;
