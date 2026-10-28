import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Folder as FolderIcon,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils.ts';

export interface DocumentDropZoneProps {
  onFilesDropped: (files: File[], targetFolderId?: string | null) => void;
  className?: string;
  title?: string;
  description?: string;
  compact?: boolean;
  disabled?: boolean;
  showSupportedBadges?: boolean;
  showBrowseButton?: boolean;
  showSecurityBadges?: boolean;
  folderName?: string;
  folders?: Array<{ id: string; name: string }>;
  selectedFolderId?: string | null;
  onSelectFolder?: (folderId: string | null) => void;
  accept?: string;
  dragActiveTitle?: string;
}

const DEFAULT_EXTENSIONS = ['PDF', 'DOCX', 'XLSX', 'PPTX', 'PNG', 'JPG', 'TXT'];

export function DocumentDropZone({
  onFilesDropped,
  className,
  title = 'Drag & drop documents here, or click to browse',
  description = 'Supports PDF, Word, Excel, PowerPoint, Images, and TXT (up to 25 MB per file)',
  compact = false,
  disabled = false,
  showSupportedBadges = true,
  showBrowseButton = true,
  showSecurityBadges = false,
  folderName,
  folders,
  selectedFolderId,
  onSelectFolder,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt',
  dragActiveTitle = 'Release to intake documents into your workspace',
}: DocumentDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      e.dataTransfer.dropEffect = 'copy';
      if (!isDragOver) setIsDragOver(true);
    },
    [disabled, isDragOver]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragOver(false);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);
      if (disabled) return;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const filesArray = Array.from<File>(e.dataTransfer.files);
        onFilesDropped(filesArray, selectedFolderId);
      }
    },
    [disabled, onFilesDropped, selectedFolderId]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from<File>(e.target.files);
      onFilesDropped(filesArray, selectedFolderId);
      e.target.value = '';
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // If the click is on a dropdown or interactive child, don't trigger the file input
    const target = e.target as HTMLElement;
    if (target.closest('select') || target.closest('button')) {
      return;
    }
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      const target = e.target as HTMLElement;
      if (target.closest('select') || target.closest('button')) {
        return;
      }
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload documents by dropping files or clicking to browse"
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'group relative flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-xs transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
          isDragOver
            ? 'border-blue-600 bg-blue-50/90 text-blue-900 shadow-md ring-4 ring-blue-500/20 scale-[0.998]'
            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/90 text-slate-700 shadow-2xs',
          disabled && 'opacity-50 cursor-not-allowed hover:border-slate-300 hover:bg-slate-50',
          className
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          disabled={disabled}
          onChange={handleFileInputChange}
          className="hidden"
          aria-hidden="true"
        />

        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all',
              isDragOver
                ? 'bg-blue-600 text-white animate-pulse shadow-sm'
                : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
            )}
          >
            <UploadCloud className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
              {isDragOver ? dragActiveTitle : title}
            </p>
            <div className="flex items-center gap-2 text-2xs text-slate-500">
              <span>{description}</span>
              {folderName && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-blue-600 font-medium">Folder: {folderName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Optional Folder Selector in compact mode */}
        {folders && folders.length > 0 && onSelectFolder && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-2xs"
          >
            <FolderIcon className="h-3 w-3 text-slate-500" />
            <select
              value={selectedFolderId || ''}
              onChange={(e) => onSelectFolder(e.target.value || null)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
              aria-label="Select destination folder"
            >
              <option value="">Root directory</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Document intake drag and drop zone"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'group relative rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
        isDragOver
          ? 'border-blue-600 bg-blue-50/80 shadow-lg ring-4 ring-blue-500/20 scale-[0.995]'
          : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/60 shadow-2xs',
        disabled && 'opacity-50 cursor-not-allowed hover:border-slate-300 hover:bg-white',
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden="true"
      />

      <div className="flex flex-col items-center justify-center gap-4">
        {/* Animated icon indicator */}
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200',
            isDragOver
              ? 'bg-blue-600 text-white scale-110 shadow-lg ring-8 ring-blue-100 animate-pulse'
              : 'bg-blue-50 text-blue-600 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white shadow-xs'
          )}
        >
          <UploadCloud className="h-7 w-7" />
        </div>

        {/* Text information */}
        <div className="max-w-lg space-y-1.5">
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
            {isDragOver ? dragActiveTitle : title}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
        </div>

        {/* Target Folder Selector if available */}
        {folders && folders.length > 0 && onSelectFolder && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 shadow-2xs"
          >
            <FolderIcon className="h-3.5 w-3.5 text-blue-600" />
            <span className="font-medium text-slate-600">Intake Destination:</span>
            <div className="relative inline-flex items-center">
              <select
                value={selectedFolderId || ''}
                onChange={(e) => onSelectFolder(e.target.value || null)}
                className="appearance-none bg-white border border-slate-300 rounded px-2.5 py-1 pr-6 text-xs font-semibold text-slate-800 shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                aria-label="Select intake destination folder"
              >
                <option value="">📁 Root Directory</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        )}

        {/* Explicit Browse Files Button */}
        {showBrowseButton && (
          <div className="pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Browse Documents</span>
            </button>
          </div>
        )}

        {/* Supported Format Badges */}
        {showSupportedBadges && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {DEFAULT_EXTENSIONS.map((ext) => (
              <span
                key={ext}
                className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-600 group-hover:bg-slate-200/80 transition-colors"
              >
                .{ext.toLowerCase()}
              </span>
            ))}
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              Max 25 MB
            </span>
          </div>
        )}

        {/* Enterprise Security Badges */}
        {showSecurityBadges && (
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-2xs text-slate-500 border-t border-slate-100 w-full max-w-md">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              SHA-256 Checksummed
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              MIME & Magic Bytes Verified
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              Deduplication Protected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
