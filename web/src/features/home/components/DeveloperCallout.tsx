import illustration from '@/assets/home/illustration-side.png';
import { Button } from '@/shared/components/Button';
import { SectionHeading } from './SectionHeading';

export function DeveloperCallout() {
    return (
        <section
            aria-labelledby="developer-title"
            className="mx-auto flex w-full max-w-featured flex-col items-center gap-size-3 px-size-2 py-size-5 text-on-primary desktop-up:flex-row desktop-up:gap-size-5 desktop-up:px-size-15 desktop-up:py-size-5"
        >
            <img
                alt="A game developer working at a computer"
                className="h-auto w-full rounded-extra-large border-button border-on-primary object-cover desktop-up:w-5/12 desktop-up:border-0"
                height="517"
                loading="lazy"
                src={illustration}
                width="719"
            />
            <div className="w-full rounded-extra-large border-button border-on-primary bg-white p-size-3 shadow-level-1 desktop-up:w-7/12 desktop-up:p-size-5">
                <SectionHeading id="developer-title">Are You a Game Developer?</SectionHeading>
                <p className="mb-size-3 mt-size-2 max-w-developer-copy text-body-medium leading-relaxed text-on-bg">
                    Want to see your game on MiniGames? We&apos;re always looking for fun, engaging
                    mini games to add to our platform. Submit your game and reach thousands of
                    players!
                </p>
                <Button size="sm">
                    <span aria-hidden="true">↑</span>
                    Submit Form
                </Button>
                <p className="mt-size-2 text-body-small text-on-bg-low">
                    or contact us at{' '}
                    <a
                        className="underline underline-offset-2"
                        href="mailto:developers@minigames.com"
                    >
                        developers@minigames.com
                    </a>
                </p>
            </div>
        </section>
    );
}
