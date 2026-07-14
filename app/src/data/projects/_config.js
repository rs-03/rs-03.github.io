/**
 * Shared Project Configuration
 * Categories, defaults, and common settings
 */

export const projectCategories = [
    { id: 'professional', name: 'Professional Work', icon: '💼', description: 'Enterprise and client projects' },
    { id: 'personal', name: 'Personal Initiatives', icon: '🚀', description: 'Research and experimental projects' },
];

/**
 * Default values for optional project fields
 */
export const projectDefaults = {
    featured: false,
    imageUrl: null,
    videoUrl: null,
    demoUrl: null,
    repoUrl: null,
    articleUrl: null,
    clientType: null,
    impactMetric: null,
    role: null, // e.g. 'Computer Vision Engineer · model development through production deployment'
    useCases: [],
    // Case-study fields (rendered when present)
    problem: null,
    approach: [], // ordered steps: strings
    outcomes: [], // metric cards: { value, label }
    pipeline: [], // architecture flow: stage labels
};

/**
 * Project Types:
 * - 'case-study': Full detailed page with problem/solution/outcomes
 * - 'demo': Interactive demo project with launch button
 * - 'card': Simple project card (minimal details)
 * 
 * Project Status:
 * - 'completed': Done, can show full details
 * - 'live': Has working demo
 * - 'coming-soon': Placeholder, in development
 */

/**
 * Get category info by ID
 * @param {string} categoryId 
 * @returns {object|undefined}
 */
export function getCategoryById(categoryId) {
    return projectCategories.find(c => c.id === categoryId);
}
