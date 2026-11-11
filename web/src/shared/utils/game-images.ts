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
