import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api/client';
import { errorMessage, fieldError, loginSchema, registerSchema } from './authForm';

describe('schemas', () => {
  it('validates login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'bad', password: '' }).success).toBe(false);
  });
  it('validates register and password confirmation', () => {
    const base = {
      name: 'Ann',
      email: 'a@b.co',
      password: 'password1',
      confirmPassword: 'password1',
    };
    expect(registerSchema.safeParse(base).success).toBe(true);
    const mismatch = registerSchema.safeParse({ ...base, confirmPassword: 'other' });
    expect(mismatch.success).toBe(false);
    expect(
      registerSchema.safeParse({ ...base, password: 'short', confirmPassword: 'short' }).success,
    ).toBe(false);
  });
});

describe('fieldError', () => {
  it('hides errors until shown', () => {
    expect(fieldError(['x'], false)).toBeUndefined();
  });
  it('reads string and object errors', () => {
    expect(fieldError(['x'], true)).toBe('x');
    expect(fieldError([{ message: 'y' }], true)).toBe('y');
    expect(fieldError([null, 3], true)).toBeUndefined();
  });
});

describe('errorMessage', () => {
  it('formats rate limits', () => {
    expect(errorMessage(new ApiError(429, 'X', 'm', [], 30), 'f')).toContain('30 seconds');
    expect(errorMessage(new ApiError(429), 'f')).toContain('later');
  });
  it('shows client errors and falls back otherwise', () => {
    expect(errorMessage(new ApiError(400, 'X', 'Bad'), 'f')).toBe('Bad');
    expect(errorMessage(new ApiError(500), 'f')).toBe('f');
    expect(errorMessage(new Error('x'), 'f')).toBe('f');
  });
});
