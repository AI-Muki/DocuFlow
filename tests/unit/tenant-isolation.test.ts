import { describe, it, expect } from 'vitest';
import { store } from '../../src/database/store.ts';
import { rbacService } from '../../src/modules/rbac/rbac.service.ts';

describe('Multi-Tenant Isolation', () => {
  it('should isolate departments between different organizations', () => {
    const demoOrgId = 'org-demo-corp-uuid-001';

    // Create a second tenant
    const orgB = store.createOrganization('Beta Technologies', 'beta-tech', 'user-beta-creator');

    // Add private department to Beta Technologies
    const betaDept = store.createDepartment(
      orgB.id,
      { name: 'Quantum R&D', code: 'QRD', description: 'Classified Beta Dept' },
      'user-beta-creator'
    );

    // Query departments for Demo Corporation
    const demoDepts = store.getDepartmentsByOrganization(demoOrgId);
    expect(demoDepts.some((d) => d.name === 'Quantum R&D')).toBe(false);
    expect(demoDepts.some((d) => d.id === betaDept.id)).toBe(false);

    // Query departments for Beta Technologies
    const betaDepts = store.getDepartmentsByOrganization(orgB.id);
    expect(betaDepts.some((d) => d.id === betaDept.id)).toBe(true);
    // Demo corp departments should not be in Beta Tech
    expect(betaDepts.some((d) => d.name === 'Finance')).toBe(false);
  });

  it('should prevent cross-tenant resource access assertion for non-superadmin users', () => {
    const adminUser = store.findUserByEmail('admin@demo.local')!;
    const foreignOrgId = 'org-foreign-tenant-999';

    expect(() => {
      rbacService.assertTenantAccess(adminUser, foreignOrgId);
    }).toThrow(/Tenant Isolation Violation/);
  });

  it('should isolate users between organizations', () => {
    const demoOrgId = 'org-demo-corp-uuid-001';
    const demoUsers = store.getUsersByOrganization(demoOrgId);

    // All demo users must belong only to Demo Corp
    demoUsers.forEach((u) => {
      expect(u.organizationId).toBe(demoOrgId);
    });

    const foreignUsers = store.getUsersByOrganization('org-foreign-tenant-empty');
    expect(foreignUsers.length).toBe(0);
  });
});
