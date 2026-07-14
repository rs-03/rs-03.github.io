import Link from 'next/link';
import { services } from '@/data/services';
import styles from './Services.module.css';

/**
 * Services - what a client can actually engage me for
 */
export default function Services() {
    return (
        <section className={`section ${styles.services}`} id="services">
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Services</span>
                    <h2 className="section-header__title">What I Can Build for You</h2>
                    <p className="section-header__description">
                        Project-based engagements with clear scope, working software, and full
                        handover. See the process below
                    </p>
                </div>

                <div className={styles.grid}>
                    {services.map(service => (
                        <div
                            key={service.title}
                            className={`${styles.card} ${service.highlight ? styles.highlighted : ''}`}
                        >
                            {service.highlight && (
                                <span className={styles.badge}>Start here</span>
                            )}
                            <span className={styles.icon}>{service.icon}</span>
                            <h3 className={styles.title}>{service.title}</h3>
                            <p className={styles.description}>{service.description}</p>
                            <div className={styles.tags}>
                                {service.tags.map(tag => (
                                    <span key={tag} className={styles.tag}>{tag}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <p className={styles.cta}>
                    If it runs on software, it can be scoped.{' '}
                    <Link href="#contact">Start with a conversation →</Link>
                </p>
            </div>
        </section>
    );
}
