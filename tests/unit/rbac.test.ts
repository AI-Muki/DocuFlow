import { describe, it, expect } from 'vitest';
import { rbacService } from '../../src/modules/rbac/rbac.service.ts';
import { store } from '../../src/database/store.ts';

describe('RBAC Foundation', () => {
  it('should grant ORG_ADMIN full management permissions', () => {
    const adminUser = store.findUserByEmail('admin@demo.local')!;
    expect(adminUser).toBeDefined();

    expect(rbacService.hasPermission(adminUser, 'organization.manage')).toBe(true);
    expect(rbacService.hasPermission(adminUser, 'users.manage')).toBe(true);
    expect(rbacService.hasPermission(adminUser, 'departments.manage')).toBe(true);
    expect(rbacService.hasPermission(adminUser, 'documents.read')).toBe(true);
    expect(rbacService.hasPermission(adminUser, 'audit.read')).toBe(true);
  });

  it('should restrict EMPLOYEE role from management actions', () => {
    const employeeUser = store.findUserByEmail('employee@demo.local')!;
    expect(employeeUser).toBeDefined();

    expect(rbacService.hasPermission(employeeUser, 'documents.read')).toBe(true);
    expect(rbacService.hasPermission(employeeUser, 'users.read')).toBe(true);

    // Forbidden actions
    expect(rbacService.hasPermission(employeeUser, 'organization.manage')).toBe(false);
    expect(rbacService.hasPermission(employeeUser, 'users.manage')).toBe(false);
    expect(rbacService.hasPermission(employeeUser, 'departments.manage')).toBe(false);
    expect(rbacService.hasPermission(employeeUser, 'audit.read')).toBe(false);
  });

  it('should allow MANAGER role to approve and create documents, but not manage org', () => {
    const managerUser = store.findUserByEmail('manager@demo.local')!;
    expect(managerUser).toBeDefined();

    expect(rbacService.hasPermission(managerUser, 'approvals.approve')).toBe(true);
    expect(rbacService.hasPermission(managerUser, 'documents.create')).toBe(true);
    expect(rbacService.hasPermission(managerUser, 'organization.manage')).toBe(false);
  });
});
