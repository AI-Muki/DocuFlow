import React, { useState } from 'react';
import type { Organization, User } from '../../types/index.ts';
import { Sidebar, type NavSection } from './sidebar.tsx';
import { Header } from './header.tsx';
import { DashboardView } from '../dashboard/dashboard-view.tsx';
import { SettingsView } from '../settings/settings-view.tsx';
import { ComingSoonView } from '../coming-soon/coming-soon-view.tsx';
import type { BreadcrumbItem } from './breadcrumbs.tsx';

export interface AppShellProps {
  user: User;
  organization: Organization;
  onLogout: () => void;
  onOrganizationUpdated: (org: Organization) => void;
}

export function AppShell({ user, organization, onLogout, onOrganizationUpdated }: AppShellProps) {
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [settingsTab, setSettingsTab] = useState<string>('general');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const base: BreadcrumbItem[] = [
      {
        label: organization.name,
        onClick: () => setCurrentSection('dashboard'),
      },
    ];

    if (currentSection === 'dashboard') {
      base.push({ label: 'Dashboard' });
    } else if (currentSection === 'settings') {
      base.push({ label: 'Settings', onClick: () => setCurrentSection('settings') });
      const tabLabel = settingsTab.charAt(0).toUpperCase() + settingsTab.slice(1);
      base.push({ label: tabLabel });
    } else {
      const sectionLabel = currentSection.charAt(0).toUpperCase() + currentSection.slice(1);
      base.push({ label: sectionLabel });
    }

    return base;
  };

  const handleNavigateSettings = (tab = 'general') => {
    setSettingsTab(tab);
    setCurrentSection('settings');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        organization={organization}
        user={user}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main App Workspace */}
      <div className="flex flex-1 flex-col md:pl-64">
        <Header
          user={user}
          organization={organization}
          breadcrumbs={getBreadcrumbs()}
          onLogout={onLogout}
          onNavigateSettings={() => handleNavigateSettings('general')}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentSection === 'dashboard' && (
            <DashboardView
              user={user}
              organization={organization}
              onNavigateSettings={handleNavigateSettings}
              onNavigateSection={setCurrentSection}
            />
          )}

          {currentSection === 'settings' && (
            <SettingsView
              user={user}
              organization={organization}
              initialTab={settingsTab}
              onOrganizationUpdated={onOrganizationUpdated}
            />
          )}

          {currentSection !== 'dashboard' && currentSection !== 'settings' && (
            <ComingSoonView
              section={currentSection}
              onBackToDashboard={() => setCurrentSection('dashboard')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
