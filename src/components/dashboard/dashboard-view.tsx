import React from 'react';
import {
  Building2,
  Users,
  Layers,
  ShieldAlert,
  FileText,
  GitPullRequest,
  CheckCircle2,
  Activity,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { Organization, User } from '../../types/index.ts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { EmptyState } from '../ui/empty-state.tsx';
import { formatDateTime } from '../../lib/utils.ts';

export interface DashboardViewProps {
  user: User;
  organization: Organization;
  onNavigateSettings: (tab?: string) => void;
  onNavigateSection: (section: any) => void;
}

export function DashboardView({
  user,
  organization,
  onNavigateSettings,
  onNavigateSection,
}: DashboardViewProps) {
  const primaryRole = user.roles?.[0]?.name || 'EMPLOYEE';
  const userCount = organization.stats?.userCount ?? 1;
  const deptCount = organization.stats?.departmentCount ?? 1;

  return (
    <div className="space-y-6">
      {/* Enterprise Welcome Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Welcome back, {user.firstName}
            </h1>
            <Badge variant="info">{primaryRole.replace('_', ' ')}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Active Tenant:{' '}
            <span className="font-semibold text-slate-700">{organization.name}</span>{' '}
            (Slug: <code className="font-mono text-slate-600">{organization.slug}</code>)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateSettings('users')}
          >
            Manage Members
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigateSettings('general')}
          >
            Organization Settings
          </Button>
        </div>
      </div>

      {/* Real Metrics Grid - Strict Real Data */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Organization */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-none">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant Org</span>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg font-bold text-slate-900 truncate">{organization.name}</div>
            <p className="text-xs text-slate-500 mt-1">Multi-tenant isolated</p>
          </CardContent>
        </Card>

        {/* Metric 2: Users Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-none">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Users</span>
            <Users className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">{userCount}</div>
            <p className="text-xs text-slate-500 mt-1">Provisioned accounts</p>
          </CardContent>
        </Card>

        {/* Metric 3: Departments Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-none">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Departments</span>
            <Layers className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">{deptCount}</div>
            <p className="text-xs text-slate-500 mt-1">Functional business units</p>
          </CardContent>
        </Card>

        {/* Metric 4: RBAC Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-none">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Authority</span>
            <ShieldCheck className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg font-bold text-slate-900">{primaryRole}</div>
            <p className="text-xs text-slate-500 mt-1">{user.permissions.length} granular permissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Planned Phase 2 Functional Modules (Empty States with Clean Architecture Guidance) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Module 1: Documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Enterprise repository and file classification</CardDescription>
            </div>
            <Badge variant="outline">Phase 2</Badge>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<FileText className="h-6 w-6 text-slate-400" />}
              title="No documents uploaded yet"
              description="Document ingestion, OCR metadata extraction, and AI categorization engines will be integrated in Phase 2."
              action={
                <Button variant="outline" size="sm" onClick={() => onNavigateSection('documents')}>
                  View Module Specs <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              }
            />
          </CardContent>
        </Card>

        {/* Module 2: Pending Approvals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Multi-tier document and compliance sign-offs</CardDescription>
            </div>
            <Badge variant="outline">Phase 2</Badge>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<GitPullRequest className="h-6 w-6 text-slate-400" />}
              title="No pending approvals"
              description="Automated approval routing, departmental sign-offs, and compliance gates are scheduled for Phase 2."
              action={
                <Button variant="outline" size="sm" onClick={() => onNavigateSection('approvals')}>
                  View Module Specs <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              }
            />
          </CardContent>
        </Card>

        {/* Module 3: Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Tasks & Deadlines</CardTitle>
              <CardDescription>Departmental assignments and verification schedules</CardDescription>
            </div>
            <Badge variant="outline">Phase 2</Badge>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<CheckCircle2 className="h-6 w-6 text-slate-400" />}
              title="No active tasks assigned"
              description="Task dispatch, deadline tracking, and employee review queues are scheduled for Phase 2."
              action={
                <Button variant="outline" size="sm" onClick={() => onNavigateSection('tasks')}>
                  View Module Specs <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              }
            />
          </CardContent>
        </Card>

        {/* Module 4: Workflow Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Workflow Activity</CardTitle>
              <CardDescription>Event-driven routing and automation executions</CardDescription>
            </div>
            <Badge variant="outline">Phase 2</Badge>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<Activity className="h-6 w-6 text-slate-400" />}
              title="No workflow executions recorded"
              description="Visual workflow builder, rule triggers, and automated document routing will activate in Phase 2."
              action={
                <Button variant="outline" size="sm" onClick={() => onNavigateSection('workflows')}>
                  View Module Specs <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
