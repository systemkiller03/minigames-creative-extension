import { Link } from '@tanstack/react-router';
import logoSource from '@/assets/Logo.svg';

const EXPLORE_LINKS = [
    { label: 'Home', to: '/' },
    { label: 'Library', to: '/library' },
] as const;

export function SiteFooter() {
    return (
        <footer className="bg-bg-footer px-size-2 py-size-4 text-on-bg-footer tablet:px-size-5 tablet:py-size-5 mobile:px-size-2 mobile:py-size-4">
            <div className="mx-auto flex flex-col gap-size-3 desktop-up:flex-row desktop-up:justify-between desktop-up:gap-size-5">
                <section className="flex w-full flex-col gap-size-2 desktop-up:w-1/2">
                    <Link
                        aria-label="MiniGames home"
                        className="inline-flex items-center gap-size-1 self-start font-inter text-headline-small font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-primary"
                        to="/"
                    >
                        <img
                            alt=""
                            className="size-icon-button-small"
                            height="32"
                            src={logoSource}
                            width="32"
                        />
                        <span>MiniGames</span>
                    </Link>
                    <p className="text-body-small leading-relaxed">
                        Take a short break and have fun with a curated collection of casual
                        mini-games.
                    </p>
                </section>

                <nav aria-labelledby="footer-explore-heading" className="flex flex-col gap-size-2">
                    <h2
                        className="text-body-medium font-bold text-white"
                        id="footer-explore-heading"
                    >
                        Explore
                    </h2>
                    <ul className="flex list-none flex-col gap-size-2">
                        {EXPLORE_LINKS.map((item) => (
                            <li key={item.to}>
                                <Link
                                    className="text-body-small transition-colors hover:text-primary"
                                    to={item.to}
                                >
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
            <p className="mt-size-3 border-t border-bg-footer-low pt-size-2 text-label-medium">
                © {new Date().getFullYear()} MiniGames. All rights reserved.
            </p>
        </footer>
    );
}
