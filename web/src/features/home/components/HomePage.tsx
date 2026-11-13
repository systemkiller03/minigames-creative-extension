import { DeveloperCallout } from './DeveloperCallout';
import { FeaturedGames } from './FeaturedGames';
import { HeroSection } from './HeroSection';
import { Leaderboard } from './Leaderboard';

export function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedGames />
      <Leaderboard />
      <DeveloperCallout />
    </>
  );
}
