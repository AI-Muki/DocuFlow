import { describe, it, expect } from 'vitest';
import { authService } from '../../src/modules/auth/auth.service.ts';
import { store } from '../../src/database/store.ts';

describe('Authentication Service', () => {
  it('should authenticate demo administrator credentials successfully', async () => {
    const session = await authService.login({
      email: 'admin@demo.local',
      password: 'Password123!',
    });

    expect(session.user).toBeDefined();
    expect(session.user.email).toBe('admin@demo.local');
    expect(session.token).toBeDefined();
    expect(session.organization).toBeDefined();
    expect(session.organization?.slug).toBe('demo-corp');
  });

  it('should reject invalid password with unauthorized error', async () => {
    await expect(
      authService.login({
        email: 'admin@demo.local',
        password: 'WrongPassword!',
      })
    ).rejects.toThrow('Invalid email or password');
  });

  it('should register a new user and return a token ready for onboarding', async () => {
    const testEmail = `newuser-${Date.now()}@example.com`;
    const session = await authService.register({
      email: testEmail,
      password: 'SecurePassword123!',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(session.user.email).toBe(testEmail);
    expect(session.user.organizationId).toBeNull();
    expect(session.token).toBeDefined();

    // Verify user is in the database store
    const stored = store.findUserById(session.user.id);
    expect(stored).toBeDefined();
    expect(stored?.firstName).toBe('Jane');
  });
});
