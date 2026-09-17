import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Shield,
  Layers,
  KeyRound,
  Plus,
  Mail,
  CheckCircle2,
  Lock,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import type { Department, Organization, Role, User, AuditLog } from '../../types/index.ts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import { Select } from '../ui/select.tsx';
import { Badge } from '../ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { Dialog } from '../ui/dialog.tsx';
import { Tabs } from '../ui/tabs.tsx';
import { useToast } from '../ui/toast.tsx';
import { formatDateTime } from '../../lib/utils.ts';
import { ROLE_DEFAULT_PERMISSIONS, SYSTEM_PERMISSIONS } from '../../modules/rbac/permissions.ts';

export interface SettingsViewProps {
  user: User;
  organization: Organization;
  initialTab?: string;
  onOrganizationUpdated: (org: Organization) => void;
}

export function SettingsView({ user, organization, initialTab = 'general', onOrganizationUpdated }: SettingsViewProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab);

  // General Settings State
  const [orgName, setOrgName] = useState(organization.name);
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // Departments State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepts, setIsLoadingDepts] = useState(false);
  const [isNewDeptOpen, setIsNewDeptOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });
  const [deptFormError, setDeptFormError] = useState('');
  const [isCreatingDept, setIsCreatingDept] = useState(false);

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    departmentId: '',
    roleName: 'EMPLOYEE',
    password: '',
  });
  const [userFormError, setUserFormError] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const canManageOrg = user.roles.some((r) => r.name === 'SUPER_ADMIN' || r.name === 'ORG_ADMIN');

  // Load Departments
  const loadDepartments = async () => {
    try {
      setIsLoadingDepts(true);
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (data.success) {
        setDepartments(data.data);
      }
    } catch {
      showToast('Failed to load departments', { type: 'error' });
    } finally {
      setIsLoadingDepts(false);
    }
  };

  // Load Users
  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch {
      showToast('Failed to load members', { type: 'error' });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Load Audit Logs
  const loadAuditLogs = async () => {
    try {
      setIsLoadingAudit(true);
      const res = await fetch('/api/audit-logs');
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.data);
      }
    } catch {
      showToast('Failed to load audit logs', { type: 'error' });
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadDepartments();
    loadUsers();
    loadAuditLogs();
  }, [organization.id]);

  // Handle Save Organization
  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    try {
      setIsSavingOrg(true);
      const res = await fetch('/api/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName }),
      });
      const data = await res.json();
      if (data.success) {
        onOrganizationUpdated(data.data);
        showToast('Organization settings updated successfully', { type: 'success' });
      } else {
        showToast(data.error?.message || 'Failed to update organization', { type: 'error' });
      }
    } catch {
      showToast('Network error updating organization', { type: 'error' });
    } finally {
      setIsSavingOrg(false);
    }
  };

  // Handle Create Department
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptFormError('');
    if (!deptForm.name.trim()) {
      setDeptFormError('Department name is required');
      return;
    }

    try {
      setIsCreatingDept(true);
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deptForm),
      });
      const data = await res.json();
      if (data.success) {
        setDepartments((prev) => [...prev, data.data]);
        setIsNewDeptOpen(false);
        setDeptForm({ name: '', code: '', description: '' });
        showToast(`Department "${data.data.name}" created`, { type: 'success' });
      } else {
        setDeptFormError(data.error?.message || 'Failed to create department');
      }
    } catch {
      setDeptFormError('Network error occurred');
    } finally {
      setIsCreatingDept(false);
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    if (!userForm.firstName || !userForm.lastName || !userForm.email) {
      setUserFormError('All personal details and email are required');
      return;
    }

    try {
      setIsCreatingUser(true);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          email: userForm.email,
          departmentId: userForm.departmentId || undefined,
          roleName: userForm.roleName,
          password: userForm.password || 'Welcome123!',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) => [...prev, data.data]);
        setIsNewUserOpen(false);
        setUserForm({
          firstName: '',
          lastName: '',
          email: '',
          departmentId: '',
          roleName: 'EMPLOYEE',
          password: '',
        });
        showToast(`User ${data.data.email} added successfully`, { type: 'success' });
      } else {
        setUserFormError(data.error?.message || 'Failed to add user');
      }
    } catch {
      setUserFormError('Network error occurred');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const tabsConfig = [
    { id: 'general', label: 'General', icon: <Building2 className="h-4 w-4" /> },
    { id: 'users', label: 'Users & Directory', count: users.length, icon: <Users className="h-4 w-4" /> },
    { id: 'roles', label: 'Roles & Permissions', count: 4, icon: <Shield className="h-4 w-4" /> },
    { id: 'departments', label: 'Departments', count: departments.length, icon: <Layers className="h-4 w-4" /> },
    { id: 'security', label: 'Security & Audit', icon: <KeyRound className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Workspace Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure enterprise tenant parameters, manage directory members, and inspect role authorizations.
        </p>
      </div>

      <Tabs tabs={tabsConfig} activeTab={activeTab} onChange={setActiveTab} />

      {/* ------------------------------------------------------------------ */}
      {/* 1. GENERAL TAB */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Profile</CardTitle>
                <CardDescription>Primary workspace identity and tenant information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveOrganization} className="space-y-4">
                  <Input
                    label="Organization Name"
                    value={orgName}
                    disabled={!canManageOrg}
                    onChange={(e) => setOrgName(e.target.value)}
                    helperText="Visible to all organization members"
                  />

                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Tenant Identifier (Slug)
                    </label>
                    <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-mono text-slate-600">
                      {organization.slug}
                    </div>
                    <p className="text-xs text-slate-400">Fixed immutable multi-tenant partition key</p>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Internal Tenant UUID
                    </label>
                    <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-600 truncate">
                      {organization.id}
                    </div>
                  </div>

                  {canManageOrg && (
                    <div className="pt-2">
                      <Button type="submit" variant="primary" size="sm" isLoading={isSavingOrg}>
                        Save Changes
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Summary</CardTitle>
                <CardDescription>System metadata</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Created Date</span>
                  <span className="font-medium text-slate-800">{formatDateTime(organization.createdAt)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Isolation Tier</span>
                  <Badge variant="success">Strict Multi-Tenant</Badge>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Active Members</span>
                  <span className="font-semibold text-slate-800">{users.length}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Departments</span>
                  <span className="font-semibold text-slate-800">{departments.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. USERS TAB */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Organization Directory</h2>
              <p className="text-xs text-slate-500">Users belonging strictly to {organization.name}</p>
            </div>
            {canManageOrg && (
              <Button size="sm" variant="primary" onClick={() => setIsNewUserOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Member
              </Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Assigned Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const roleName = u.roles?.[0]?.name || 'EMPLOYEE';
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xs">
                          {u.firstName?.[0]}
                          {u.lastName?.[0]}
                        </div>
                        <span>
                          {u.firstName} {u.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{u.email}</TableCell>
                    <TableCell>{u.department?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          roleName === 'SUPER_ADMIN'
                            ? 'destructive'
                            : roleName === 'ORG_ADMIN'
                            ? 'info'
                            : roleName === 'MANAGER'
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {roleName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">Active</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(u.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* New User Dialog */}
          <Dialog
            open={isNewUserOpen}
            onOpenChange={setIsNewUserOpen}
            title="Add Organization Member"
            description={`Create an authenticated account within ${organization.name}`}
            footer={
              <>
                <Button variant="outline" size="sm" onClick={() => setIsNewUserOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleCreateUser} isLoading={isCreatingUser}>
                  Create Member
                </Button>
              </>
            }
          >
            <form onSubmit={handleCreateUser} className="space-y-3">
              {userFormError && <p className="text-xs text-rose-600 font-medium">{userFormError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  value={userForm.firstName}
                  onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                  placeholder="Jane"
                  required
                />
                <Input
                  label="Last Name"
                  value={userForm.lastName}
                  onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                  placeholder="Smith"
                  required
                />
              </div>
              <Input
                label="Work Email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="jane.smith@demo.local"
                required
              />
              <Select
                label="Department"
                value={userForm.departmentId}
                onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}
                options={[
                  { value: '', label: 'Select Department...' },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
              <Select
                label="Role Assignment"
                value={userForm.roleName}
                onChange={(e) => setUserForm({ ...userForm, roleName: e.target.value })}
                options={[
                  { value: 'ORG_ADMIN', label: 'ORG_ADMIN - Full tenant management' },
                  { value: 'MANAGER', label: 'MANAGER - Approvals & document operations' },
                  { value: 'EMPLOYEE', label: 'EMPLOYEE - Standard document read/create' },
                ]}
              />
              <Input
                label="Initial Temporary Password"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="Default: Welcome123!"
                helperText="Password must be at least 8 characters"
              />
            </form>
          </Dialog>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. ROLES & PERMISSIONS TAB */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Role-Based Access Control (RBAC)</h2>
            <p className="text-xs text-slate-500">
              Granular permission matrix enforced server-side via <code className="font-mono">RbacService</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {(['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'EMPLOYEE'] as const).map((roleName) => {
              const perms = ROLE_DEFAULT_PERMISSIONS[roleName];
              return (
                <Card key={roleName} className="flex flex-col justify-between">
                  <CardHeader className="pb-3 border-none">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{roleName}</CardTitle>
                      <Badge variant="outline">{perms.length} Perms</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {roleName === 'SUPER_ADMIN'
                        ? 'Global platform administrator'
                        : roleName === 'ORG_ADMIN'
                        ? 'Full tenant management and settings'
                        : roleName === 'MANAGER'
                        ? 'Approval routing and workflow actions'
                        : 'Standard member read & create capabilities'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1.5 border-t border-slate-100 pt-3">
                      {perms.slice(0, 6).map((p) => (
                        <div key={p} className="flex items-center gap-1.5 text-2xs text-slate-600 font-mono">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{p}</span>
                        </div>
                      ))}
                      {perms.length > 6 && (
                        <p className="text-3xs text-slate-400 pl-4 font-mono">+{perms.length - 6} additional permissions</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>System Permissions Directory</CardTitle>
              <CardDescription>All registered permission keys recognized by the backend architecture</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission Key</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SYSTEM_PERMISSIONS.map((p) => (
                    <TableRow key={p.key}>
                      <TableCell className="font-mono text-xs font-semibold text-blue-700">{p.key}</TableCell>
                      <TableCell className="text-xs uppercase font-medium text-slate-600">{p.resource}</TableCell>
                      <TableCell className="text-xs text-slate-600">{p.action}</TableCell>
                      <TableCell className="text-xs text-slate-500">{p.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. DEPARTMENTS TAB */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Departments & Divisions</h2>
              <p className="text-xs text-slate-500">Business units isolated strictly to {organization.name}</p>
            </div>
            {canManageOrg && (
              <Button size="sm" variant="primary" onClick={() => setIsNewDeptOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Department
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {departments.map((dept) => {
              const assignedMembers = users.filter((u) => u.departmentId === dept.id).length;
              return (
                <Card key={dept.id}>
                  <CardHeader className="pb-2 border-none">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{dept.name}</CardTitle>
                      {dept.code && <Badge variant="secondary">{dept.code}</Badge>}
                    </div>
                    <CardDescription className="text-xs line-clamp-2">
                      {dept.description || 'No description provided'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 border-t border-slate-100 mt-2 pt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Members:</span>
                      <span className="font-semibold text-slate-800">{assignedMembers}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* New Department Dialog */}
          <Dialog
            open={isNewDeptOpen}
            onOpenChange={setIsNewDeptOpen}
            title="Create Department"
            description="Add an organizational unit for employee routing and approvals"
            footer={
              <>
                <Button variant="outline" size="sm" onClick={() => setIsNewDeptOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleCreateDepartment} isLoading={isCreatingDept}>
                  Create Department
                </Button>
              </>
            }
          >
            <form onSubmit={handleCreateDepartment} className="space-y-3">
              {deptFormError && <p className="text-xs text-rose-600 font-medium">{deptFormError}</p>}
              <Input
                label="Department Name"
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="e.g. Compliance & Risk"
                required
              />
              <Input
                label="Short Code (Optional)"
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                placeholder="e.g. COMP"
              />
              <Input
                label="Description (Optional)"
                value={deptForm.description}
                onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                placeholder="Responsible for legal compliance..."
              />
            </form>
          </Dialog>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. SECURITY & AUDIT TAB */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2 border-none">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Multi-Tenancy</span>
                <Shield className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm font-bold text-slate-900">Enforced Partitioning</div>
                <p className="text-xs text-slate-500 mt-1">Cross-tenant boundaries verified on every request</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 border-none">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Session Security</span>
                <Lock className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm font-bold text-slate-900">JWT + Bcrypt (10 rounds)</div>
                <p className="text-xs text-slate-500 mt-1">7-day cryptographically signed tokens</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 border-none">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Audit Trail</span>
                <FileCheck className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm font-bold text-slate-900">Active Logging</div>
                <p className="text-xs text-slate-500 mt-1">{auditLogs.length} events recorded in current tenant</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Enterprise Audit Trail</CardTitle>
                <CardDescription>Chronological log of security, authentication, and administrative actions</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={loadAuditLogs} isLoading={isLoadingAudit}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-slate-400">
                        No audit logs recorded for this tenant yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap font-mono">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-blue-700">{log.action}</TableCell>
                        <TableCell className="text-xs text-slate-700">{log.userEmail || 'System'}</TableCell>
                        <TableCell className="text-xs text-slate-600 font-medium">
                          {log.entity} {log.entityId ? `(${log.entityId.substring(0, 8)})` : ''}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">{log.ipAddress || '127.0.0.1'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
