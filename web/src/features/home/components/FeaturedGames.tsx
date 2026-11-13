import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getFeaturedGames } from '../api/home.api';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { Icon } from '@/shared/components/Icon';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { SectionHeading } from './SectionHeading';

const AUTOPLAY_INTERVAL = 4000;
const MAX_VISIBLE_CARDS = 5;

type CarouselSlot = 'peek' | 'side' | 'featured';

function getSlot(index: number, count: number): CarouselSlot {
    if (count < MAX_VISIBLE_CARDS) {
        return index === Math.floor(count / 2) ? 'featured' : 'side';
    }

    if (index === 0 || index === count - 1) {
        return 'peek';
    }

    return index === Math.floor(count / 2) ? 'featured' : 'side';
}

function getSlotClasses(slot: CarouselSlot): string {
    switch (slot) {
        case 'peek':
            return 'carousel-card-peek mobile:carousel-card-peek-mobile tablet-up:carousel-card-peek-tablet desktop-up:carousel-card-peek-wide';
        case 'side':
            return 'carousel-card-side mobile:carousel-card-peek-mobile tablet-up:carousel-card-side-tablet desktop-up:carousel-card-side-wide';
        case 'featured':
            return 'carousel-card-featured mobile:carousel-card-featured-mobile tablet-up:carousel-card-featured-tablet desktop-up:carousel-card-featured-wide';
    }
}

type CardPosition = { visible: boolean; slot: CarouselSlot; order: number };

/**
 * Every game stays mounted so flex-basis/opacity can transition between slots.
 * `order` keeps cards leaving on the left in front and entering on the right behind,
 * so they shrink and grow in place instead of jumping across the track.
 */
function getCardPosition(index: number, current: number, count: number): CardPosition {
    const visibleCount = Math.min(count, MAX_VISIBLE_CARDS);
    const position = (index - current + Math.floor(visibleCount / 2) + count) % count;

    if (position < visibleCount) {
        return { visible: true, slot: getSlot(position, visibleCount), order: position };
    }

    return { visible: false, slot: 'peek', order: position === count - 1 ? -1 : position };
}

