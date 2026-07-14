import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllProjects, getProjectBySlug } from '@/data/projects/index';
import { getSectorById } from '@/data/sectors';
import PipelineFlow from '@/components/PipelineFlow';
import styles from './page.module.css';

/**
 * Generate static params for all project pages
 */
export async function generateStaticParams() {
    const projects = getAllProjects();
    return projects.map(project => ({
        slug: project.slug,
    }));
}

/**
 * Generate metadata for the project page
 */
export async function generateMetadata({ params }) {
    const { slug } = await params;
    const project = getProjectBySlug(slug);
    if (!project) return { title: 'Project Not Found' };

    return {
        title: `${project.title} | Rahul Sangamker`,
        description: project.shortDescription,
    };
}

/**
 * Individual Project Page
 */
export default async function ProjectPage({ params }) {
    const { slug } = await params;
    const project = getProjectBySlug(slug);

    if (!project) {
        notFound();
    }

    const sector = getSectorById(project.sector);

    const statusLabels = {
        'completed': 'Completed',
        'live': 'Live Demo',
        'coming-soon': 'Coming Soon',
    };

    return (
        <section className={styles.projectPage}>
            <div className="container">
                {/* Back Button */}
                <Link href="/projects" className={styles.backLink}>
                    ← Back to Projects
                </Link>

                {/* Project Header */}
                <header className={styles.header}>
                    <div className={styles.meta}>
                        <span className={styles.sector}>
                            {sector?.icon} {sector?.name}
                        </span>
                        <span className={`badge badge--${project.status === 'coming-soon' ? 'warning' : 'success'}`}>
                            {statusLabels[project.status]}
                        </span>
                    </div>

                    <h1 className={styles.title}>{project.title}</h1>

                    {/* Role & ownership */}
                    {project.role && (
                        <p className={styles.role}>
                            <span className={styles.roleLabel}>My role</span>
                            {project.role}
                        </p>
                    )}

                    <p className={styles.description}>{project.shortDescription}</p>

                    {/* Tech Stack */}
                    <div className={styles.techStack}>
                        {project.techStack.map((tech, index) => (
                            <span key={index} className="tag">{tech}</span>
                        ))}
                    </div>
                </header>

                {/* Architecture Pipeline */}
                {project.pipeline && project.pipeline.length > 0 && (
                    <div className={styles.pipelineWrapper}>
                        <PipelineFlow stages={project.pipeline} />
                    </div>
                )}

                {/* Content Grid */}
                <div className={styles.content}>
                    {/* Main Content */}
                    <div className={styles.main}>
                        {/* Full Description */}
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Overview</h2>
                            <p className={styles.text}>{project.fullDescription}</p>
                        </div>

                        {/* Problem */}
                        {project.problem && (
                            <div className={styles.section}>
                                <h2 className={styles.sectionTitle}>The Problem</h2>
                                <div className={styles.problemCallout}>
                                    <p className={styles.text}>{project.problem}</p>
                                </div>
                            </div>
                        )}

                        {/* Approach */}
                        {project.approach && project.approach.length > 0 && (
                            <div className={styles.section}>
                                <h2 className={styles.sectionTitle}>The Approach</h2>
                                <ol className={styles.approachList}>
                                    {project.approach.map((step, index) => (
                                        <li key={index} className={styles.approachItem}>
                                            <span className={styles.approachNumber}>
                                                {String(index + 1).padStart(2, '0')}
                                            </span>
                                            <span className={styles.approachText}>{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Outcomes */}
                        {project.outcomes && project.outcomes.length > 0 && (
                            <div className={styles.section}>
                                <h2 className={styles.sectionTitle}>The Outcome</h2>
                                <div className={styles.outcomeGrid}>
                                    {project.outcomes.map((outcome, index) => (
                                        <div key={index} className={styles.outcomeCard}>
                                            <span className={styles.outcomeValue}>{outcome.value}</span>
                                            <span className={styles.outcomeLabel}>{outcome.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Highlights */}
                        {project.highlights && project.highlights.length > 0 && (
                            <div className={styles.section}>
                                <h2 className={styles.sectionTitle}>Key Features</h2>
                                <ul className={styles.highlightList}>
                                    {project.highlights.map((highlight, index) => (
                                        <li key={index} className={styles.highlightItem}>
                                            <span className={styles.checkIcon}>✓</span>
                                            {highlight}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Use Cases */}
                        {project.useCases && project.useCases.length > 0 && (
                            <div className={styles.section}>
                                <h2 className={styles.sectionTitle}>Use Cases</h2>
                                <ul className={styles.useCaseList}>
                                    {project.useCases.map((useCase, index) => (
                                        <li key={index} className={styles.useCaseItem}>
                                            {useCase}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className={styles.sidebar}>
                        {/* Impact Metric */}
                        {project.impactMetric && (
                            <div className={styles.impactCard}>
                                <span className={styles.impactLabel}>Impact</span>
                                <span className={styles.impactValue}>{project.impactMetric}</span>
                            </div>
                        )}

                        {/* Client Type */}
                        {project.clientType && (
                            <div className={styles.infoCard}>
                                <span className={styles.infoLabel}>Client</span>
                                <span className={styles.infoValue}>{project.clientType}</span>
                            </div>
                        )}

                        {/* Demo Button */}
                        {project.demoUrl && project.status !== 'coming-soon' && (
                            <Link href={project.demoUrl} className="btn btn--primary">
                                Launch Demo
                            </Link>
                        )}

                        {/* Source Button */}
                        {project.repoUrl && (
                            <a
                                href={project.repoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn--secondary"
                            >
                                View Source on GitHub
                            </a>
                        )}

                        {/* Article Button */}
                        {project.articleUrl && (
                            <a
                                href={project.articleUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn--secondary"
                            >
                                Read the Build Story
                            </a>
                        )}

                        {project.status === 'coming-soon' && (
                            <div className={styles.comingSoon}>
                                <span className={styles.comingSoonIcon}>🚧</span>
                                <span className={styles.comingSoonText}>Demo coming soon</span>
                            </div>
                        )}

                        {/* Video Placeholder - Only for personal projects */}
                        {project.category === 'personal' && (
                            project.videoUrl ? (
                                <div className={styles.videoWrapper}>
                                    <video src={project.videoUrl} controls className={styles.video} />
                                </div>
                            ) : (
                                <div className={styles.videoPlaceholder}>
                                    <span className={styles.placeholderIcon}>🎬</span>
                                    <span className={styles.placeholderText}>Demo video coming soon</span>
                                </div>
                            )
                        )}
                    </aside>
                </div>
            </div>
        </section>
    );
}
