/**
 * Site Configuration
 * Personal and site-wide settings
 */

export const siteConfig = {
    // Personal Info
    name: 'Rahul Sangamker',
    title: 'AI/ML Engineer',
    tagline: 'Building AI Systems That Work in the Real World',

    // Experience
    experienceYears: '5+',
    experienceStartYear: 2021,

    // Bio
    bio: `AI/ML Engineer with 5+ years of experience building production-grade AI systems that deliver measurable business impact. I specialize in LLMs, computer vision, and end-to-end ML pipelines, from research prototypes to Fortune 500 deployments.

My work spans transformer fine-tuning, agentic AI systems, document intelligence, and interactive ML platforms. I focus on reliability, explainability, and outcomes that matter.`,

    // Contact
    email: 'rahul.sangamker03@gmail.com',
    location: 'Hyderabad, India',

    // Availability signal shown in hero + contact
    availability: {
        available: true,
        label: 'Open to new projects',
    },

    // Social Links
    social: {
        github: 'https://github.com/rs-03',
        repo: 'https://github.com/rs-03/rs-03.github.io',
        linkedin: null, // Add when ready
        twitter: null, // Add when ready
    },

    // Stats to display
    stats: [
        { value: '5+', label: 'Years Experience' },
        { value: '14+', label: 'AI Products Delivered' },
        { value: '$20M+', label: 'Business Impact' },
        { value: 'Fortune 500', label: 'Clients Served' },
    ],

    // Skills categorized
    skills: [
        {
            category: 'ML & Deep Learning',
            items: ['Transformers', 'LLM Fine-tuning', 'PyTorch', 'TensorFlow', 'Computer Vision', 'YOLO', 'SAM2', 'Keras', 'scikit-learn', 'H2O', 'XGBoost', 'MMDetection', 'OpenCV'],
        },
        {
            category: 'GenAI & Prompt Engineering',
            items: ['LangChain', 'LangGraph', 'RAG Systems', 'Agentic AI', 'Prompt Engineering', 'Vibe Coding', 'Chain-of-Thought', 'Few-shot Learning'],
        },
        {
            category: 'LLMs & NLP',
            items: ['Hugging Face', 'OpenAI API', 'Anthropic Claude', 'Gemini', 'Ollama', 'vLLM', 'Text Embeddings', 'Semantic Search'],
        },
        {
            category: 'Cloud & Data',
            items: ['AWS (S3, Lambda, SageMaker)', 'Azure', 'Databricks', 'PySpark', 'Dask', 'Docker', 'MLflow', 'Pandas', 'NumPy', 'Seaborn'],
        },
        {
            category: 'Databases',
            items: ['PostgreSQL', 'MongoDB', 'Pinecone', 'ChromaDB', 'Weaviate', 'Redis', 'Azure SQL', 'Elasticsearch'],
        },
        {
            category: 'Full-Stack',
            items: ['React', 'Next.js', 'FastAPI', 'Flask', 'Streamlit', 'Python', 'JavaScript', 'Node.js'],
        },
    ],


    // Booking + analytics (optional; fill in to enable, otherwise hidden)
    // Set to a cal.com/Calendly link to show a "Book a call" button in Contact.
    bookingUrl: null,
    analytics: {
        // Privacy-friendly, cookieless GoatCounter. No cookie banner needed.
        // Set to null to turn analytics off.
        goatcounter: 'https://rs-03.goatcounter.com/count',
    },

    // SEO
    siteUrl: 'https://rs-03.github.io',
    siteTitle: 'Rahul Sangamker | AI/ML Engineer',
    siteDescription: 'AI/ML Engineer with 5+ years building production-grade AI systems. Specializing in LLMs, computer vision, and enterprise ML solutions.',
};
