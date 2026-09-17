import { hashPassword } from '../../lib/auth.ts';
import { store } from '../../database/store.ts';
import type { User } from '../../types/index.ts';
import type { CreateUserInput } from '../../validation/organization.schema.ts';

export class UserService {
  public listByOrganization(organizationId: string): User[] {
    return store.getUsersByOrganization(organizationId);
  }

  public async createInOrganization(organizationId: string, input: CreateUserInput, actorUserId: string): Promise<User> {
    const rawPassword = input.password || 'Welcome123!';
    const passwordHash = await hashPassword(rawPassword);

    const user = store.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      organizationId,
      departmentId: input.departmentId,
      roleName: input.roleName,
    });

    store.recordAuditLog(
      organizationId,
      actorUserId,
      'user.invited',
      'User',
      user.id,
      { email: user.email, role: input.roleName, departmentId: input.departmentId }
    );

    return user;
  }
}

export const userService = new UserService();
