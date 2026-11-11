import { Link } from '@tanstack/react-router';
import heroImage from '@/assets/home/hero-section.png';

export function HeroSection() {
    return (
        <section
            aria-labelledby="hero-title"
            className="relative isolate flex min-h-home-hero-min-height items-center overflow-hidden bg-bg-footer px-size-2 py-size-5 desktop:min-h-home-hero-min-height-tablet desktop:px-size-5 desktop:py-size-2 desktop-up:min-h-home-hero-min-height-wide desktop-up:px-size-15 desktop-up:py-size-14"
        >
            <img
                alt=""
                aria-hidden="true"
                className="absolute inset-0 -z-10 h-full w-full object-cover opacity-20"
                height="620"
                src={heroImage}
                width="1920"
            />
            <div className="mx-auto my-size-8 flex w-full max-w-featured flex-col items-start gap-size-3 rounded-large border-button border-on-primary bg-bg p-size-4 shadow-level-2 desktop:my-0 desktop:max-w-home-hero-copy-narrow desktop:py-size-5 desktop-up:mx-0 desktop-up:max-w-home-hero-copy-wide desktop-up:gap-size-4 desktop-up:rounded-extra-large desktop-up:border-hero-wide desktop-up:p-size-6 desktop-up:shadow-level-3">
                <h1
                    className="max-w-home-hero-title text-headline-medium font-bold leading-tight text-on-primary desktop:text-display-medium desktop-up:text-display-large"
                    id="hero-title"
                >
                    Take a Short Break &amp; Have Fun
                </h1>
                <p className="text-body-small leading-snug text-on-bg tablet-up:text-body-medium desktop-up:text-body-large desktop-up:leading-relaxed">
                    Discover hundreds of curated casual mini-games. Play instantly in your browser —
                    puzzle, match 3, farm, and board classics.
                </p>
                <Link
                    className="inline-flex min-h-touch-target items-center justify-center rounded-small border-button border-black bg-primary px-button-medium-x py-button-medium-y font-bold text-on-primary transition-colors hover:bg-primary-high focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring"
                    to="/library"
                >
                    Browse Library
                </Link>
            </div>
        </section>
    );
}
