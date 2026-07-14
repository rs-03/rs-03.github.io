import AskPortfolio from '@/components/sections/AskPortfolio';
import Tokenizer from '@/components/sections/Tokenizer';
import AttentionLens from '@/components/sections/AttentionLens';
import Morphogenesis from '@/components/sections/Morphogenesis';
import ProteinFolding from '@/components/sections/ProteinFolding';
import SequenceAlignment from '@/components/sections/SequenceAlignment';
import HodgkinHuxley from '@/components/sections/HodgkinHuxley';
import Evolution from '@/components/sections/Evolution';
import SignalMicroscope from '@/components/sections/SignalMicroscope';
import NeuralPlayground from '@/components/sections/NeuralPlayground';
import KeypointStudio from '@/components/sections/KeypointStudio';
import MirrorTherapy from '@/components/sections/MirrorTherapy';
import CoughMonitor from '@/components/sections/CoughMonitor';
import CamouflageTester from '@/components/sections/CamouflageTester';
import styles from './page.module.css';

export const metadata = {
    title: 'Live Demos | Rahul Sangamker',
    description: 'Interactive AI/ML demos running entirely in your browser. Draw for a neural network trained from scratch, or try real-time hand keypoint detection.',
};

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
                        device. More demos are on the way.
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
            <SignalMicroscope />
            <CoughMonitor />
            <MirrorTherapy />
            <CamouflageTester />
            <KeypointStudio />
            <NeuralPlayground />
        </>
    );
}
