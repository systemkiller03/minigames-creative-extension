import { Link, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import logoSource from '@/assets/Logo.svg';
import { Icon } from '@/shared/components/Icon';

const LINK_CLASS =
    'text-body-small leading-normal text-on-bg-footer transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-primary';

type FooterLinkProps = {
    label: string;
    to?: '/' | '/library';
};

/** Pages that are out of scope still show up, and send the visitor to the home page. */
function FooterLink({ label, to = '/' }: FooterLinkProps) {
    const navigate = useNavigate();

    if (to === '/library') {
        return (
            <Link className={LINK_CLASS} to="/library">
                {label}
            </Link>
        );
    }

    return (
        <a
            className={LINK_CLASS}
            href="/"
            onClick={(event) => {
                event.preventDefault();
                void navigate({ to: '/' });
            }}
        >
            {label}
        </a>
    );
}

function LinkColumn({ title, children }: { title: string; children: ReactNode }) {
    return (
        <nav aria-label={title} className="flex min-w-0 flex-col gap-size-2">
            <h2 className="text-title-xx-small font-bold leading-normal text-white">{title}</h2>
            <ul className="flex list-none flex-col gap-size-2">{children}</ul>
        </nav>
    );
}

function SocialLink({ label, icon }: { label: string; icon: string }) {
    const navigate = useNavigate();

    return (
        <a
            aria-label={label}
            className="inline-flex size-icon-button-small cursor-pointer items-center justify-center rounded-full bg-bg-footer-low text-white transition-colors hover:bg-bg-footer-lowest focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-primary desktop-up:size-icon-button-medium"
            href="/"
            onClick={(event) => {
                event.preventDefault();
                void navigate({ to: '/' });
            }}
        >
            <Icon className="text-[16px] desktop-up:text-[20px]" name={icon} />
        </a>
    );
}

export function SiteFooter() {
    return (
        <footer className="flex flex-col gap-size-3 bg-bg-footer px-size-2 py-size-4 text-on-bg-footer above-mobile:gap-size-5 above-mobile:p-size-5 desktop-up:gap-size-8 desktop-up:px-size-15">
            <div className="flex flex-col gap-size-3 above-tablet:flex-row above-tablet:items-start above-tablet:justify-between">
                <section className="flex flex-col gap-size-3 above-tablet:w-[400px] above-tablet:shrink-0">
                    <Link
                        aria-label="MiniGames home"
                        className="inline-flex items-center gap-size-1 self-start font-inter text-headline-small font-bold text-white above-tablet:text-headline-medium"
                        to="/"
                    >
                        <img alt="" height="32" src={logoSource} width="32" />
                        <span>MiniGames</span>
                    </Link>
                    <p className="text-body-small leading-normal">
                        Take a short break and have fun. Hundreds of curated casual mini-games right
                        in your web browser. No download required.
                    </p>
                </section>

                <div className="flex flex-col gap-size-3 above-mobile:flex-row above-mobile:flex-wrap above-mobile:gap-x-size-5 above-tablet:gap-x-size-10">
                    <div className="grid grid-cols-2 gap-size-5 above-mobile:contents">
                        <LinkColumn title="Explore">
                            <li>
                                <FooterLink label="Home" />
                            </li>
                            <li>
                                <FooterLink label="Library" to="/library" />
                            </li>
                            <li>
                                <FooterLink label="Categories" to="/library" />
                            </li>
                            <li>
                                <FooterLink label="Tournaments" />
                            </li>
                        </LinkColumn>
                        <LinkColumn title="Company">
                            <li>
                                <FooterLink label="About Us" />
                            </li>
                            <li>
                                <FooterLink label="Contact" />
                            </li>
                            <li>
                                <FooterLink label="Privacy Policy" />
                            </li>
                            <li>
                                <FooterLink label="Terms of Service" />
                            </li>
                        </LinkColumn>
                    </div>
                    <div className="flex flex-col gap-size-2">
                        <h2 className="text-title-xx-small font-bold leading-normal text-white">
                            Community
                        </h2>
                        <div className="flex gap-size-2">
                            <SocialLink icon="share" label="Share" />
                            <SocialLink icon="chat" label="Chat" />
                            <SocialLink icon="rss_feed" label="RSS feed" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-size-1 border-t border-bg-footer-lowest pt-size-1 text-label-medium above-mobile:flex-row above-mobile:items-center above-mobile:justify-between above-mobile:gap-size-2 above-mobile:pt-size-2 desktop-up:pt-size-3 above-mobile:text-body-small">
                <p>© 2026 MiniGames. All rights reserved.</p>
                <div className="flex items-center gap-size-2 above-mobile:contents">
                    <a
                        className="inline-flex items-center gap-size-1 hover:text-white"
                        href="https://rs.school"
                        rel="noreferrer noopener"
                        target="_blank"
                    >
                        <span
                            aria-hidden="true"
                            className="inline-flex size-5 items-center justify-center rounded-full bg-on-primary text-[8px] font-bold tracking-[-0.3px] text-primary above-tablet:size-size-3 above-tablet:text-[10px]"
                        >
                            RS
                        </span>
                        RS School
                    </a>
                    <a
                        className="inline-flex items-center gap-size-1 hover:text-white"
                        href="https://github.com"
                        rel="noreferrer noopener"
                        target="_blank"
                    >
                        <span
                            aria-hidden="true"
                            className="inline-flex size-5 items-center justify-center rounded-full bg-white text-on-primary above-tablet:size-size-3"
                        >
                            <Icon className="text-[14px] above-tablet:text-[16px]" name="code" />
                        </span>
                        @student-nickname
                    </a>
                </div>
                <p className="hidden above-mobile:block">Designed with love</p>
            </div>
        </footer>
    );
}
