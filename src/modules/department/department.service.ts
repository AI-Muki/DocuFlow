import { store } from '../../database/store.ts';
import type { Department } from '../../types/index.ts';
import type { CreateDepartmentInput } from '../../validation/organization.schema.ts';

export class DepartmentService {
  public listByOrganization(organizationId: string): Department[] {
    return store.getDepartmentsByOrganization(organizationId);
  }

  public create(organizationId: string, input: CreateDepartmentInput, actorUserId: string): Department {
    return store.createDepartment(organizationId, input, actorUserId);
  }
}

export const departmentService = new DepartmentService();
