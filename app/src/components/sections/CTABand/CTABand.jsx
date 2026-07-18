import Link from 'next/link';
import { siteConfig } from '@/data/siteConfig';
import styles from './CTABand.module.css';

/**
 * Reusable conversion band. Drop it after a high-interest section to turn
 * "that's neat" into a conversation. The booking button only appears when
 * siteConfig.bookingUrl is set, so it stays hidden until there's a link to point at.
 */
export default function CTABand({
    eyebrow = 'Have something like this in mind?',
    headline = "Let's turn it into working software",
    sub = "If any of this maps to a problem you're facing, describe it in a few sentences and I'll come back with how I'd approach it and what it would take.",
    contactHref = '#contact',
    primaryLabel = 'Describe your problem',
}) {
    const booking = siteConfig.bookingUrl;

    return (
        <section className={`section ${styles.band}`}>
            <div className="container">
                <div className={`${styles.inner} reveal-on-scroll`}>
                    <div className={styles.copy}>
                        <span className={styles.eyebrow}>{eyebrow}</span>
                        <h2 className={styles.headline}>{headline}</h2>
                        <p className={styles.sub}>{sub}</p>
                    </div>
                    <div className={styles.actions}>
                        <Link href={contactHref} className={`btn btn--primary btn--lg ${styles.cta}`}>
                            {primaryLabel}
                        </Link>
                        {booking && (
                            <a
                                href={booking}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`btn btn--secondary btn--lg ${styles.cta}`}
                            >
                                Book a call
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
