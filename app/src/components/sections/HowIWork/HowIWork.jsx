import { processSteps } from '@/data/process';
import styles from './HowIWork.module.css';

/**
 * How I Work - engagement process for prospective clients
 */
export default function HowIWork() {
    return (
        <section className={`section ${styles.howIWork}`}>
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Engagement</span>
                    <h2 className="section-header__title">How I Work</h2>
                    <p className="section-header__description">
                        From first call to handover, built for teams that need results, not research
                    </p>
                </div>

                <div className={styles.steps}>
                    {processSteps.map((step, index) => (
                        <div key={step.number} className={styles.step}>
                            <div className={styles.stepHeader}>
                                <span className={styles.stepNumber}>{step.number}</span>
                                {index < processSteps.length - 1 && <span className={styles.stepLine} aria-hidden="true" />}
                            </div>
                            <h3 className={styles.stepTitle}>{step.title}</h3>
                            <p className={styles.stepDescription}>{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
