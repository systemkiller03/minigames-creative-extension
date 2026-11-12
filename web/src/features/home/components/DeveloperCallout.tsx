import illustration from '@/assets/home/illustration-side.png';
import { getButtonClassName } from '@/shared/components/Button';
import { Icon } from '@/shared/components/Icon';

export function DeveloperCallout() {
    return (
        <section
            aria-labelledby="developer-title"
            className="mx-auto flex w-full max-w-featured flex-col items-center gap-size-3 px-size-2 py-size-5 text-on-primary desktop-up:flex-row desktop-up:gap-size-5 desktop-up:px-size-15"
        >
            <img
                alt="A game developer working at a computer"
                className="h-auto w-full -rotate-[0.24deg] rounded-extra-large object-cover desktop-up:w-[680px] desktop-up:shrink-0"
                height="517"
                loading="lazy"
                src={illustration}
                width="719"
            />
            <div className="flex w-full flex-col items-start gap-size-3 rounded-extra-large border-2 border-solid border-on-primary bg-white p-size-3 shadow-[0_2px_4px_rgba(0,0,0,0.04),0_14px_15px_rgba(0,0,0,0.08)] desktop-up:min-w-0 desktop-up:flex-1 desktop-up:p-size-5">
                <h2
                    className="text-headline-small font-bold leading-[1.2] text-on-primary tablet-up:text-headline-medium desktop-up:text-headline-large"
                    id="developer-title"
                >
                    Are You a Game Developer?
                </h2>
                <p className="max-w-developer-copy text-body-small leading-normal text-on-bg tablet-up:text-body-medium desktop-up:text-body-large">
                    Want to see your game on MiniGames? We&apos;re always looking for fun, engaging
                    mini games to add to our platform. Submit your game and reach thousands of
                    players!
                </p>
                <a
                    className={getButtonClassName(
                        'primary',
                        'lg',
                        'gap-size-1 shadow-[0_10px_10px_rgba(0,0,0,0.1)] mobile:px-button-medium-x mobile:py-button-small-y mobile:text-label-large',
                    )}
                    href="mailto:developers@minigames.com?subject=Game%20submission"
                >
                    <Icon className="text-[24px] mobile:text-[16px]" name="upload" />
                    Submit Form
                </a>
                <p className="text-body-small text-on-bg-low">
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
