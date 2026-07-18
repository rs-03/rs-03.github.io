import { ImageResponse } from 'next/og';
import { siteConfig } from '@/data/siteConfig';

export const dynamic = 'force-static';
export const alt = 'Live AI/ML demos running entirely in your browser';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CHIPS = [
    ['Ask My Portfolio', '#9d8df0'],
    ['Transformer attention', '#8cdcff'],
    ['Diffusion', '#f6a723'],
    ['Protein folding', '#4ade80'],
    ['Fire a neuron', '#ffd27a'],
    ['Object detection', '#f87171'],
];

/**
 * Open Graph card for the Live Demos page, generated at build time.
 */
export default function DemosOpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '80px',
                    background: 'linear-gradient(135deg, #0a0a14 0%, #1a1430 100%)',
                    color: '#f0f0f5',
                    fontFamily: 'sans-serif',
                }}
            >
                <div style={{ display: 'flex', fontSize: 28, color: '#9d8df0', marginBottom: 20, letterSpacing: 2 }}>
                    LIVE DEMOS · TRY, DON&apos;T TRUST
                </div>
                <div style={{ display: 'flex', fontSize: 78, fontWeight: 700, lineHeight: 1.05 }}>
                    Working AI you can poke at
                </div>
                <div style={{ display: 'flex', fontSize: 34, color: '#bdb2f5', marginTop: 26, maxWidth: 900 }}>
                    Fifteen AI/ML demos running entirely in your browser. Nothing uploaded, nothing faked.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: 48 }}>
                    {CHIPS.map(([label, color]) => (
                        <div
                            key={label}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 22px',
                                fontSize: 24,
                                color: '#e8e8f2',
                                border: '1px solid rgba(255,255,255,0.14)',
                                borderRadius: 999,
                            }}
                        >
                            <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 999, background: color }} />
                            {label}
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', marginTop: 56, fontSize: 26, color: '#8888a0' }}>
                    {siteConfig.name} · {siteConfig.siteUrl.replace('https://', '')}/demos
                </div>
            </div>
        ),
        { ...size }
    );
}
