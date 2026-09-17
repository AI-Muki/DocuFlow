// DocuFlow AI - Multi-Tenant Data Store & Repository Layer
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type {
  AuditLog,
  Department,
  Organization,
  PermissionKey,
  Role,
  SystemRole,
  User,
  UserStatus,
} from '../types/index.ts';
import { ROLE_DEFAULT_PERMISSIONS, SYSTEM_PERMISSIONS } from '../modules/rbac/permissions.ts';
import { ConflictError, NotFoundError, TenantViolationError } from '../lib/errors.ts';

// In-Memory Multi-Tenant Store with Persistent Seed Data
export class DataStore {
  private organizations: Map<string, Organization> = new Map();
  private departments: Map<string, Department> = new Map();
  private users: Map<string, User & { passwordHash: string }> = new Map();
  private roles: Map<string, Role> = new Map();
  private auditLogs: AuditLog[] = [];
  private isInitialized = false;

  constructor() {
    this.seedDefaults();
  }

  private generateId(prefix?: string): string {
    const raw = randomUUID();
    return prefix ? `${prefix}-${raw.substring(0, 8)}` : raw;
  }

  public seedDefaults() {
    if (this.isInitialized) return;

    // 1. Seed Roles
    const systemRoles: SystemRole[] = ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'EMPLOYEE'];
    systemRoles.forEach((roleName) => {
      const id = `role-${roleName.toLowerCase()}`;
      this.roles.set(id, {
        id,
        organizationId: null, // System roles are global
        name: roleName,
        description: `Default system ${roleName} role`,
        isSystem: true,
        permissions: ROLE_DEFAULT_PERMISSIONS[roleName],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // 2. Seed Demo Organization
    const demoOrgId = 'org-demo-corp-uuid-001';
    const demoOrg: Organization = {
      id: demoOrgId,
      name: 'Demo Corporation',
      slug: 'demo-corp',
      logoUrl: null,
      settings: {
        enforceMFA: false,
        retentionDays: 90,
        allowedDomains: ['demo.local'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(demoOrgId, demoOrg);

    // 3. Seed Departments for Demo Corporation
    const deptNames = [
      { name: 'Finance', code: 'FIN', desc: 'Financial planning, accounting, and budgeting' },
      { name: 'HR', code: 'HR', desc: 'Human resources, recruiting, and employee relations' },
      { name: 'IT', code: 'IT', desc: 'Information technology, infrastructure, and cybersecurity' },
      { name: 'Legal', code: 'LEG', desc: 'Legal counsel, compliance, and contract review' },
    ];

    const createdDepts: Department[] = [];
    deptNames.forEach((d, idx) => {
      const deptId = `dept-${d.code.toLowerCase()}-00${idx + 1}`;
      const dept: Department = {
        id: deptId,
        organizationId: demoOrgId,
        name: d.name,
        code: d.code,
        description: d.desc,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.departments.set(deptId, dept);
      createdDepts.push(dept);
    });

    // 4. Seed Users (Development password: "Password123!")
    // Pre-calculated bcrypt hash for "Password123!" with salt rounds 10
    const devPasswordHash = bcrypt.hashSync('Password123!', 10);

    const itDept = createdDepts.find((d) => d.name === 'IT');
    const finDept = createdDepts.find((d) => d.name === 'Finance');
    const hrDept = createdDepts.find((d) => d.name === 'HR');

    const adminRole = this.roles.get('role-org_admin')!;
    const managerRole = this.roles.get('role-manager')!;
    const employeeRole = this.roles.get('role-employee')!;

    // admin@demo.local
    const adminUser: User & { passwordHash: string } = {
      id: 'user-admin-001',
      organizationId: demoOrgId,
      departmentId: itDept?.id,
      email: 'admin@demo.local',
      passwordHash: devPasswordHash,
      firstName: 'Alex',
      lastName: 'Vance',
      avatarUrl: null,
      status: 'ACTIVE',
      isEmailVerified: true,
      roles: [adminRole],
      permissions: adminRole.permissions,
      department: itDept || null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(adminUser.id, adminUser);

    // manager@demo.local
    const managerUser: User & { passwordHash: string } = {
      id: 'user-manager-002',
      organizationId: demoOrgId,
      departmentId: finDept?.id,
      email: 'manager@demo.local',
      passwordHash: devPasswordHash,
      firstName: 'Elena',
      lastName: 'Rostova',
      avatarUrl: null,
      status: 'ACTIVE',
      isEmailVerified: true,
      roles: [managerRole],
      permissions: managerRole.permissions,
      department: finDept || null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(managerUser.id, managerUser);

    // employee@demo.local
    const employeeUser: User & { passwordHash: string } = {
      id: 'user-employee-003',
      organizationId: demoOrgId,
      departmentId: hrDept?.id,
      email: 'employee@demo.local',
      passwordHash: devPasswordHash,
      firstName: 'David',
      lastName: 'Kim',
      avatarUrl: null,
      status: 'ACTIVE',
      isEmailVerified: true,
      roles: [employeeRole],
      permissions: employeeRole.permissions,
      department: hrDept || null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(employeeUser.id, employeeUser);

    // 5. Seed Initial Audit Log
    this.recordAuditLog(
      demoOrgId,
      adminUser.id,
      'organization.created',
      'Organization',
      demoOrgId,
      { initialSetup: true, name: 'Demo Corporation' },
      '127.0.0.1',
      'System Seed'
    );

    this.isInitialized = true;
  }

  // --------------------------------------------------------------------
  // Organization Operations
  // --------------------------------------------------------------------

  public getOrganizationById(id: string): Organization | null {
    const org = this.organizations.get(id);
    if (!org) return null;

    const userCount = Array.from(this.users.values()).filter((u) => u.organizationId === id).length;
    const departmentCount = Array.from(this.departments.values()).filter((d) => d.organizationId === id).length;

    return {
      ...org,
      stats: {
        userCount,
        departmentCount,
      },
    };
  }

  public getOrganizationBySlug(slug: string): Organization | null {
    const org = Array.from(this.organizations.values()).find((o) => o.slug === slug);
    if (!org) return null;
    return this.getOrganizationById(org.id);
  }

  public createOrganization(name: string, slug: string, creatorUserId: string): Organization {
    const existing = Array.from(this.organizations.values()).find((o) => o.slug === slug);
    if (existing) {
      throw new ConflictError(`Organization with slug "${slug}" already exists`);
    }

    const orgId = this.generateId('org');
    const newOrg: Organization = {
      id: orgId,
      name,
      slug,
      logoUrl: null,
      settings: {
        enforceMFA: false,
        retentionDays: 90,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(orgId, newOrg);

    // Create default 'General' department
    const defaultDeptId = this.generateId('dept');
    const defaultDept: Department = {
      id: defaultDeptId,
      organizationId: orgId,
      name: 'General',
      code: 'GEN',
      description: 'Default department for all staff',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.departments.set(defaultDeptId, defaultDept);

    // Update creator user to belong to this org with ORG_ADMIN role
    const user = this.users.get(creatorUserId);
    if (user) {
      const orgAdminRole = this.roles.get('role-org_admin')!;
      user.organizationId = orgId;
      user.departmentId = defaultDeptId;
      user.department = defaultDept;
      user.roles = [orgAdminRole];
      user.permissions = orgAdminRole.permissions;
      user.updatedAt = new Date().toISOString();
      this.users.set(user.id, user);
    }

    this.recordAuditLog(
      orgId,
      creatorUserId,
      'organization.created',
      'Organization',
      orgId,
      { name, slug }
    );

    return this.getOrganizationById(orgId)!;
  }

  public updateOrganization(orgId: string, updates: Partial<Pick<Organization, 'name' | 'logoUrl' | 'settings'>>, userId: string): Organization {
    const org = this.organizations.get(orgId);
    if (!org) throw new NotFoundError('Organization');

    if (updates.name !== undefined) org.name = updates.name;
    if (updates.logoUrl !== undefined) org.logoUrl = updates.logoUrl;
    if (updates.settings !== undefined) {
      org.settings = { ...org.settings, ...updates.settings };
    }
    org.updatedAt = new Date().toISOString();
    this.organizations.set(orgId, org);

    this.recordAuditLog(orgId, userId, 'organization.updated', 'Organization', orgId, updates);
    return this.getOrganizationById(orgId)!;
  }

  // --------------------------------------------------------------------
  // User Operations (Strict Multi-Tenant Isolation)
  // --------------------------------------------------------------------

  public findUserByEmail(email: string): (User & { passwordHash: string }) | null {
    const normalized = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === normalized) {
        return u;
      }
    }
    return null;
  }

  public findUserById(id: string): User | null {
    const u = this.users.get(id);
    if (!u) return null;
    const { passwordHash, ...userClean } = u;
    return userClean;
  }

  public getUsersByOrganization(organizationId: string): User[] {
    return Array.from(this.users.values())
      .filter((u) => u.organizationId === organizationId)
      .map(({ passwordHash, ...safeUser }) => safeUser);
  }

  public createUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    organizationId?: string | null;
    departmentId?: string | null;
    roleName?: SystemRole;
  }): User {
    const existing = this.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError(`User with email "${input.email}" already exists`);
    }

    const userId = this.generateId('user');
    const roleName = input.roleName || 'EMPLOYEE';
    const role = this.roles.get(`role-${roleName.toLowerCase()}`) || this.roles.get('role-employee')!;
    const department = input.departmentId ? this.departments.get(input.departmentId) || null : null;

    const newUser: User & { passwordHash: string } = {
      id: userId,
      organizationId: input.organizationId || null,
      departmentId: input.departmentId || null,
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      avatarUrl: null,
      status: 'ACTIVE',
      isEmailVerified: false,
      roles: [role],
      permissions: role.permissions,
      department,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(userId, newUser);

    if (input.organizationId) {
      this.recordAuditLog(
        input.organizationId,
        userId,
        'user.registered',
        'User',
        userId,
        { email: input.email, role: roleName }
      );
    }

    const { passwordHash, ...safeUser } = newUser;
    return safeUser;
  }

  // --------------------------------------------------------------------
  // Department Operations (Strict Multi-Tenant Isolation)
  // --------------------------------------------------------------------

  public getDepartmentsByOrganization(organizationId: string): Department[] {
    return Array.from(this.departments.values()).filter((d) => d.organizationId === organizationId);
  }

  public createDepartment(
    organizationId: string,
    input: { name: string; code?: string; description?: string },
    actorUserId: string
  ): Department {
    // Tenant check: ensure name is unique in this organization
    const existing = Array.from(this.departments.values()).find(
      (d) => d.organizationId === organizationId && d.name.toLowerCase() === input.name.toLowerCase()
    );
    if (existing) {
      throw new ConflictError(`Department "${input.name}" already exists in this organization`);
    }

    const deptId = this.generateId('dept');
    const dept: Department = {
      id: deptId,
      organizationId,
      name: input.name,
      code: input.code || input.name.substring(0, 4).toUpperCase(),
      description: input.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.departments.set(deptId, dept);
    this.recordAuditLog(organizationId, actorUserId, 'department.created', 'Department', deptId, input);

    return dept;
  }

  // --------------------------------------------------------------------
  // Roles & Permissions
  // --------------------------------------------------------------------

  public getRoles(organizationId?: string | null): Role[] {
    return Array.from(this.roles.values()).filter(
      (r) => r.organizationId === null || (organizationId && r.organizationId === organizationId)
    );
  }

  public getSystemPermissions() {
    return SYSTEM_PERMISSIONS;
  }

  // --------------------------------------------------------------------
  // Audit Trail & Logging (Tenant Scoped)
  // --------------------------------------------------------------------

  public recordAuditLog(
    organizationId: string,
    userId: string | null,
    action: string,
    entity: string,
    entityId?: string | null,
    metadata: Record<string, unknown> = {},
    ipAddress?: string | null,
    userAgent?: string | null
  ): AuditLog {
    const user = userId ? this.users.get(userId) : null;
    const log: AuditLog = {
      id: this.generateId('audit'),
      organizationId,
      userId,
      userEmail: user?.email,
      action,
      entity,
      entityId: entityId || null,
      metadata,
      ipAddress: ipAddress || '127.0.0.1',
      userAgent: userAgent || 'DocuFlow Platform',
      createdAt: new Date().toISOString(),
    };

    this.auditLogs.unshift(log);
    // Keep max 500 logs in memory
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    return log;
  }

  public getAuditLogsByOrganization(organizationId: string, limit = 50): AuditLog[] {
    return this.auditLogs.filter((log) => log.organizationId === organizationId).slice(0, limit);
  }

  // --------------------------------------------------------------------
  // Dashboard & Metrics (Pure Real Multi-Tenant Data)
  // --------------------------------------------------------------------

  public getDashboardOverview(organizationId: string) {
    const org = this.getOrganizationById(organizationId);
    if (!org) throw new NotFoundError('Organization');

    const users = this.getUsersByOrganization(organizationId);
    const departments = this.getDepartmentsByOrganization(organizationId);
    const recentAuditLogs = this.getAuditLogsByOrganization(organizationId, 5);

    return {
      organization: org,
      counts: {
        totalUsers: users.length,
        totalDepartments: departments.length,
        activeDocuments: 0, // Phase 2 stub
        pendingApprovals: 0, // Phase 2 stub
        activeWorkflows: 0, // Phase 2 stub
      },
      departments,
      users: users.slice(0, 10),
      recentActivity: recentAuditLogs,
    };
  }
}

export const store = new DataStore();
