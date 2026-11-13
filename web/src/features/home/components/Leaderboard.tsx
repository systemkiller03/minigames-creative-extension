import { useQuery } from '@tanstack/react-query';
import { getLeaderboardPlayers, type LeaderboardPlayer } from '../api/home.api';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { formatCount } from '@/shared/utils/format';
import { SectionHeading } from './SectionHeading';

/** Figma: first place is yellow, the rest cycle through the pastel avatar colours. */
const AVATAR_COLORS = [
  'bg-primary',
  'bg-avatar-random-2',
  'bg-avatar-random-3',
  'bg-avatar-random-4',
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

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length] ?? 'bg-avatar-random-1';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

const CELL = 'px-size-1 py-size-2 text-center above-tablet:px-size-3';

function PlayerRows({ players }: { players: LeaderboardPlayer[] }) {
  return (
    <tbody>
      {players.map((player, index) => (
        <tr
          className="border-b border-solid border-outline bg-bg last:border-b-0 even:bg-white"
          key={`${player.rank}-${player.playerName}`}
        >
          <td
            className={`w-[56px] ${CELL} font-extrabold above-mobile:w-[80px] ${player.rank === 1 ? 'text-primary' : ''}`}
          >
            #{player.rank}
          </td>
          <td className="px-size-1 py-size-2 text-left font-bold above-tablet:px-size-3">
            <div className="flex items-center gap-size-1 above-tablet:gap-[12px]">
              <span
                aria-hidden="true"
                className={`grid size-[24px] shrink-0 place-items-center rounded-full border-[1.5px] border-solid border-on-primary text-label-small font-bold text-on-primary above-mobile:size-[28px] above-tablet:size-[40px] above-tablet:text-label-large ${getAvatarColor(index)}`}
              >
                {getInitials(player.playerName)}
              </span>
              <span className="truncate">{player.playerName}</span>
            </div>
          </td>
          <td className={`${CELL} font-semibold mobile:hidden`}>
            {formatNumber(player.gamesPlayed)}
          </td>
          <td className={`whitespace-nowrap ${CELL} font-bold`}>
            <span className="above-mobile:hidden">{formatCount(player.totalScore)}</span>
            <span className="mobile:hidden">{formatNumber(player.totalScore)}</span>
          </td>
          <td className={`whitespace-nowrap ${CELL} font-bold`}>
            <span aria-hidden="true">🔥 </span>
            <span className="above-tablet:hidden">{player.streakDays}d</span>
            <span className="tablet:hidden">
              {player.streakDays} day{player.streakDays === 1 ? '' : 's'}
            </span>
          </td>
          <td className={`${CELL} desktop:hidden`}>
            <span className="inline-block max-w-full truncate rounded-[20px] border-[1.5px] border-solid border-on-primary bg-bg px-[12px] py-[4px] align-middle text-label-medium font-bold">
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
        <div className="mt-size-4 overflow-x-auto rounded-large border-[2.5px] border-solid border-on-primary bg-white shadow-[6px_6px_0_var(--color-on-primary)] mobile:shadow-hard">
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
            <table className="w-full table-fixed border-collapse text-label-large text-on-primary above-tablet:text-body-medium">
              <caption className="sr-only">Top players ranked by weekly score</caption>
              <thead>
                <tr className="border-b-[1.5px] border-solid border-on-primary bg-tertiary text-white">
                  <th className="px-size-1 py-size-2 text-center font-extrabold uppercase above-tablet:p-size-3">
                    Rank
                  </th>
                  <th className="px-size-1 py-size-2 text-center font-extrabold uppercase above-tablet:p-size-3">
                    Player
                  </th>
                  <th className="px-size-1 py-size-2 text-center font-extrabold uppercase above-tablet:p-size-3 mobile:hidden">
                    Games Played
                  </th>
                  <th className="px-size-1 py-size-2 text-center font-extrabold uppercase above-tablet:p-size-3">
                    Total Score
                  </th>
                  <th className="px-size-1 py-size-2 text-center font-extrabold uppercase above-tablet:p-size-3">
                    Streak
                  </th>
                  <th className="px-size-1 py-size-2 text-center font-extrabold uppercase above-tablet:p-size-3 desktop:hidden">
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
