import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import ClientLayout from '@/components/Layout/ClientLayout';
import { siteConfig } from '@/data/siteConfig';
import '@/styles/globals.css';

const bodyFont = Instrument_Sans({
    subsets: ['latin'],
    variable: '--font-body-src',
    display: 'swap',
});

const displayFont = Bricolage_Grotesque({
    subsets: ['latin'],
    variable: '--font-display-src',
    display: 'swap',
});

export const metadata = {
    metadataBase: new URL(siteConfig.siteUrl),
    title: siteConfig.siteTitle,
    description: siteConfig.siteDescription,
    keywords: ['AI', 'ML', 'Machine Learning', 'Deep Learning', 'LLM', 'NLP', 'Computer Vision', 'AI Engineer'],
    authors: [{ name: siteConfig.name }],
    openGraph: {
        title: siteConfig.siteTitle,
        description: siteConfig.siteDescription,
        type: 'website',
        url: siteConfig.siteUrl,
        siteName: siteConfig.name,
    },
};

// Runs before hydration so the saved theme applies without a flash.
// Default is light; visitors keep whatever they last toggled.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t='light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

// Structured data so search engines render a rich result for the person.
const personLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: siteConfig.name,
    jobTitle: siteConfig.title,
    description: siteConfig.siteDescription,
    url: siteConfig.siteUrl,
    email: `mailto:${siteConfig.email}`,
    address: { '@type': 'PostalAddress', addressLocality: siteConfig.location },
    sameAs: [siteConfig.social.github, siteConfig.social.linkedin, siteConfig.social.twitter].filter(Boolean),
    knowsAbout: [
        'Machine Learning', 'Deep Learning', 'Large Language Models', 'Computer Vision',
        'Retrieval-Augmented Generation', 'Natural Language Processing', 'MLOps',
    ],
});

export default function RootLayout({ children }) {
    return (
        <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`} data-theme="light" suppressHydrationWarning>
            <body>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personLd }} />
                {siteConfig.analytics?.goatcounter && (
                    <script data-goatcounter={siteConfig.analytics.goatcounter} async src="https://gc.zgo.at/count.js" />
                )}
                <ClientLayout>{children}</ClientLayout>
            </body>
        </html>
    );
}
