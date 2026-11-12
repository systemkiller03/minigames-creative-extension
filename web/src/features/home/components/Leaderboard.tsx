import { useQuery } from '@tanstack/react-query';
import { getLeaderboardPlayers, type LeaderboardPlayer } from '../api/home.api';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { SectionHeading } from './SectionHeading';

const AVATAR_COLORS = [
    'bg-avatar-random-2',
    'bg-avatar-random-4',
    'bg-avatar-random-3',
    'bg-avatar-random-1',
    'bg-avatar-random-5',
];

function getInitials(name: string): string {
    const words = name.split(/[_\s-]+/u).filter(Boolean);
    return (
        words
            .slice(0, 2)
            .map((word) => word[0]?.toUpperCase() ?? '')
            .join('') || 'PL'
    );
}

function getAvatarColor(name: string): string {
    const hash = [...name].reduce((total, character) => total + (character.codePointAt(0) ?? 0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? 'bg-avatar-random-1';
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

function PlayerRows({ players }: { players: LeaderboardPlayer[] }) {
    return (
        <tbody>
            {players.map((player) => (
                <tr className="bg-white even:bg-bg" key={`${player.rank}-${player.playerName}`}>
                    <td className="w-size-8 px-size-1 py-size-2 text-center font-bold tablet:px-size-05 mobile:text-label-medium">
                        #{player.rank}
                    </td>
                    <td className="px-size-1 py-size-2 font-bold tablet:w-2/5 tablet:px-size-05">
                        <div className="flex items-center gap-size-1">
                            <span
                                aria-hidden="true"
                                className={`grid size-icon-button-medium shrink-0 place-items-center rounded-full border-button-thin border-on-primary text-label-large font-bold text-on-primary mobile:size-icon-small mobile:text-label-small ${getAvatarColor(player.playerName)}`}
                            >
                                {getInitials(player.playerName)}
                            </span>
                            <span className="truncate">{player.playerName}</span>
                        </div>
                    </td>
                    <td className="px-size-1 py-size-2 text-center tablet:hidden">
                        {formatNumber(player.gamesPlayed)}
                    </td>
                    <td className="whitespace-nowrap px-size-1 py-size-2 text-center mobile:text-label-medium">
                        {formatNumber(player.totalScore)}
                    </td>
                    <td className="whitespace-nowrap px-size-1 py-size-2 text-center mobile:text-label-medium">
                        {player.streakDays} day{player.streakDays === 1 ? '' : 's'}
                    </td>
                    <td className="px-size-1 py-size-2 text-center desktop:hidden">
                        <span className="inline-block max-w-full truncate rounded-full border-button-thin border-on-primary px-size-1 py-size-05">
                            {player.favoriteGameName || 'N/A'}
                        </span>
                    </td>
                </tr>
            ))}
        </tbody>
    );
}

export function Leaderboard() {
    const {
        data: players,
        isError,
        isPending,
        refetch,
    } = useQuery({
        queryKey: ['home', 'leaderboard'],
        queryFn: ({ signal }) => getLeaderboardPlayers(signal),
    });

    return (
        <section
            aria-labelledby="leaderboard-title"
            className="bg-bg px-size-1 py-home-section-y-compact tablet:px-size-5 tablet:py-size-4 desktop-up:px-size-15 desktop-up:py-home-section-y"
        >
            <div className="mx-auto max-w-content">
                <SectionHeading id="leaderboard-title">Top Players This Week</SectionHeading>
                <div className="mt-size-4 overflow-x-auto rounded-large border-button border-on-primary bg-white shadow-level-2 mobile:mt-size-4 mobile:shadow-hard">
                    {isPending ? (
                        <LoadingState label="Loading leaderboard..." />
                    ) : isError ? (
                        <ErrorState
                            message="The leaderboard could not be loaded."
                            onRetry={() => void refetch()}
                        />
                    ) : players.length === 0 ? (
                        <EmptyState message="The leaderboard is empty right now. Please check back later." />
                    ) : (
                        <table className="w-full table-fixed border-collapse text-label-large text-on-primary tablet:text-label-medium">
                            <caption className="sr-only">
                                Top players ranked by weekly score
                            </caption>
                            <thead>
                                <tr className="bg-tertiary text-white">
                                    <th className="px-size-1 py-size-2 text-center font-bold uppercase">
                                        Rank
                                    </th>
                                    <th className="px-size-1 py-size-2 text-left font-bold uppercase">
                                        Player
                                    </th>
                                    <th className="px-size-1 py-size-2 text-center font-bold uppercase tablet:hidden">
                                        Games Played
                                    </th>
                                    <th className="px-size-1 py-size-2 text-center font-bold uppercase">
                                        Total Score
                                    </th>
                                    <th className="px-size-1 py-size-2 text-center font-bold uppercase">
                                        Streak
                                    </th>
                                    <th className="px-size-1 py-size-2 text-center font-bold uppercase desktop:hidden">
                                        Favorite Game
                                    </th>
                                </tr>
                            </thead>
                            <PlayerRows players={players} />
                        </table>
                    )}
                </div>
            </div>
        </section>
    );
}
