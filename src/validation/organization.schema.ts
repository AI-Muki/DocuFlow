import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters').max(80),
  code: z.string().max(20).optional(),
  description: z.string().max(250).optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const createUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  password: z.string().min(8).optional(),
  departmentId: z.string().uuid().optional().nullable(),
  roleName: z.enum(['ORG_ADMIN', 'MANAGER', 'EMPLOYEE']).default('EMPLOYEE'),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional().nullable(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
