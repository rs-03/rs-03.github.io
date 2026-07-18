import AskPortfolio from '@/components/sections/AskPortfolio';
import Tokenizer from '@/components/sections/Tokenizer';
import AttentionLens from '@/components/sections/AttentionLens';
import Morphogenesis from '@/components/sections/Morphogenesis';
import ProteinFolding from '@/components/sections/ProteinFolding';
import SequenceAlignment from '@/components/sections/SequenceAlignment';
import HodgkinHuxley from '@/components/sections/HodgkinHuxley';
import Evolution from '@/components/sections/Evolution';
import Diffusion from '@/components/sections/Diffusion';
import SignalMicroscope from '@/components/sections/SignalMicroscope';
import NeuralPlayground from '@/components/sections/NeuralPlayground';
import KeypointStudio from '@/components/sections/KeypointStudio';
import MirrorTherapy from '@/components/sections/MirrorTherapy';
import CoughMonitor from '@/components/sections/CoughMonitor';
import CamouflageTester from '@/components/sections/CamouflageTester';
import CTABand from '@/components/sections/CTABand';
import ShareButton from '@/components/ShareButton';
import { siteConfig } from '@/data/siteConfig';
import styles from './page.module.css';

export const metadata = {
    title: 'Live Demos | Rahul Sangamker',
    description: 'Interactive AI/ML demos running entirely in your browser. Draw for a neural network trained from scratch, or try real-time hand keypoint detection.',
};

// A skimmer's shortlist: the four that map most directly to paid AI/ML work.
const FEATURED = [
    { icon: '💬', title: 'Ask My Portfolio', why: 'Retrieval over this site, running in your browser', href: '#ask' },
    { icon: '🧠', title: 'What a Sentence Attends To', why: 'How a transformer actually reads', href: '#attention' },
    { icon: '🎯', title: 'Can an AI Spot You?', why: 'Object detection under real conditions', href: '#camouflage' },
    { icon: '✍️', title: 'Draw a Digit', why: 'A neural network built from scratch', href: '#live-demo' },
];

/**
 * Live Demos Page - interactive ML running in the visitor's browser
 */
export default function DemosPage() {
    return (
        <>
            <section className={styles.intro}>
                <div className="container">
                    <span className="section-header__eyebrow">Try, Don&apos;t Trust</span>
                    <h1 className={styles.title}>Live Demos</h1>
                    <p className={styles.description}>
                        Working AI you can poke at, right here in your browser. Nothing is
                        uploaded, nothing is faked. Open devtools and watch it run on your
                        device.
                    </p>

                    <div className={styles.shareRow}>
                        <ShareButton
                            url={`${siteConfig.siteUrl}/demos`}
                            title="Live AI/ML demos in the browser"
                            text="Working AI you can poke at, running entirely in your browser."
                            label="Share these demos"
                        />
                    </div>

                    <div className={`${styles.featured} reveal-on-scroll`}>
                        <span className={styles.featuredLabel}>New here? Start with these</span>
                        <div className={styles.featuredRow}>
                            {FEATURED.map(f => (
                                <a key={f.href} href={f.href} className={styles.featuredCard}>
                                    <span className={styles.featuredIcon}>{f.icon}</span>
                                    <span className={styles.featuredTitle}>{f.title}</span>
                                    <span className={styles.featuredWhy}>{f.why}</span>
                                </a>
                            ))}
                        </div>
                    </div>

                    <p className={styles.bridge}>
                        These demos are how I keep the fundamentals sharp. The same rigor,
                        reliability, explainability, and code you can actually run, goes into
                        client work. If something here maps to a problem you have, let&apos;s talk.
                    </p>
                </div>
            </section>

            <AskPortfolio />
            <Tokenizer />
            <AttentionLens />
            <Morphogenesis />
            <ProteinFolding />
            <SequenceAlignment />
            <HodgkinHuxley />
            <Evolution />
            <Diffusion />
            <SignalMicroscope />
            <CoughMonitor />
            <MirrorTherapy />
            <CamouflageTester />
            <KeypointStudio />
            <NeuralPlayground />

            <CTABand
                contactHref="/#contact"
                eyebrow="You just watched it run on your own machine"
                headline="Want this kind of rigor on your problem?"
                sub="Every demo here is honest, in-browser, and open to inspection. I bring the same standard to client work. Tell me what you're trying to build."
            />
        </>
    );
}