export function FeaturedGames() {
    const {
        data: games,
        isError,
        isPending,
        refetch,
    } = useQuery({
        queryKey: ['games', 'featured'],
        queryFn: ({ signal }) => getFeaturedGames(signal),
    });
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isDocumentVisible, setIsDocumentVisible] = useState(true);
    const pointerStart = useRef<{ x: number; y: number } | null>(null);
    const suppressClick = useRef(false);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const updateVisibility = (): void => setIsDocumentVisible(!document.hidden);
        document.addEventListener('visibilitychange', updateVisibility);
        updateVisibility();

        return () => document.removeEventListener('visibilitychange', updateVisibility);
    }, []);

    useEffect(() => {
        if (!games?.length || games.length < 2 || isPaused || !isDocumentVisible) {
            return;
        }

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const timer = window.setInterval(() => {
            setCurrentIndex((index) => (index + 1) % games.length);
        }, AUTOPLAY_INTERVAL);

        return () => window.clearInterval(timer);
    }, [games, isDocumentVisible, isPaused]);

    if (isPending) {
        return (
            <section
                aria-labelledby="featured-games-title"
                className="bg-bg px-size-2 py-size-5 desktop:px-size-5 desktop-up:px-size-15 desktop-up:py-size-5"
            >
                <header className="mb-size-2 flex items-center justify-between desktop:mx-size-5 desktop-up:mx-0 desktop-up:mb-size-5">
                    <SectionHeading id="featured-games-title">New Games</SectionHeading>
                </header>
                <LoadingState label="Loading featured games..." />
            </section>
        );
    }

    if (isError) {
        return (
            <section
                aria-labelledby="featured-games-title"
                className="bg-bg px-size-2 py-size-5 desktop:px-size-5 desktop-up:px-size-15 desktop-up:py-size-5"
            >
                <SectionHeading id="featured-games-title">New Games</SectionHeading>
                <div className="mx-auto mt-size-3 w-full max-w-content rounded-large border-button-thin border-outline-variant bg-white p-size-3 text-center shadow-[4px_4px_0_var(--color-on-primary)]">
                    <ErrorState
                        message="Featured games could not be loaded."
                        onRetry={() => void refetch()}
                    />
                </div>
            </section>
        );
    }

    if (!games.length) {
        return (
            <section
                aria-labelledby="featured-games-title"
                className="bg-bg px-size-2 py-size-5 desktop:px-size-5 desktop-up:px-size-15 desktop-up:py-size-5"
            >
                <SectionHeading id="featured-games-title">New Games</SectionHeading>
                <div className="mx-auto mt-size-3 w-full max-w-content rounded-large border-button-thin border-outline-variant bg-white p-size-3 text-center shadow-[4px_4px_0_var(--color-on-primary)]">
                    <EmptyState message="No featured games found. Check back later for new recommendations." />
                </div>
            </section>
        );
    }

    const move = (direction: 1 | -1): void => {
        setCurrentIndex((index) => (index + direction + games.length) % games.length);
    };

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
        const start = pointerStart.current;
        pointerStart.current = null;
        if (!start) {
            return;
        }

        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) {
            return;
        }

        suppressClick.current = true;
        window.setTimeout(() => {
            suppressClick.current = false;
        }, 500);
        move(deltaX < 0 ? 1 : -1);
    };

    const handleCardClick = (event: MouseEvent<HTMLAnchorElement>): void => {
        if (suppressClick.current) {
            event.preventDefault();
        }
    };

    return (
        <section
            aria-labelledby="featured-games-title"
            className="overflow-hidden bg-bg py-size-2 desktop:pt-size-4 tablet-up:py-size-3 desktop-up:px-size-15 desktop-up:py-size-5"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsPaused(false);
                }
            }}
            onFocus={() => setIsPaused(true)}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <header className="mb-size-2 flex items-center justify-between px-size-2 desktop:mx-size-5 desktop:px-0 tablet-up:mb-size-3 desktop-up:mx-0 desktop-up:mb-size-5">
                <SectionHeading id="featured-games-title">New Games</SectionHeading>
                {games.length > 1 ? (
                    <div className="flex items-center gap-size-1 tablet-up:gap-size-2">
                        <Button
                            aria-label="Previous games"
                            className="size-icon-button-medium rounded-full bg-white p-0"
                            onClick={() => move(-1)}
                            size="sm"
                            variant="outline"
                        >
                            <Icon className="text-[18px]" name="arrow_back" />
                        </Button>
                        <Button
                            aria-label="Next games"
                            className="size-icon-button-medium rounded-full p-0"
                            onClick={() => move(1)}
                            size="sm"
                        >
                            <Icon className="text-[18px]" name="arrow_forward" />
                        </Button>
                    </div>
                ) : null}
            </header>
            <div
                aria-label="Featured games"
                aria-roledescription="carousel"
                className="flex cursor-grab touch-pan-y select-none items-stretch justify-center active:cursor-grabbing"
                role="group"
                onPointerDown={(event) => {
                    if (event.isPrimary && (event.pointerType !== 'mouse' || event.button === 0)) {
                        pointerStart.current = { x: event.clientX, y: event.clientY };
                        if (event.target instanceof HTMLElement) {
                            event.target.setPointerCapture(event.pointerId);
                        }
                    }
                }}
                onPointerCancel={() => {
                    pointerStart.current = null;
                }}
                onPointerUp={handlePointerUp}
            >
                {games.map((game, index) => {
                    const { visible, slot, order } = getCardPosition(
                        index,
                        currentIndex,
                        games.length,
                    );
                    const isFeatured = visible && slot === 'featured';

                    return (
                        <Link
                            aria-current={isFeatured ? 'true' : undefined}
                            aria-hidden={visible ? undefined : true}
                            aria-label={`View ${game.name} details in the library`}
                            className={`relative flex h-carousel-card-height shrink-0 overflow-hidden rounded-large bg-white transition-carousel-card duration-700 ease-in-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-tertiary tablet-up:h-carousel-card-height-tablet desktop-up:h-carousel-card-height-wide desktop-up:rounded-extra-large ${
                                visible
                                    ? `mx-[4px] border-[2.5px] border-solid border-on-primary shadow-[4px_4px_0_var(--color-on-primary)] ${getSlotClasses(slot)}`
                                    : 'pointer-events-none mx-0 basis-0 border-0 opacity-0'
                            }`}
                            draggable={false}
                            key={game.slug}
                            onClick={handleCardClick}
                            search={{ game: game.slug }}
                            style={{ order }}
                            tabIndex={visible ? undefined : -1}
                            to="/library"
                        >
                            <img
                                alt=""
                                aria-hidden="true"
                                className="h-full w-full object-cover"
                                draggable={false}
                                height="384"
                                loading={visible ? 'eager' : 'lazy'}
                                src={game.cardImage}
                                width="816"
                            />
                            {isFeatured ? (
                                <span className="absolute inset-x-0 bottom-0 flex flex-col gap-size-1 bg-gradient-to-t from-bg-footer/95 via-bg-footer/60 to-transparent px-size-2 pb-size-2 pt-size-5 text-left text-white tablet-up:px-size-3 tablet-up:pb-size-3">
                                    <span className="truncate text-body-medium font-bold">
                                        {game.name}
                                    </span>
                                    <span className="flex items-center justify-between gap-size-2 text-body-small">
                                        <span className="text-primary">
                                            <span className="sr-only">Rating </span>★{' '}
                                            {game.rating.toFixed(1)}
                                        </span>
                                        <span>
                                            <span className="sr-only">Likes </span>♥{' '}
                                            {game.likesCount.toLocaleString()}
                                        </span>
                                    </span>
                                </span>
                            ) : null}
                        </Link>
                    );
                })}
            </div>

            {games.length > 1 ? (
                <nav
                    aria-label="Choose featured game"
                    className="mt-size-2 flex justify-center gap-size-1 desktop-up:hidden"
                >
                    {games.map((game, index) => (
                        <button
                            aria-label={`Show ${game.name} in center`}
                            aria-pressed={index === currentIndex}
                            className={`h-size-1 rounded-full transition-all duration-fast ${index === currentIndex ? 'w-size-3 bg-primary' : 'w-size-1 bg-outline-variant'}`}
                            key={game.slug}
                            onClick={() => setCurrentIndex(index)}
                            type="button"
                        />
                    ))}
                </nav>
            ) : null}
        </section>
    );
}
