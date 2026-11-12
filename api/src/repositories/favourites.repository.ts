import { pool } from '@/providers/db';

export class FavouritesRepository {
  /** True when the row was newly inserted. */
  async add(userId: string, slug: string) {
    const { rowCount } = await pool.query(
      `INSERT INTO favourites (user_id, game_slug) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, slug],
    );
    return rowCount === 1;
  }

  /** True when a row was actually removed. */
  async remove(userId: string, slug: string) {
    const { rowCount } = await pool.query(
      `DELETE FROM favourites WHERE user_id = $1 AND game_slug = $2`,
      [userId, slug],
    );
    return rowCount === 1;
  }

  async has(userId: string, slug: string) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM favourites WHERE user_id = $1 AND game_slug = $2`,
      [userId, slug],
    );
    return rowCount === 1;
  }

  /** Slugs, newest first. */
  async slugsFor(userId: string): Promise<string[]> {
    const { rows } = await pool.query<{ slug: string }>(
      `SELECT game_slug AS slug FROM favourites WHERE user_id = $1
       ORDER BY created_at DESC, game_slug`,
      [userId],
    );
    return rows.map((row) => row.slug);
  }
}

export const favouritesRepository = new FavouritesRepository();
