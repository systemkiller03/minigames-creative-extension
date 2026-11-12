const cardImageModules = import.meta.glob<string>('/src/assets/games/*-card.jpg', {
  eager: true,
  import: 'default',
});

const cardImages = new Map<string, string>(
  Object.entries(cardImageModules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1).replace(/-card\.jpg$/u, ''),
    url,
  ]),
);

export function getGameCardImage(gameSlug: string): string | undefined {
  return cardImages.get(gameSlug);
}

const heroImageModules = import.meta.glob<string>('/src/assets/games/*-hero.jpg', {
  eager: true,
  import: 'default',
});

const heroImages = new Map<string, string>(
  Object.entries(heroImageModules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1).replace(/-hero\.jpg$/u, ''),
    url,
  ]),
);

/** Hero image for the detail dialog, falling back to the card image. */
export function getGameHeroImage(gameSlug: string): string | undefined {
  return heroImages.get(gameSlug) ?? cardImages.get(gameSlug);
}
