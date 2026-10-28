import React, { useState } from 'react';
import { Bell, Building2, ChevronDown, Menu, UploadCloud } from 'lucide-react';
import type { Organization, User } from '../../types/index.ts';
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs.tsx';
import { UserMenu } from './user-menu.tsx';

export interface HeaderProps {
  user: User;
  organization: Organization | null;
  breadcrumbs: BreadcrumbItem[];
  onLogout: () => void;
  onNavigateSettings: () => void;
  onToggleMobileSidebar: () => void;
  onQuickUpload?: () => void;
  onToggleDropZone?: () => void;
  isDropZoneVisible?: boolean;
}

export function Header({
  user,
  organization,
  breadcrumbs,
  onLogout,
  onNavigateSettings,
  onToggleMobileSidebar,
  onQuickUpload,
  onToggleDropZone,
  isDropZoneVisible,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 md:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Breadcrumbs items={breadcrumbs} />
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Quick Document Intake / Upload Button */}
        {onQuickUpload && (
          <button
            type="button"
            onClick={onQuickUpload}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100/80 text-blue-700 px-2.5 py-1.5 text-xs font-semibold shadow-2xs transition-colors"
            title="Upload or drop documents"
            aria-label="Upload documents"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Intake Files</span>
          </button>
        )}

        {/* Toggle Drop Zone in AppShell */}
        {onToggleDropZone && (
          <button
            type="button"
            onClick={onToggleDropZone}
            className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-2xs transition-colors ${
              isDropZoneVisible
                ? 'border-blue-300 bg-blue-100/80 text-blue-800'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
            title={isDropZoneVisible ? 'Hide intake drop zone' : 'Show intake drop zone'}
            aria-label="Toggle drop zone intake"
          >
            <UploadCloud className="h-3.5 w-3.5 text-blue-600" />
            <span>Drop Zone</span>
          </button>
        )}

        {/* Organization Selector Placeholder */}
        {organization && (
          <div className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 sm:flex">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate max-w-[140px]">{organization.name}</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </div>
        )}

        {/* Notifications Placeholder */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Notifications (Phase 2)"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-300"></span>
            </span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg z-50 text-left">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <span className="text-xs font-semibold text-slate-800">Notifications</span>
                <span className="text-2xs rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-medium">Phase 2</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Workflow automation notifications, document assignments, and approval alerts will appear here in Phase 2.
              </p>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* User Menu */}
        <UserMenu
          user={user}
          organization={organization}
          onLogout={onLogout}
          onNavigateSettings={onNavigateSettings}
        />
      </div>
    </header>
  );
}
