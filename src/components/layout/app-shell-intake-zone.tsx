import React, { useState } from 'react';
import {
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Folder as FolderIcon,
  Shield,
  FileUp,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import { DocumentDropZone } from '../documents/document-drop-zone.tsx';
import type { Folder } from '../../types/index.ts';

export interface AppShellIntakeZoneProps {
  onFilesDropped: (files: File[], targetFolderId?: string | null) => void;
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onOpenUploadModal: () => void;
  className?: string;
  defaultExpanded?: boolean;
}

export function AppShellIntakeZone({
  onFilesDropped,
  folders,
  selectedFolderId,
  onSelectFolder,
  onOpenUploadModal,
  className = '',
  defaultExpanded = true,
}: AppShellIntakeZoneProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  if (isDismissed) {
    return null;
  }

  const selectedFolderName = selectedFolderId
    ? folders.find((f) => f.id === selectedFolderId)?.name || 'Custom Folder'
    : 'Root Directory';

  return (
    <div
      className={`rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/60 via-indigo-50/30 to-white shadow-2xs transition-all duration-200 overflow-hidden ${className}`}
      role="region"
      aria-label="Workspace document intake zone"
    >
      {/* Header bar of the intake zone */}
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-6 bg-white/60 border-b border-blue-100/80">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
            <FileUp className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-900">
                Quick Document Intake
              </h2>
              <span className="hidden sm:inline-flex items-center rounded-full bg-blue-100/80 px-2 py-0.5 text-3xs font-semibold text-blue-700">
                Drag & Drop Ready
              </span>
            </div>
            <p className="text-3xs sm:text-2xs text-slate-500">
              Drop files anywhere or browse to intake with automatic SHA-256 verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Target Folder Quick Selector */}
          <div className="hidden sm:flex items-center gap-1.5 text-2xs bg-white rounded-lg border border-slate-200 px-2 py-1 shadow-2xs">
            <FolderIcon className="h-3 w-3 text-slate-500" />
            <span className="text-slate-500">Target:</span>
            <select
              value={selectedFolderId || ''}
              onChange={(e) => onSelectFolder(e.target.value || null)}
              className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer max-w-[130px] truncate"
              aria-label="Select destination folder"
            >
              <option value="">📁 Root Directory</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle expand/collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            title={isExpanded ? 'Collapse drop zone' : 'Expand drop zone'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Collapse</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded State: Full drag-and-drop zone */}
      {isExpanded ? (
        <div className="p-3 sm:p-5">
          <DocumentDropZone
            onFilesDropped={(files) => onFilesDropped(files, selectedFolderId)}
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            folderName={selectedFolderName}
            title={`Drop documents here to intake into ${selectedFolderName}`}
            description="Supports PDF, Word, Excel, PowerPoint, PNG, JPEG, and TXT (up to 25 MB per file)"
            showSecurityBadges
            showBrowseButton
            className="bg-white/80 border-blue-300 hover:border-blue-500 hover:bg-white"
          />
        </div>
      ) : (
        /* Collapsed State: Compact intake strip that still accepts file drops */
        <div className="p-2 sm:p-3">
          <DocumentDropZone
            compact
            onFilesDropped={(files) => onFilesDropped(files, selectedFolderId)}
            folderName={selectedFolderName}
            title={`Drop documents here to intake into ${selectedFolderName}, or click to browse`}
            description="Quick drop zone active"
            className="bg-white/80 border-slate-300 hover:border-blue-400"
          />
        </div>
      )}
    </div>
  );
}
