'use client';

import Link from 'next/link';
import { siteConfig } from '@/data/siteConfig';
import NeuralField from './NeuralField';
import TypedRoles from './TypedRoles';
import LearningLive from './LearningLive';
import styles from './Hero.module.css';

/**
 * Hero Section - Main landing area
 * Animated neural-constellation background + typed specialties
 */
export default function Hero() {
    return (
        <section className={styles.hero}>
            {/* Animated Background */}
            <div className={styles.background}>
                <NeuralField />
                <div className={styles.bgGlow}></div>
            </div>

            <div className={`container ${styles.container}`}>
                <div className={styles.heroGrid}>
                <div className={styles.content}>
                    {/* Availability */}
                    {siteConfig.availability?.available && (
                        <a href="#contact" className={styles.availability}>
                            <span className={styles.availabilityDot} aria-hidden="true" />
                            {siteConfig.availability.label}
                        </a>
                    )}

                    {/* Eyebrow */}
                    <p className={styles.eyebrow}>
                        <span className={styles.eyebrowIcon}>👋</span>
                        Hello, I&apos;m
                    </p>

                    {/* Name */}
                    <h1 className={styles.name}>{siteConfig.name}</h1>

                    {/* Title + typed specialties */}
                    <p className={styles.title}>{siteConfig.title}</p>
                    <p className={styles.typedLine}>
                        I build <TypedRoles />
                    </p>

                    {/* Tagline */}
                    <p className={styles.tagline}>{siteConfig.tagline}</p>

                    {/* CTA Buttons */}
                    <div className={styles.actions}>
                        <Link href="/projects" className="btn btn--primary btn--lg">
                            View My Work
                        </Link>
                        <Link href="#contact" className="btn btn--secondary btn--lg">
                            Get in Touch
                        </Link>
                    </div>

                    {/* Live demo teaser */}
                    <Link href="/demos" className={styles.demoTeaser}>
                        <span className={styles.demoTeaserPulse} aria-hidden="true" />
                        Fourteen more live AI demos on this site. Try them →
                    </Link>
                </div>

                {/* Live learning panel */}
                <LearningLive />
                </div>
            </div>
        </section>
    );
}
