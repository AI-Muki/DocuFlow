import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  File,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Folder as FolderIcon,
  Tag as TagIcon,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '../ui/modal.tsx';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';
import type { Folder, DocumentType, Tag } from '../../types/index.ts';

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'queued' | 'uploading' | 'success' | 'error' | 'duplicate';
  error?: string;
  duplicateInfo?: {
    existingDocumentId?: string;
    existingDocumentName?: string;
  };
  xhr?: XMLHttpRequest;
}

export interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  currentFolderId?: string | null;
  folders: Folder[];
  documentTypes: DocumentType[];
  tags: Tag[];
}

const SUPPORTED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'png',
  'jpg',
  'jpeg',
  'txt',
];

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function DocumentUploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
  currentFolderId,
  folders,
  documentTypes,
  tags: availableTags,
}: DocumentUploadModalProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    currentFolderId || null
  );
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isGlobalUploading, setIsGlobalUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync currentFolderId when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(currentFolderId || null);
    }
  }, [isOpen, currentFolderId]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const validateClientFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
      return `Unsupported file format (.${ext || 'unknown'}). Supported: ${SUPPORTED_EXTENSIONS.join(', ').toUpperCase()}`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File size exceeds 25 MB limit (${formatBytes(file.size)})`;
    }
    return null;
  };

  const addFilesToQueue = (fileList: FileList | File[]) => {
    const newItems: UploadItem[] = [];

    Array.from(fileList).forEach((file) => {
      const error = validateClientFile(file);
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: error ? 'error' : 'queued',
        error: error || undefined,
      });
    });

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
      e.target.value = ''; // Reset input to allow selecting same file again
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.xhr) {
        target.xhr.abort();
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const uploadSingleItem = (itemId: string, allowDuplicateOverride = false): Promise<boolean> => {
    return new Promise((resolve) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              status: 'uploading',
              progress: 0,
              error: undefined,
            };
          }
          return item;
        })
      );

      const currentItem = items.find((it) => it.id === itemId);
      if (!currentItem) {
        resolve(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', currentItem.file);
      if (selectedFolderId) formData.append('folderId', selectedFolderId);
      if (selectedDocumentTypeId) formData.append('documentTypeId', selectedDocumentTypeId);
      if (selectedTags.length > 0) formData.append('tags', JSON.stringify(selectedTags));
      if (allowDuplicateOverride) formData.append('allowDuplicate', 'true');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/documents/upload');

      // Update item with active xhr
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, xhr } : it))
      );

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, progress: percent } : it))
          );
        }
      };

      xhr.onload = () => {
        let responseData: any = {};
        try {
          responseData = JSON.parse(xhr.responseText);
        } catch {
          responseData = { message: xhr.statusText || 'Server error' };
        }

        if (xhr.status === 201 && responseData.success) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? { ...it, status: 'success', progress: 100, xhr: undefined }
                : it
            )
          );
          resolve(true);
        } else if (xhr.status === 409 || responseData.isDuplicate) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    status: 'duplicate',
                    progress: 100,
                    error: responseData.message || 'An identical file already exists.',
                    duplicateInfo: {
                      existingDocumentId: responseData.data?.existingDocument?.id,
                      existingDocumentName: responseData.data?.existingDocument?.name,
                    },
                    xhr: undefined,
                  }
                : it
            )
          );
          resolve(false);
        } else {
          const errMsg =
            responseData.error?.message ||
            responseData.message ||
            `Upload failed (${xhr.status})`;
          setItems((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? { ...it, status: 'error', error: errMsg, xhr: undefined }
                : it
            )
          );
          resolve(false);
        }
      };

      xhr.onerror = () => {
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? { ...it, status: 'error', error: 'Network error occurred during upload', xhr: undefined }
              : it
          )
        );
        resolve(false);
      };

      xhr.onabort = () => {
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? { ...it, status: 'queued', progress: 0, xhr: undefined }
              : it
          )
        );
        resolve(false);
      };

      xhr.send(formData);
    });
  };

  const handleStartAllUploads = async () => {
    setIsGlobalUploading(true);
    const queuedItems = items.filter((it) => it.status === 'queued' || it.status === 'error');

    let anySuccess = false;
    for (const item of queuedItems) {
      const ok = await uploadSingleItem(item.id, false);
      if (ok) anySuccess = true;
    }

    setIsGlobalUploading(false);
    if (anySuccess) {
      onUploadSuccess();
    }
  };

  const handleDuplicateOverride = async (itemId: string) => {
    const ok = await uploadSingleItem(itemId, true);
    if (ok) {
      onUploadSuccess();
    }
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const allComplete =
    items.length > 0 &&
    items.every((it) => it.status === 'success');

  const hasQueuedOrErrors = items.some(
    (it) => it.status === 'queued' || it.status === 'error'
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isGlobalUploading) {
          onClose();
          setItems([]);
        }
      }}
      title="Upload Documents"
      description="Select or drag files to store them securely with versioning and cryptographic checksums."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
              : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-blue-100/60 rounded-full text-blue-600">
              <UploadCloud className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Click to browse or drag and drop files here
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Supported: PDF, Word, Excel, PowerPoint, PNG, JPEG, TXT (Max 25MB)
              </p>
            </div>
          </div>
        </div>

        {/* Target Destination & Metadata Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
          <div>
            <label className="font-medium text-slate-700 block mb-1 flex items-center gap-1">
              <FolderIcon className="h-3.5 w-3.5 text-slate-500" />
              Target Folder
            </label>
            <select
              value={selectedFolderId || ''}
              onChange={(e) => setSelectedFolderId(e.target.value || null)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">(Root Directory)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-medium text-slate-700 block mb-1 flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              Document Type (Optional)
            </label>
            <select
              value={selectedDocumentTypeId}
              onChange={(e) => setSelectedDocumentTypeId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">None / General</option>
              {documentTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name}
                </option>
              ))}
            </select>
          </div>

          {availableTags.length > 0 && (
            <div className="sm:col-span-2 pt-1 border-t border-slate-200/60">
              <label className="font-medium text-slate-700 block mb-1 flex items-center gap-1">
                <TagIcon className="h-3.5 w-3.5 text-slate-500" />
                Assign Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((t) => {
                  const isSelected = selectedTags.includes(t.name);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.name)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Selected Files Queue */}
        {items.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-1">
              <span>Files to Upload ({items.length})</span>
              <span className="text-slate-500 font-normal">
                {items.filter((i) => i.status === 'success').length} of {items.length} completed
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border text-xs transition-colors ${
                    item.status === 'duplicate'
                      ? 'bg-amber-50/60 border-amber-300'
                      : item.status === 'error'
                      ? 'bg-rose-50/60 border-rose-200'
                      : item.status === 'success'
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-1.5 bg-slate-100 rounded text-slate-600 shrink-0 mt-0.5">
                        <File className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate max-w-[280px] sm:max-w-md">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-slate-500">{formatBytes(item.size)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.status === 'queued' && (
                        <Badge variant="secondary" className="text-[10px]">
                          Queued
                        </Badge>
                      )}
                      {item.status === 'uploading' && (
                        <Badge variant="secondary" className="text-[10px] text-blue-700 bg-blue-50 border-blue-200">
                          {item.progress}%
                        </Badge>
                      )}
                      {item.status === 'success' && (
                        <Badge variant="success" className="text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Uploaded
                        </Badge>
                      )}
                      {item.status === 'duplicate' && (
                        <Badge variant="warning" className="text-[10px] flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Duplicate
                        </Badge>
                      )}
                      {item.status === 'error' && (
                        <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Error
                        </Badge>
                      )}

                      {item.status !== 'uploading' && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {item.status === 'uploading' && (
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Duplicate Conflict Resolution Prompt */}
                  {item.status === 'duplicate' && (
                    <div className="mt-2.5 pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-amber-800 font-medium text-[11px] flex items-center gap-1.5">
                        <span>An identical file already exists.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateOverride(item.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors"
                        >
                          Upload as new document
                        </button>
                      </div>
                    </div>
                  )}

                  {/* General Error Message & Retry */}
                  {item.status === 'error' && (
                    <div className="mt-2 pt-1.5 border-t border-rose-200 flex items-center justify-between">
                      <span className="text-rose-700 text-[11px] truncate max-w-[280px]">
                        {item.error || 'Failed to upload'}
                      </span>
                      <button
                        type="button"
                        onClick={() => uploadSingleItem(item.id, false)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-[11px] flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" /> Retry
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              setItems([]);
            }}
            disabled={isGlobalUploading}
          >
            {allComplete ? 'Done' : 'Close'}
          </Button>

          <div className="flex items-center gap-2">
            {hasQueuedOrErrors && (
              <Button
                size="sm"
                onClick={handleStartAllUploads}
                disabled={isGlobalUploading || items.length === 0}
              >
                {isGlobalUploading ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                    Start Upload ({items.filter((i) => i.status === 'queued' || i.status === 'error').length})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
