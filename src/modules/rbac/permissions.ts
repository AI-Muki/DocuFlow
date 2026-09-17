import type { Permission, PermissionKey, SystemRole } from '../../types/index.ts';

export const SYSTEM_PERMISSIONS: Array<Omit<Permission, 'id' | 'createdAt'>> = [
  // Document Management
  { key: 'documents.read', action: 'read', resource: 'documents', description: 'View and download organization documents' },
  { key: 'documents.create', action: 'create', resource: 'documents', description: 'Upload and create new documents' },
  { key: 'documents.update', action: 'update', resource: 'documents', description: 'Edit metadata and document details' },
  { key: 'documents.delete', action: 'delete', resource: 'documents', description: 'Delete organization documents' },

  // Workflows & Automation
  { key: 'workflows.create', action: 'create', resource: 'workflows', description: 'Initiate and submit workflows' },
  { key: 'workflows.manage', action: 'manage', resource: 'workflows', description: 'Configure workflow templates and routing' },

  // Approvals
  { key: 'approvals.approve', action: 'approve', resource: 'approvals', description: 'Approve or reject assigned approvals' },

  // Identity & Access
  { key: 'users.read', action: 'read', resource: 'users', description: 'View organization member directory' },
  { key: 'users.manage', action: 'manage', resource: 'users', description: 'Invite, suspend, and configure user roles' },
  { key: 'departments.manage', action: 'manage', resource: 'departments', description: 'Create and configure departments' },
  { key: 'organization.manage', action: 'manage', resource: 'organization', description: 'Configure organization settings and branding' },

  // Audit
  { key: 'audit.read', action: 'read', resource: 'audit', description: 'View enterprise audit logs and security events' },
];

export const ROLE_DEFAULT_PERMISSIONS: Record<SystemRole, PermissionKey[]> = {
  SUPER_ADMIN: [
    'documents.read',
    'documents.create',
    'documents.update',
    'documents.delete',
    'workflows.create',
    'workflows.manage',
    'approvals.approve',
    'users.manage',
    'users.read',
    'departments.manage',
    'organization.manage',
    'audit.read',
  ],
  ORG_ADMIN: [
    'documents.read',
    'documents.create',
    'documents.update',
    'documents.delete',
    'workflows.create',
    'workflows.manage',
    'approvals.approve',
    'users.manage',
    'users.read',
    'departments.manage',
    'organization.manage',
    'audit.read',
  ],
  MANAGER: [
    'documents.read',
    'documents.create',
    'documents.update',
    'workflows.create',
    'approvals.approve',
    'users.read',
    'audit.read',
  ],
  EMPLOYEE: [
    'documents.read',
    'documents.create',
    'users.read',
  ],
};
