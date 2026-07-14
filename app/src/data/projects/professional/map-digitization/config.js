const project = {
    slug: 'map-digitization',
    title: 'Planning Map Digitization',
    shortDescription: 'Computer vision system that converts scanned planning maps into queryable geospatial data.',
    fullDescription: `Software that turns static planning-map images into structured geospatial data: map regions are extracted automatically by category, georeferenced onto real-world coordinates, and verified through a human-in-the-loop review workflow. Enables designation lookup for any parcel from documents that previously required manual reading.`,
    role: 'Computer Vision Engineer · pipeline design and delivery',
    category: 'professional',
    sector: 'gis',
    type: 'card',
    status: 'completed',
    featured: false,
    techStack: ['OpenCV', 'Python', 'GIS', 'React'],
    highlights: [
        'Automated region extraction from scanned maps',
        'Georeferencing onto real-world coordinates',
        'Human-in-the-loop review for accuracy',
        'Parcel-level designation lookup',
    ],
};

export default project;
