/**
 * Project Sectors Configuration
 * Central definition of all project categories
 */

export const sectors = [
    {
        id: 'healthcare',
        name: 'Healthcare & Medical',
        icon: '🏥',
        description: 'AI solutions for healthcare and medical applications',
    },
    {
        id: 'agriculture',
        name: 'Agriculture & Environment',
        icon: '🌾',
        description: 'Technology for sustainable agriculture and environmental monitoring',
    },
    {
        id: 'defense',
        name: 'Defense & Security',
        icon: '🛡️',
        description: 'Advanced AI for defense and security applications',
    },
    {
        id: 'enterprise',
        name: 'Enterprise AI',
        icon: '💼',
        description: 'Scalable AI solutions for enterprise workflows',
    },
    {
        id: 'utility',
        name: 'Utility & Power',
        icon: '⚡',
        description: 'AI systems for utility infrastructure and power grid analysis',
    },
    {
        id: 'research',
        name: 'Research & Innovation',
        icon: '🔬',
        description: 'Cutting-edge research in AI/ML technologies',
    },
    {
        id: 'life-sciences',
        name: 'Life Sciences & Biology',
        icon: '🧬',
        description: 'Computational biology, biophysics, and pattern-formation modeling',
    },
    {
        id: 'gis',
        name: 'GIS & Mapping',
        icon: '🗺️',
        description: 'Geospatial intelligence and mapping solutions',
    },
    {
        id: 'creative',
        name: 'Creative & Digital',
        icon: '🎨',
        description: 'AI tools for creative workflows and digital content creation',
    },
];

/**
 * Get a sector by its ID
 * @param {string} sectorId 
 * @returns {object|undefined}
 */
export function getSectorById(sectorId) {
    return sectors.find(s => s.id === sectorId);
}

/**
 * Get sector display info (name + icon)
 * @param {string} sectorId 
 * @returns {string}
 */
export function getSectorLabel(sectorId) {
    const sector = getSectorById(sectorId);
    return sector ? `${sector.icon} ${sector.name}` : sectorId;
}
