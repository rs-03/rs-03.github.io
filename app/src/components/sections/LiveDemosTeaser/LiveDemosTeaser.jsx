import Link from 'next/link';
import styles from './LiveDemosTeaser.module.css';

const DEMOS = [
    {
        icon: '💬',
        title: 'Ask My Portfolio',
        blurb: 'Semantic search over this site, running in your browser',
        href: '/demos#ask',
    },
    {
        icon: '🔤',
        title: 'Watch a Tokenizer Learn to Read',
        blurb: 'Byte-pair encoding trained live, then splitting your text',
        href: '/demos#tokens',
    },
    {
        icon: '🧠',
        title: 'See What a Sentence Attends To',
        blurb: 'Transformer self-attention over a real model’s token vectors',
        href: '/demos#attention',
    },
    {
        icon: '🐆',
        title: 'How the Leopard Got Its Spots',
        blurb: 'Paint into Turing’s reaction-diffusion, live on your GPU',
        href: '/demos#morphogenesis',
    },
    {
        icon: '🧬',
        title: 'Watch a Protein Fold',
        blurb: 'The HP lattice model minimizing energy by simulated annealing',
        href: '/demos#folding',
    },
    {
        icon: '🧵',
        title: 'Line Up Two Sequences',
        blurb: 'Smith-Waterman and Needleman-Wunsch, matrix and traceback animated',
        href: '/demos#alignment',
    },
    {
        icon: '⚡',
        title: 'Fire a Neuron',
        blurb: 'The Hodgkin-Huxley action potential from its four real equations',
        href: '/demos#neuron',
    },
    {
        icon: '🎲',
        title: 'Watch Evolution Roll the Dice',
        blurb: 'Genetic drift and selection across many populations, Wright-Fisher',
        href: '/demos#evolution',
    },
    {
        icon: '🌫️',
        title: 'Watch Noise Become a Shape',
        blurb: 'Reverse diffusion, the math behind image generators, in 2D',
        href: '/demos#diffusion',
    },
    {
        icon: '🔬',
        title: 'The Signal Microscope',
        blurb: 'Watch sound become numbers, every DSP stage animated live',
        href: '/demos#microscope',
    },
    {
        icon: '🫁',
        title: 'Cough Fingerprint',
        blurb: 'Your personal acoustic baseline, hand-rolled DSP',
        href: '/demos#cough',
    },
    {
        icon: '🪞',
        title: 'Mirror Therapy',
        blurb: 'The phantom-limb illusion, no mirror box needed',
        href: '/demos#mirror',
    },
    {
        icon: '🎯',
        title: 'Can an AI Spot You?',
        blurb: 'Test camouflage against a detection model at four distances',
        href: '/demos#camouflage',
    },
    {
        icon: '🖐️',
        title: 'Keypoints to Measurements',
        blurb: 'Live hand tracking with a real-centimeter pinch ruler',
        href: '/demos#keypoints',
    },
    {
        icon: '✍️',
        title: 'Draw a Digit',
        blurb: 'A from-scratch neural network reads your handwriting',
        href: '/demos#live-demo',
    },
];

/**
 * Live Demos Teaser - compact homepage strip linking into the demo lab
 */
export default function LiveDemosTeaser() {
    return (
        <section className={`section ${styles.teaser}`}>
            <div className="container">
                <div className="section-header">
                    <span className="section-header__eyebrow">Proof, Not Promises</span>
                    <h2 className="section-header__title">Working AI You Can Try Right Now</h2>
                    <p className="section-header__description">
                        Fifteen live demos run entirely in your browser, with nothing uploaded
                        and nothing faked. Pick one and poke at it.
                    </p>
                </div>

                <div className={styles.grid}>
                    {DEMOS.map(demo => (
                        <Link key={demo.href} href={demo.href} className={styles.card}>
                            <span className={styles.icon}>{demo.icon}</span>
                            <span className={styles.title}>{demo.title}</span>
                            <span className={styles.blurb}>{demo.blurb}</span>
                            <span className={styles.try}>
                                <span className={styles.liveDot} aria-hidden="true" />
                                Try it →
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
