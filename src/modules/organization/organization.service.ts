import { store } from '../../database/store.ts';
import { NotFoundError } from '../../lib/errors.ts';
import type { Organization } from '../../types/index.ts';
import type { UpdateOrganizationInput } from '../../validation/organization.schema.ts';

export class OrganizationService {
  public getById(id: string): Organization {
    const org = store.getOrganizationById(id);
    if (!org) {
      throw new NotFoundError('Organization');
    }
    return org;
  }

  public update(id: string, input: UpdateOrganizationInput, actorUserId: string): Organization {
    return store.updateOrganization(id, input, actorUserId);
  }

  public getDashboardOverview(organizationId: string) {
    return store.getDashboardOverview(organizationId);
  }

  public getAuditLogs(organizationId: string) {
    return store.getAuditLogsByOrganization(organizationId);
  }
}

export const organizationService = new OrganizationService();
