import { describe, it, expect } from 'vitest';
import { authService } from '../../src/modules/auth/auth.service.ts';
import { store } from '../../src/database/store.ts';

describe('Organization Creation & Onboarding', () => {
  it('should onboard a new user into an organization and assign ORG_ADMIN', async () => {
    // 1. Register new user
    const email = `founder-${Date.now()}@acme.inc`;
    const regSession = await authService.register({
      email,
      password: 'SecurePassword123!',
      firstName: 'Sarah',
      lastName: 'Connor',
    });

    // 2. Onboard organization
    const orgName = `Acme Enterprise ${Date.now()}`;
    const slug = `acme-${Date.now()}`;
    const onboardedSession = await authService.createOrganizationForUser(regSession.user.id, {
      name: orgName,
      slug,
      departmentName: 'General',
    });

    expect(onboardedSession.organization).toBeDefined();
    expect(onboardedSession.organization?.name).toBe(orgName);
    expect(onboardedSession.user.organizationId).toBe(onboardedSession.organization?.id);

    // Verify user role is promoted to ORG_ADMIN
    const hasOrgAdminRole = onboardedSession.user.roles.some((r) => r.name === 'ORG_ADMIN');
    expect(hasOrgAdminRole).toBe(true);

    // Verify default department was created for the new organization
    const depts = store.getDepartmentsByOrganization(onboardedSession.organization!.id);
    expect(depts.length).toBeGreaterThanOrEqual(1);
    expect(depts[0].name).toBe('General');
  });
});
