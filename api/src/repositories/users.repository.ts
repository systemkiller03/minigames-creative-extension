import { pool } from '@/providers/db';

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

export const USER_COLUMNS = `
  id, email, name, password_hash AS "passwordHash",
  email_verified_at AS "emailVerifiedAt", created_at AS "createdAt"
`;

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await pool.query<User>(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [
      email,
    ]);
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await pool.query<User>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [
      id,
    ]);
    return rows[0] ?? null;
  }

  /** Creates an unverified user. Returns null when the email is already taken. */
  async insert(input: { email: string; name: string; passwordHash: string }): Promise<User | null> {
    const { rows } = await pool.query<User>(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING ${USER_COLUMNS}`,
      [input.email, input.name, input.passwordHash],
    );
    return rows[0] ?? null;
  }

  /** A successful reset proves mailbox ownership, so it also verifies the email. */
  async updatePasswordHash(id: string, passwordHash: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE users
       SET password_hash = $2,
           email_verified_at = COALESCE(email_verified_at, now()),
           updated_at = now()
       WHERE id = $1`,
      [id, passwordHash],
    );
    return rowCount === 1;
  }

  async markEmailVerified(id: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
       WHERE id = $1`,
      [id],
    );
    return rowCount === 1;
  }
}

export const usersRepository = new UserRepository();
