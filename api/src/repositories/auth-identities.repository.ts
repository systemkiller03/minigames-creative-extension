import { ConflictException } from '@/errors/http-exceptions';
import { pool } from '@/providers/db';
import { USER_COLUMNS, type User } from '@/repositories/users.repository';

export type GoogleProfile = {
  subject: string;
  email: string;
  name: string;
};

export class AuthIdentitiesRepository {
  async findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingIdentity = await client.query<{ userId: string }>(
        `SELECT user_id AS "userId"
         FROM auth_identities
         WHERE provider = 'google' AND provider_user_id = $1
         FOR UPDATE`,
        [profile.subject],
      );

      if (existingIdentity.rows[0]) {
        const { rows } = await client.query<User>(
          `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
          [existingIdentity.rows[0].userId],
        );
        if (!rows[0]) throw new Error('Google identity references a missing user');
        await client.query('COMMIT');
        return rows[0];
      }

      const { rows: userRows } = await client.query<User>(
        // Google proved ownership of this email. If it matches a password account that was
        // never verified, that password may belong to an impostor, so it is removed.
        `INSERT INTO users (email, name, password_hash, email_verified_at)
         VALUES ($1, $2, NULL, now())
         ON CONFLICT (email) DO UPDATE SET
           password_hash = CASE WHEN users.email_verified_at IS NULL
                                THEN NULL ELSE users.password_hash END,
           email_verified_at = COALESCE(users.email_verified_at, now())
         RETURNING ${USER_COLUMNS}`,
        [profile.email, profile.name],
      );
      const user = userRows[0];
      if (!user) throw new Error('Unable to create or locate Google user');

      await client.query(
        `INSERT INTO auth_identities (user_id, provider, provider_user_id)
         VALUES ($1, 'google', $2)
         ON CONFLICT DO NOTHING`,
        [user.id, profile.subject],
      );

      const { rows: linkedIdentities } = await client.query<{
        userId: string;
        providerUserId: string;
      }>(
        `SELECT user_id AS "userId", provider_user_id AS "providerUserId"
         FROM auth_identities
         WHERE provider = 'google'
           AND (provider_user_id = $1 OR user_id = $2)
         FOR UPDATE`,
        [profile.subject, user.id],
      );

      if (
        linkedIdentities.length !== 1 ||
        linkedIdentities[0]?.userId !== user.id ||
        linkedIdentities[0]?.providerUserId !== profile.subject
      ) {
        throw new ConflictException('Google account is already linked to another user');
      }

      await client.query('COMMIT');
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const authIdentitiesRepository = new AuthIdentitiesRepository();
