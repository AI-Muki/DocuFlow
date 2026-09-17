import React from 'react';
import {
  LayoutDashboard,
  FileText,
  GitFork,
  CheckSquare,
  FileCheck,
  Search,
  BarChart3,
  Settings,
  Building,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import type { Organization, User } from '../../types/index.ts';

export type NavSection =
  | 'dashboard'
  | 'documents'
  | 'workflows'
  | 'tasks'
  | 'approvals'
  | 'search'
  | 'analytics'
  | 'settings';

export interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  organization: Organization | null;
  user: User;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isPhase1: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, isPhase1: true },
  { id: 'documents', label: 'Documents', icon: FileText, isPhase1: true, badge: 'Phase 2A' },
  { id: 'workflows', label: 'Workflows', icon: GitFork, isPhase1: false, badge: 'Phase 2B' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, isPhase1: false, badge: 'Phase 2B' },
  { id: 'approvals', label: 'Approvals', icon: FileCheck, isPhase1: false, badge: 'Phase 2B' },
  { id: 'search', label: 'Search', icon: Search, isPhase1: false, badge: 'Phase 2B' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, isPhase1: false, badge: 'Phase 2B' },
];

export function Sidebar({
  currentSection,
  onSelectSection,
  organization,
  user,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const primaryRole = user.roles?.[0]?.name || 'EMPLOYEE';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-slate-900 text-slate-300">
      {/* Brand Header */}
      <div>
        <div className="flex h-14 items-center gap-3 border-b border-slate-800 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white font-bold text-sm shadow-xs">
            DF
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm tracking-tight text-white truncate">DocuFlow AI</span>
            <span className="text-3xs text-blue-400 font-mono tracking-wider uppercase">Enterprise SaaS</span>
          </div>
        </div>

        {/* Tenant Indicator */}
        <div className="mx-3 mt-3.5 mb-2 rounded-md bg-slate-800/60 p-2.5 border border-slate-750">
          <div className="flex items-center gap-2 text-slate-200">
            <Building className="h-4 w-4 text-blue-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-white">
                {organization ? organization.name : 'No Tenant Joined'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-3xs text-slate-400 uppercase tracking-wider font-mono">
                  {primaryRole.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="space-y-1 px-3 py-2">
          <div className="px-2 py-1 text-3xs font-semibold uppercase tracking-wider text-slate-500">
            Platform Modules
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : item.isPhase1
                    ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-3xs font-mono font-medium',
                      isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Settings & Status */}
      <div className="p-3 border-t border-slate-800 space-y-1">
        <button
          onClick={() => {
            onSelectSection('settings');
            onCloseMobile();
          }}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors cursor-pointer',
            currentSection === 'settings'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          )}
        >
          <Settings className="h-4 w-4 text-slate-400" />
          <span>Settings</span>
        </button>

        <div className="pt-2 px-3 text-3xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span>Phase 1 Architecture</span>
          </div>
          <span className="font-mono text-slate-500">v1.0.0</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-40 border-r border-slate-800">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative flex w-64 max-w-xs flex-1 flex-col z-50 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
