import {
    Hero,
    About,
    Stats,
    LiveDemosTeaser,
    Skills,
    FeaturedProjects,
    Services,
    HowIWork,
    Testimonials,
    GitHubActivity,
    BeyondCode,
    Contact,
    CTABand,
} from '@/components/sections';

/**
 * Home Page
 * Composes all section components
 */
export default function HomePage() {
    return (
        <>
            <Hero />
            <About />
            <Stats />
            <LiveDemosTeaser />
            <FeaturedProjects />
            <CTABand />
            <Services />
            <HowIWork />
            <Testimonials />
            <Skills />
            <GitHubActivity />
            <BeyondCode />
            <Contact />
        </>
    );
}
