import { pool } from '@/providers/db';

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  createdAt: Date;
};

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await pool.query<User>(
      `SELECT id, email, name, password_hash AS "passwordHash",
              created_at AS "createdAt"
       FROM users
       WHERE email = $1`,
      [email],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await pool.query<User>(
      `SELECT id, email, name, password_hash AS "passwordHash",
              created_at AS "createdAt"
       FROM users
       WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async insert(input: { email: string; name: string; passwordHash: string }): Promise<User | null> {
    const { rows } = await pool.query<User>(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, name,
                 password_hash AS "passwordHash", created_at AS "createdAt"`,
      [input.email, input.name, input.passwordHash],
    );
    return rows[0] ?? null;
  }
}

export const usersRepository = new UserRepository();
