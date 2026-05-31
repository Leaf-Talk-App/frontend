import { describe, expect, it } from 'vitest';
import { loginSchema } from './login-schema';

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '123456',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid email values', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: '123456',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected invalid email to fail validation.');
    }
    expect(result.error.issues[0]?.message).toBe('Please enter a valid email address.');
  });

  it('requires a password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected empty password to fail validation.');
    }
    expect(result.error.issues[0]?.message).toBe('Password is required.');
  });
});
