import type { PermissionKey, SystemRole, User } from '../../types/index.ts';
import { ROLE_DEFAULT_PERMISSIONS } from './permissions.ts';
import { ForbiddenError } from '../../lib/errors.ts';

export class RbacService {
  /**
   * Asserts that a user has a specific permission, throwing ForbiddenError if not.
   */
  public assertPermission(user: User, requiredPermission: PermissionKey): void {
    if (!this.hasPermission(user, requiredPermission)) {
      throw new ForbiddenError(`Permission Denied: Missing ${requiredPermission}`);
    }
  }

  /**
   * Evaluates whether a user has a specific permission.
   * Super Admins automatically inherit all permissions.
   */
  public hasPermission(user: User, requiredPermission: PermissionKey): boolean {
    if (!user || !user.roles) {
      return false;
    }

    // Check if user is SUPER_ADMIN
    const isSuperAdmin = user.roles.some((r) => r.name === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return true;
    }

    // Check direct user permissions
    if (user.permissions && user.permissions.includes(requiredPermission)) {
      return true;
    }

    // Check permissions granted via any assigned role
    return user.roles.some((role) => {
      // Role can carry explicit permissions or default permissions by name
      if (role.permissions && role.permissions.includes(requiredPermission)) {
        return true;
      }
      const defaultRolePerms = ROLE_DEFAULT_PERMISSIONS[role.name as SystemRole];
      return defaultRolePerms && defaultRolePerms.includes(requiredPermission);
    });
  }

  /**
   * Evaluates whether a user has all of the requested permissions.
   */
  public hasAllPermissions(user: User, requiredPermissions: PermissionKey[]): boolean {
    return requiredPermissions.every((perm) => this.hasPermission(user, perm));
  }

  /**
   * Evaluates whether a user has at least one of the requested permissions.
   */
  public hasAnyPermission(user: User, requiredPermissions: PermissionKey[]): boolean {
    return requiredPermissions.some((perm) => this.hasPermission(user, perm));
  }

  /**
   * Enforces server-side tenant boundary check.
   * Throws if user attempts to access a resource belonging to another organization.
   */
  public assertTenantAccess(user: User, targetOrganizationId: string): void {
    const isSuperAdmin = user.roles.some((r) => r.name === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return; // Super admins can cross-inspect for system administration
    }

    if (!user.organizationId || user.organizationId !== targetOrganizationId) {
      throw new Error(`Tenant Isolation Violation: User ${user.id} belonging to org ${user.organizationId} cannot access org ${targetOrganizationId}`);
    }
  }
}

export const rbacService = new RbacService();
