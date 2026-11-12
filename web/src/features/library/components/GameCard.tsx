import { Link } from '@tanstack/react-router';
import { useFavourite } from '@/features/favourites/useFavourite';
import type { Game } from '@/shared/api/games.api';
import { getButtonClassName } from '@/shared/components/Button';
import { Icon } from '@/shared/components/Icon';
import { formatCount } from '@/shared/utils/format';

function labelFor(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
}

export function GameCard({ game }: { game: Game }) {
    const { toggle, isPending } = useFavourite();
    const isFavorited = game.isFavorited === true;
    const isFree = game.price.toLowerCase() === 'free';

    const price = (
        <span
            className={`shrink-0 text-headline-small font-bold leading-normal desktop-up:text-headline-medium ${isFree ? 'text-price-free' : 'text-on-primary'}`}
        >
            {game.price}
        </span>
    );

    return (
        <article className="flex flex-col overflow-hidden rounded-large border-[2.5px] border-solid border-on-primary bg-white shadow-[4px_4px_0_var(--color-on-primary)] min-[600px]:h-[152px] min-[600px]:flex-row desktop-up:h-[200px]">
            <div className="h-40 shrink-0 min-[600px]:h-full min-[600px]:w-[270px] desktop-up:w-[320px]">
                <img
                    alt=""
                    className="size-full object-cover"
                    height="200"
                    loading="lazy"
                    src={game.cardImage}
                    width="320"
                />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-size-2 p-size-2 min-[600px]:justify-between min-[600px]:gap-size-1">
                <div className="flex flex-col gap-size-1 min-[600px]:flex-row min-[600px]:items-center min-[600px]:justify-between min-[600px]:gap-size-2">
                    <div className="flex min-w-0 flex-col items-start gap-size-1 min-[600px]:flex-row min-[600px]:items-center min-[600px]:gap-size-2">
                        <h2 className="text-headline-small font-bold leading-normal text-on-primary min-[600px]:truncate desktop-up:text-headline-medium">
                            {game.name}
                        </h2>
                        <span className="shrink-0 rounded-extra-large border-button-hover border-solid border-on-primary bg-secondary px-size-1 py-[2px] text-label-medium font-bold leading-normal text-on-primary min-[600px]:py-size-05">
                            {labelFor(game.category)}
                        </span>
                    </div>
                    <span className="hidden min-[600px]:inline-flex">{price}</span>
                </div>
                <p className="line-clamp-2 text-body-small font-medium leading-[1.4] text-on-bg desktop-up:line-clamp-3 desktop-up:text-body-medium">
                    {game.shortDescription}
                </p>
                <div className="flex flex-col gap-size-2 min-[600px]:flex-row min-[600px]:items-center min-[600px]:justify-between">
                    <div className="flex items-center justify-between min-[600px]:justify-start">
                        <div className="flex items-center gap-size-2 text-label-medium font-bold text-on-primary desktop-up:gap-size-3 desktop-up:text-label-large">
                            <span className="inline-flex items-center gap-size-05">
                                <Icon
                                    className="text-[20px] text-primary-high"
                                    filled
                                    name="star"
                                />
                                <span className="sr-only">Rated </span>
                                {game.rating.toFixed(1)}
                            </span>
                            <button
                                aria-label={
                                    isFavorited
                                        ? `Remove ${game.name} from favourites`
                                        : `Add ${game.name} to favourites`
                                }
                                aria-pressed={isFavorited}
                                className="inline-flex cursor-pointer items-center gap-size-05 rounded-small font-bold focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring disabled:cursor-wait"
                                disabled={isPending}
                                onClick={() => toggle(game.slug, isFavorited)}
                                type="button"
                            >
                                <Icon
                                    className="text-[20px] text-like"
                                    filled={isFavorited}
                                    name="favorite"
                                />
                                {formatCount(game.likesCount)}
                            </button>
                        </div>
                        <span className="inline-flex min-[600px]:hidden">{price}</span>
                    </div>
                    <Link
                        className={getButtonClassName(
                            'primary',
                            'md',
                            'w-full min-[600px]:w-auto min-[600px]:px-button-small-x min-[600px]:py-button-small-y',
                        )}
                        search={(previous) => ({ ...previous, game: game.slug })}
                        to="/library"
                    >
                        Details
                    </Link>
                </div>
            </div>
        </article>
    );
}
