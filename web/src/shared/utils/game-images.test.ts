import { describe, expect, it } from 'vitest';
import { getGameCardImage, getGameHeroImage } from './game-images';

describe('game images', () => {
  it('resolves a known card image', () => {
    expect(getGameCardImage('cast-n-chill')).toContain('cast-n-chill-card');
  });
  it('returns undefined for unknown slugs', () => {
    expect(getGameCardImage('unknown')).toBeUndefined();
    expect(getGameHeroImage('unknown')).toBeUndefined();
  });
  it('resolves hero image', () => {
    expect(getGameHeroImage('cast-n-chill')).toContain('cast-n-chill-hero');
  });
});
