import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useFavourite } from '@/features/favourites/useFavourite';
import { getGameDetails, type Game, type GameDetails } from '@/shared/api/games.api';
import { ApiError } from '@/shared/api/client';
import { Icon } from '@/shared/components/Icon';
import { Modal } from '@/shared/components/Modal';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { formatCount, formatRelativeTime } from '@/shared/utils/format';
import { getGameHeroImage } from '@/shared/utils/game-images';

const MEDALS = ['🥇', '🥈', '🥉'] as const;

function Specs({ specs }: { specs: NonNullable<GameDetails['specs']> }) {
    const items = [
        ['Genre', specs.genre],
        ['Players', specs.players],
        ['Duration', specs.duration],
        ['Price', specs.price],
    ] as const;

    return (
        <dl className="grid grid-cols-2 gap-size-2 above-mobile:grid-cols-4">
            {items.map(([label, value]) => (
                <div
                    className="flex min-w-0 flex-col gap-size-1 rounded-small border border-solid border-outline-variant bg-white px-size-2 py-size-1 shadow-[3px_3px_0_var(--color-on-primary)]"
                    key={label}
                >
                    <dt className="text-label-medium font-normal leading-normal text-on-bg">
                        {label}
                    </dt>
                    <dd className="truncate text-label-large font-bold leading-normal text-on-primary">
                        {value ?? '—'}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function DialogBody({ slug, fallbackDescription }: { slug: string; fallbackDescription?: string }) {
    const snackbar = useSnackbar();
    const { toggle, isPending } = useFavourite();
    const query = useQuery({
        queryKey: ['games', 'details', slug],
        queryFn: ({ signal }) => getGameDetails(slug, signal),
        retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
    });

    if (query.isPending) {
        return <LoadingState label="Loading game..." />;
    }

    if (query.isError) {
        const notFound = query.error instanceof ApiError && query.error.status === 404;
        return (
            <div className="p-size-3">
                <ErrorState
                    message={
                        notFound
                            ? 'We couldn’t find that game.'
                            : 'We couldn’t load this game. Please try again.'
                    }
                    {...(notFound ? {} : { onRetry: () => void query.refetch() })}
                />
            </div>
        );
    }

    const game = query.data;
    const isFavorited = game.isLikedByCurrentUser === true;
    const description = game.fullDescription ?? fallbackDescription;
    const records = game.topRecords ?? [];
    const hero = getGameHeroImage(game.slug);

    return (
        <>
            <div className="relative h-[220px] shrink-0 overflow-hidden bg-outline">
                {hero ? (
                    <img
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                        height="220"
                        src={hero}
                        width="600"
                    />
                ) : null}
            </div>
            <div className="flex flex-col gap-size-3 p-size-3">
                <div className="flex flex-col gap-size-1">
                    <h2
                        className="text-display-medium font-bold leading-normal text-on-primary"
                        id="game-dialog-title"
                    >
                        {game.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-size-2 text-label-large font-bold text-on-primary">
                        <span className="inline-flex items-center gap-size-05">
                            <Icon className="text-[24px] text-primary-high" filled name="star" />
                            <span className="sr-only">Rated </span>
                            {game.rating.toFixed(1)}
                        </span>
                        <span className="inline-flex items-center gap-size-05">
                            <Icon
                                className="text-[24px] text-like"
                                filled={isFavorited}
                                name="favorite"
                            />
                            <span className="sr-only">Likes </span>
                            {formatCount(game.likesCount)}
                        </span>
                    </div>
                </div>

                {description ? (
                    <p className="text-body-medium font-normal leading-[20px] text-on-bg">
                        {description}
                    </p>
                ) : null}

                {game.specs ? <Specs specs={game.specs} /> : null}

                <div className="flex gap-size-2">
                    <button
                        className="flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-medium border-2 border-solid border-on-primary bg-primary px-size-3 text-label-large font-bold text-on-primary shadow-hard transition-colors duration-fast ease-fast hover:bg-primary-high focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring"
                        onClick={() => snackbar.info('Playing in the browser is coming soon.')}
                        type="button"
                    >
                        Play Now
                    </button>
                    <button
                        aria-label={isFavorited ? 'Remove from favourites' : 'Add to favourites'}
                        aria-pressed={isFavorited}
                        className="flex size-12 shrink-0 cursor-pointer items-center justify-center gap-size-1 rounded-medium border border-solid border-outline-variant bg-white text-label-large font-bold text-on-primary shadow-hard transition-colors duration-fast ease-fast hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring disabled:cursor-wait above-mobile:size-auto above-mobile:min-w-0 above-mobile:flex-1"
                        disabled={isPending}
                        onClick={() => toggle(game.slug, isFavorited)}
                        type="button"
                    >
                        <Icon
                            className="text-[24px] text-like"
                            filled={isFavorited}
                            name="favorite"
                        />
                        <span className="hidden above-mobile:inline">
                            {isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                        </span>
                    </button>
                </div>

                {records.length > 0 ? (
                    <section
                        aria-labelledby="game-records-title"
                        className="flex flex-col gap-size-2"
                    >
                        <h3
                            className="flex items-center gap-size-1 text-body-medium font-bold leading-normal text-on-primary"
                            id="game-records-title"
                        >
                            <span aria-hidden="true" className="text-[18px] font-normal">
                                🏆
                            </span>
                            Top Records
                        </h3>
                        <ol className="flex list-none flex-col gap-size-1">
                            {records.map((record) => (
                                <li
                                    className="flex items-center justify-between gap-size-1 rounded-small bg-white p-size-2"
                                    key={record.position}
                                >
                                    <span className="flex min-w-0 items-center gap-size-1 text-on-primary">
                                        <span aria-hidden="true" className="text-[16px]">
                                            {MEDALS[record.position - 1] ?? `#${record.position}`}
                                        </span>
                                        <span className="sr-only">Rank {record.position}: </span>
                                        <span className="truncate text-label-large font-bold">
                                            {record.playerName}
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-size-1">
                                        <span className="text-label-large font-bold text-on-primary">
                                            {record.score.toLocaleString('en-US')} pts
                                        </span>
                                        <span className="text-label-medium font-normal text-on-bg">
                                            {formatRelativeTime(record.achievedAt)}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </section>
                ) : null}
            </div>
        </>
    );
}

export function GameDetailDialog({ slug }: { slug: string }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const closeRef = useRef<HTMLButtonElement>(null);

    const close = (): void => {
        void navigate({ to: '.', search: (previous) => ({ ...previous, game: undefined }) });
    };

    const fallbackDescription = queryClient
        .getQueriesData<{ games?: Game[] } | Game[]>({ queryKey: ['games'] })
        .flatMap(([, data]) => (Array.isArray(data) ? data : (data?.games ?? [])))
        .find((game) => game.slug === slug)?.shortDescription;

    return (
        <Modal
            className="max-w-[600px] overflow-hidden rounded-extra-large border border-solid border-outline-variant bg-bg shadow-[8px_8px_0_#111]"
            initialFocusRef={closeRef}
            labelledBy="game-dialog-title"
            onClose={close}
        >
            <DialogBody {...(fallbackDescription ? { fallbackDescription } : {})} slug={slug} />
            <button
                aria-label="Close"
                className="absolute right-size-2 top-size-2 flex size-size-4 cursor-pointer items-center justify-center rounded-full border-2 border-solid border-on-primary bg-white text-on-primary drop-shadow-[2px_2px_0_#111] focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring above-mobile:size-10"
                onClick={close}
                ref={closeRef}
                type="button"
            >
                <Icon className="text-[20px]" name="close" />
            </button>
        </Modal>
    );
}
