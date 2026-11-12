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

    return (
        <article className="flex flex-col overflow-hidden rounded-large border-[2.5px] border-solid border-on-primary bg-white shadow-[4px_4px_0_var(--color-on-primary)] above-tablet:h-[200px] above-tablet:flex-row">
            <div className="h-40 shrink-0 above-mobile:h-auto above-mobile:w-[200px] above-tablet:w-[320px]">
                <img
                    alt=""
                    className="size-full object-cover"
                    height="200"
                    loading="lazy"
                    src={game.cardImage}
                    width="320"
                />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-size-1 p-size-2">
                <div className="flex items-center justify-between gap-size-2">
                    <div className="flex min-w-0 items-center gap-size-2">
                        <h2 className="truncate text-headline-small font-bold leading-normal text-on-primary above-tablet:text-headline-medium">
                            {game.name}
                        </h2>
                        <span className="shrink-0 rounded-extra-large border-button-hover border-solid border-on-primary bg-secondary px-size-1 py-size-05 text-label-medium font-bold leading-normal text-on-primary">
                            {labelFor(game.category)}
                        </span>
                    </div>
                    <span
                        className={`shrink-0 text-headline-small font-bold leading-normal above-tablet:text-headline-medium ${isFree ? 'text-price-free' : 'text-on-primary'}`}
                    >
                        {game.price}
                    </span>
                </div>
                <p className="line-clamp-3 text-body-medium font-medium leading-[1.4] text-on-bg">
                    {game.shortDescription}
                </p>
                <div className="flex items-center justify-between gap-size-2">
                    <div className="flex items-center gap-size-3 text-label-large font-bold text-on-primary">
                        <span className="inline-flex items-center gap-size-05">
                            <Icon className="text-[20px] text-primary-high" filled name="star" />
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
                    <Link
                        className={getButtonClassName('primary', 'md')}
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
