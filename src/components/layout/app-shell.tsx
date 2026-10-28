import React, { useState, useEffect, useCallback } from 'react';
import type { Organization, User, Folder, DocumentType, Tag } from '../../types/index.ts';
import { Sidebar, type NavSection } from './sidebar.tsx';
import { Header } from './header.tsx';
import { DashboardView } from '../dashboard/dashboard-view.tsx';
import { SettingsView } from '../settings/settings-view.tsx';
import { DocumentsView } from '../documents/documents-view.tsx';
import { ComingSoonView } from '../coming-soon/coming-soon-view.tsx';
import { GlobalDragOverlay } from './global-drag-overlay.tsx';
import { DocumentUploadModal } from '../documents/document-upload-modal.tsx';
import { DocumentDropZone } from '../documents/document-drop-zone.tsx';
import { AppShellIntakeZone } from './app-shell-intake-zone.tsx';
import { useToast } from '../ui/toast.tsx';
import type { BreadcrumbItem } from './breadcrumbs.tsx';

export interface AppShellProps {
  user: User;
  organization: Organization;
  onLogout: () => void;
  onOrganizationUpdated: (org: Organization) => void;
}

export function AppShell({ user, organization, onLogout, onOrganizationUpdated }: AppShellProps) {
  const { addToast } = useToast();
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [settingsTab, setSettingsTab] = useState<string>('general');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Phase 2 Intake & Upload Flow State in AppShell
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDropZoneVisible, setIsDropZoneVisible] = useState(true);
  const [selectedIntakeFolderId, setSelectedIntakeFolderId] = useState<string | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);

  // Preload folders, document types, and tags for rapid intake
  const fetchUploadMetadata = useCallback(async () => {
    try {
      const [foldersRes, typesRes, tagsRes] = await Promise.all([
        fetch('/api/folders'),
        fetch('/api/document-types'),
        fetch('/api/tags'),
      ]);
      const [foldersData, typesData, tagsData] = await Promise.all([
        foldersRes.json(),
        typesRes.json(),
        tagsRes.json(),
      ]);
      if (foldersData.success) setFolders(foldersData.data || []);
      if (typesData.success) setDocumentTypes(typesData.data || []);
      if (tagsData.success) setTags(tagsData.data || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUploadMetadata();
  }, [fetchUploadMetadata]);

  // Handle files dropped via the global overlay or drop zone
  const handleFilesDropped = useCallback(
    (files: File[], targetFolderId?: string | null) => {
      if (!files || files.length === 0) return;
      setQueuedFiles(files);
      if (targetFolderId !== undefined) {
        setSelectedIntakeFolderId(targetFolderId);
      }
      setIsUploadModalOpen(true);
      fetchUploadMetadata();
    },
    [fetchUploadMetadata]
  );

  const handleOpenUploadModal = useCallback(() => {
    setQueuedFiles([]);
    setIsUploadModalOpen(true);
    fetchUploadMetadata();
  }, [fetchUploadMetadata]);

  const handleUploadSuccess = useCallback(() => {
    setIsUploadModalOpen(false);
    setQueuedFiles([]);
    setDocumentsRefreshKey((k) => k + 1);
    fetchUploadMetadata();
    addToast('Documents uploaded successfully', 'success', `Files have been securely stored in ${organization.name}`);
  }, [fetchUploadMetadata, organization.name, addToast]);

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
      {/* Global Window Drag-and-Drop Intake Overlay */}
      <GlobalDragOverlay
        onFilesDropped={(files) => handleFilesDropped(files, selectedIntakeFolderId)}
        organizationName={organization.name}
      />

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
          onQuickUpload={handleOpenUploadModal}
          onToggleDropZone={() => setIsDropZoneVisible(!isDropZoneVisible)}
          isDropZoneVisible={isDropZoneVisible}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Universal Quick Intake Drag-and-Drop Zone Component in AppShell */}
          {isDropZoneVisible && (
            <AppShellIntakeZone
              folders={folders}
              selectedFolderId={selectedIntakeFolderId}
              onSelectFolder={setSelectedIntakeFolderId}
              onFilesDropped={handleFilesDropped}
              onOpenUploadModal={handleOpenUploadModal}
            />
          )}

          {currentSection === 'dashboard' && (
            <DashboardView
              user={user}
              organization={organization}
              onNavigateSettings={handleNavigateSettings}
              onNavigateSection={setCurrentSection}
              onQuickUpload={(files) => handleFilesDropped(files, selectedIntakeFolderId)}
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

          {currentSection === 'documents' && (
            <DocumentsView user={user} refreshTrigger={documentsRefreshKey} />
          )}

          {currentSection !== 'dashboard' && currentSection !== 'settings' && currentSection !== 'documents' && (
            <ComingSoonView
              section={currentSection}
              onBackToDashboard={() => setCurrentSection('dashboard')}
            />
          )}
        </main>
      </div>

      {/* AppShell Global Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setQueuedFiles([]);
        }}
        onUploadSuccess={handleUploadSuccess}
        currentFolderId={selectedIntakeFolderId}
        folders={folders}
        documentTypes={documentTypes}
        tags={tags}
        initialFiles={queuedFiles}
      />
    </div>
  );
}
