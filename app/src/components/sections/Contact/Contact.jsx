'use client';

import { useState } from 'react';
import { siteConfig } from '@/data/siteConfig';
import styles from './Contact.module.css';

/**
 * Contact Section with form
 * Uses Formspree for form handling (no backend required)
 */
export default function Contact() {
    const [formState, setFormState] = useState({
        name: '',
        email: '',
        message: '',
        _gotcha: '', // honeypot: humans never see it, bots fill it, Formspree drops those
    });
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error

    const handleChange = (e) => {
        setFormState(prev => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('submitting');

        try {
            // Using Formspree for form handling (AJAX mode requires
            // reCAPTCHA disabled in the form's Formspree settings)
            const response = await fetch('https://formspree.io/f/xbdjnvbv', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(formState),
            });

            if (response.ok) {
                setStatus('success');
                setFormState({ name: '', email: '', message: '', _gotcha: '' });
            } else {
                setStatus('error');
            }
        } catch (error) {
            setStatus('error');
        }
    };

    return (
        <section id="contact" className={`section ${styles.contact}`}>
            <div className="container">
                <div className={styles.wrapper}>
                    {/* Left - Info */}
                    <div className={styles.info}>
                        <span className="section-header__eyebrow">Contact</span>
                        <h2 className={styles.title}>Let&apos;s Work Together</h2>
                        {siteConfig.availability?.available && (
                            <p className={styles.availability}>
                                <span className={styles.availabilityDot} aria-hidden="true" />
                                {siteConfig.availability.label} · currently taking on new engagements
                            </p>
                        )}
                        <p className={styles.description}>
                            Have a problem AI might solve? Describe it in a few sentences
                            and I&apos;ll get back to you with how I&apos;d approach it and
                            what it would take.
                        </p>

                        <div className={styles.contactMethods}>
                            <a href={`mailto:${siteConfig.email}`} className={styles.contactMethod}>
                                <span className={styles.contactIcon}>📧</span>
                                <span className={styles.contactLabel}>Email me directly</span>
                                <span className={styles.contactValue}>{siteConfig.email}</span>
                            </a>

                            <div className={styles.contactMethod}>
                                <span className={styles.contactIcon}>📍</span>
                                <span className={styles.contactLabel}>Location</span>
                                <span className={styles.contactValue}>{siteConfig.location}</span>
                            </div>

                            {siteConfig.bookingUrl && (
                                <a
                                    href={siteConfig.bookingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.contactMethod}
                                >
                                    <span className={styles.contactIcon}>📅</span>
                                    <span className={styles.contactLabel}>Prefer to talk? Book a call</span>
                                    <span className={styles.contactValue}>Grab a 20-minute slot</span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Right - Form */}
                    <div className={styles.formWrapper}>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            {/* Honeypot, hidden from humans */}
                            <input
                                type="text"
                                name="_gotcha"
                                value={formState._gotcha}
                                onChange={handleChange}
                                style={{ display: 'none' }}
                                tabIndex={-1}
                                autoComplete="off"
                                aria-hidden="true"
                            />

                            <div className="form-group">
                                <label htmlFor="name" className="form-label">Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formState.name}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Your name"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="email" className="form-label">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formState.email}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="message" className="form-label">Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    value={formState.message}
                                    onChange={handleChange}
                                    className="form-textarea"
                                    placeholder="Tell me about your project..."
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className={`btn btn--primary ${styles.submitBtn}`}
                                disabled={status === 'submitting'}
                            >
                                {status === 'submitting' ? 'Sending...' : 'Send Message'}
                            </button>

                            {/* Status Messages */}
                            {status === 'success' && (
                                <p className={styles.successMessage}>
                                    ✅ Message sent! I&apos;ll get back to you soon.
                                </p>
                            )}
                            {status === 'error' && (
                                <p className={styles.errorMessage}>
                                    ❌ Something went wrong. Please try emailing directly.
                                </p>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
}
