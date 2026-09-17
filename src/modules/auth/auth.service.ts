import { comparePassword, hashPassword, signToken } from '../../lib/auth.ts';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.ts';
import { store } from '../../database/store.ts';
import type { AuthSession, Organization, User } from '../../types/index.ts';
import type { LoginInput, OnboardingOrgInput, RegisterInput } from '../../validation/auth.schema.ts';
import { slugify } from '../../lib/utils.ts';

export class AuthService {
  /**
   * Registers a new user account.
   * New users are ready for the onboarding flow (Create Organization).
   */
  public async register(input: RegisterInput): Promise<AuthSession> {
    const existing = store.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError('An account with this email address already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const user = store.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      roleName: 'EMPLOYEE',
    });

    const token = signToken({
      userId: user.id,
      organizationId: null,
      email: user.email,
      roleNames: user.roles.map((r) => r.name),
    });

    return {
      user,
      organization: null,
      token,
    };
  }

  /**
   * Authenticates user credentials and establishes a session.
   */
  public async login(input: LoginInput, clientIp = '127.0.0.1'): Promise<AuthSession> {
    const userWithHash = store.findUserByEmail(input.email);
    if (!userWithHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (userWithHash.status === 'SUSPENDED') {
      throw new UnauthorizedError('Your account has been suspended. Please contact your organization administrator.');
    }

    const passwordValid = await comparePassword(input.password, userWithHash.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Refresh last login timestamp
    userWithHash.lastLoginAt = new Date().toISOString();

    let organization: Organization | null = null;
    if (userWithHash.organizationId) {
      organization = store.getOrganizationById(userWithHash.organizationId);

      store.recordAuditLog(
        userWithHash.organizationId,
        userWithHash.id,
        'auth.login',
        'User',
        userWithHash.id,
        { email: userWithHash.email },
        clientIp
      );
    }

    const token = signToken({
      userId: userWithHash.id,
      organizationId: userWithHash.organizationId,
      email: userWithHash.email,
      roleNames: userWithHash.roles.map((r) => r.name),
    });

    const { passwordHash, ...safeUser } = userWithHash;

    return {
      user: safeUser,
      organization,
      token,
    };
  }

  /**
   * Completes initial onboarding by creating the user's Organization.
   * Promotes the creator to ORG_ADMIN.
   */
  public async createOrganizationForUser(userId: string, input: OnboardingOrgInput): Promise<AuthSession> {
    const user = store.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const slug = input.slug || slugify(input.name);
    const org = store.createOrganization(input.name, slug, userId);

    const updatedUser = store.findUserById(userId)!;
    const token = signToken({
      userId: updatedUser.id,
      organizationId: org.id,
      email: updatedUser.email,
      roleNames: updatedUser.roles.map((r) => r.name),
    });

    return {
      user: updatedUser,
      organization: org,
      token,
    };
  }

  /**
   * Retrieves the current user profile, permissions, and organization.
   */
  public async getSession(userId: string): Promise<AuthSession> {
    const user = store.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('User session expired or invalid');
    }

    const organization = user.organizationId ? store.getOrganizationById(user.organizationId) : null;
    const token = signToken({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      roleNames: user.roles.map((r) => r.name),
    });

    return {
      user,
      organization,
      token,
    };
  }
}

export const authService = new AuthService();
