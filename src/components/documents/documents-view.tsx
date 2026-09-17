import React, { useState, useEffect } from 'react';
import {
  Folder as FolderIcon,
  FileText,
  Plus,
  FolderPlus,
  Tag as TagIcon,
  Layers,
  History,
  Copy,
  FolderInput,
  Trash2,
  Edit2,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ArrowUpDown,
} from 'lucide-react';
import type {
  Document,
  DocumentStatus,
  DocumentType,
  DocumentVersion,
  Folder,
  Tag,
  User,
} from '../../types/index.ts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';
import { EmptyState } from '../ui/empty-state.tsx';
import { Modal } from '../ui/modal.tsx';
import { formatDateTime } from '../../lib/utils.ts';
import { useToast } from '../ui/toast.tsx';

export interface DocumentsViewProps {
  user: User;
}

export function DocumentsView({ user }: DocumentsViewProps) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'explorer' | 'types' | 'tags'>('explorer');

  // Explorer State
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Selected Item for Detail / Version Drawer
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Modals
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isRenameFolderOpen, setIsRenameFolderOpen] = useState(false);
  const [targetFolderToRename, setTargetFolderToRename] = useState<Folder | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [isCreateDocOpen, setIsCreateDocOpen] = useState(false);
  const [newDocData, setNewDocData] = useState({
    name: '',
    originalFileName: '',
    mimeType: 'application/pdf',
    fileSize: 102400,
    storageKey: '',
    checksum: 'a1b2c3d4e5f67890123456789abcdef0',
    description: '',
    documentTypeId: '',
    tagNames: '',
  });

  const [isNewVersionOpen, setIsNewVersionOpen] = useState(false);
  const [newVersionData, setNewVersionData] = useState({
    fileName: '',
    mimeType: 'application/pdf',
    fileSize: 153600,
    storageKey: '',
    checksum: 'f9e8d7c6b5a43210987654321fedcba0',
    changeDescription: '',
  });

  const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');

  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Move Folder / Document
  const [isMoveDocOpen, setIsMoveDocOpen] = useState(false);
  const [docToMove, setDocToMove] = useState<Document | null>(null);
  const [targetFolderIdForMove, setTargetFolderIdForMove] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [foldersRes, docsRes, typesRes, tagsRes] = await Promise.all([
        fetch('/api/folders'),
        fetch('/api/documents'),
        fetch('/api/document-types'),
        fetch('/api/tags'),
      ]);

      const [foldersData, docsData, typesData, tagsData] = await Promise.all([
        foldersRes.json(),
        docsRes.json(),
        typesRes.json(),
        tagsRes.json(),
      ]);

      if (foldersData.success) setFolders(foldersData.data);
      if (docsData.success) setDocuments(docsData.data);
      if (typesData.success) setDocumentTypes(typesData.data);
      if (tagsData.success) setTags(tagsData.data);
    } catch (err) {
      addToast('Failed to load document system records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update folder breadcrumb path
  useEffect(() => {
    if (!currentFolderId) {
      setFolderPath([]);
      return;
    }
    const path: Folder[] = [];
    let cur: Folder | undefined = folders.find((f) => f.id === currentFolderId);
    while (cur) {
      path.unshift(cur);
      cur = cur.parentFolderId ? folders.find((f) => f.id === cur?.parentFolderId) : undefined;
    }
    setFolderPath(path);
  }, [currentFolderId, folders]);

  // Load versions for selected document
  const loadVersions = async (doc: Document) => {
    setSelectedDoc(doc);
    setIsLoadingVersions(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/versions`);
      const data = await res.json();
      if (data.success) {
        setVersions(data.data);
      }
    } catch {
      addToast('Failed to load version history', 'error');
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // Folder Operations
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentFolderId: currentFolderId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to create folder');

      addToast(`Folder "${newFolderName}" created`, 'success');
      setNewFolderName('');
      setIsCreateFolderOpen(false);
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFolderToRename || !renameValue.trim()) return;

    try {
      const res = await fetch(`/api/folders/${targetFolderToRename.id}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to rename folder');

      addToast('Folder renamed successfully', 'success');
      setIsRenameFolderOpen(false);
      setTargetFolderToRename(null);
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (!confirm(`Are you sure you want to delete folder "${folder.name}" and all its contents?`)) return;

    try {
      const res = await fetch(`/api/folders/${folder.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to delete folder');

      addToast(`Folder "${folder.name}" deleted`, 'success');
      if (currentFolderId === folder.id) {
        setCurrentFolderId(folder.parentFolderId);
      }
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  // Document Operations
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocData.name.trim() || !newDocData.originalFileName.trim()) {
      addToast('Please provide document and file names', 'error');
      return;
    }

    const payload = {
      name: newDocData.name.trim(),
      originalFileName: newDocData.originalFileName.trim(),
      mimeType: newDocData.mimeType,
      fileSize: Number(newDocData.fileSize) || 102400,
      storageKey: newDocData.storageKey.trim() || `org-${user.organizationId}/docs/${Date.now()}-${newDocData.originalFileName}`,
      checksum: newDocData.checksum.trim() || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      description: newDocData.description.trim() || undefined,
      folderId: currentFolderId,
      documentTypeId: newDocData.documentTypeId || undefined,
      tags: newDocData.tagNames ? newDocData.tagNames.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to register document');

      addToast(`Document "${payload.name}" registered`, 'success');
      setIsCreateDocOpen(false);
      setNewDocData({
        name: '',
        originalFileName: '',
        mimeType: 'application/pdf',
        fileSize: 102400,
        storageKey: '',
        checksum: 'a1b2c3d4e5f67890123456789abcdef0',
        description: '',
        documentTypeId: '',
        tagNames: '',
      });
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleCopyDocument = async (doc: Document) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: `Copy of ${doc.name}` }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to duplicate document');

      addToast('Document record duplicated', 'success');
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    if (!confirm(`Are you sure you want to soft delete "${doc.name}"?`)) return;

    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to delete document');

      addToast('Document deleted', 'success');
      if (selectedDoc?.id === doc.id) {
        setSelectedDoc(null);
      }
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleMoveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docToMove) return;

    try {
      const res = await fetch(`/api/documents/${docToMove.id}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFolderId: targetFolderIdForMove }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to move document');

      addToast('Document moved successfully', 'success');
      setIsMoveDocOpen(false);
      setDocToMove(null);
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  // Version Operations
  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !newVersionData.fileName.trim()) return;

    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: newVersionData.fileName.trim(),
          mimeType: newVersionData.mimeType,
          fileSize: Number(newVersionData.fileSize) || 153600,
          storageKey: newVersionData.storageKey.trim() || `org-${user.organizationId}/docs/${selectedDoc.id}/v-${Date.now()}-${newVersionData.fileName}`,
          checksum: newVersionData.checksum.trim() || 'fedcba09876543210123456789abcdef',
          changeDescription: newVersionData.changeDescription.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to create version');

      addToast(`Version v${data.data.versionNumber} registered`, 'success');
      setIsNewVersionOpen(false);
      setNewVersionData({
        fileName: '',
        mimeType: 'application/pdf',
        fileSize: 153600,
        storageKey: '',
        checksum: 'f9e8d7c6b5a43210987654321fedcba0',
        changeDescription: '',
      });
      loadVersions(selectedDoc);
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleRestoreVersion = async (ver: DocumentVersion) => {
    if (!selectedDoc) return;
    if (!confirm(`Restore document to contents of version v${ver.versionNumber}? This will create a new current version preserving history.`)) return;

    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/versions/${ver.versionNumber}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to restore version');

      addToast(`Restored to v${ver.versionNumber} as new version v${data.data.versionNumber}`, 'success');
      loadVersions(selectedDoc);
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  // Types & Tags Creation
  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    try {
      const res = await fetch('/api/document-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTypeName.trim(),
          description: newTypeDescription.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to create document type');

      addToast(`Document type "${newTypeName}" created`, 'success');
      setNewTypeName('');
      setNewTypeDescription('');
      setIsCreateTypeOpen(false);
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to create tag');

      addToast(`Tag "${newTagName}" created`, 'success');
      setNewTagName('');
      setIsCreateTagOpen(false);
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  // Filtered views
  const currentFolders = folders.filter((f) => f.parentFolderId === currentFolderId);
  const currentDocs = documents.filter((d) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.originalFileName.toLowerCase().includes(q);
    }
    return d.folderId === currentFolderId;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Document Management</h1>
            <Badge variant="info">Phase 2A Foundation</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Hierarchical folders, document type schemas, versioning, and organization isolation.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'explorer' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderIcon className="h-3.5 w-3.5" /> Explorer
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'types' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Document Types ({documentTypes.length})
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'tags' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TagIcon className="h-3.5 w-3.5" /> Tags ({tags.length})
          </button>
        </div>
      </div>

      {/* Explorer Tab */}
      {activeTab === 'explorer' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Explorer Column */}
          <div className={`${selectedDoc ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
            {/* Action Bar & Breadcrumbs */}
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
              {/* Breadcrumb Path */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium text-slate-600">
                <button
                  onClick={() => setCurrentFolderId(null)}
                  className={`rounded px-1.5 py-0.5 hover:bg-slate-100 ${
                    currentFolderId === null ? 'font-bold text-slate-900' : ''
                  }`}
                >
                  Root
                </button>
                {folderPath.map((f, i) => (
                  <React.Fragment key={f.id}>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <button
                      onClick={() => setCurrentFolderId(f.id)}
                      className={`rounded px-1.5 py-0.5 hover:bg-slate-100 ${
                        i === folderPath.length - 1 ? 'font-bold text-slate-900' : ''
                      }`}
                    >
                      {f.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsCreateFolderOpen(true)}>
                  <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> New Folder
                </Button>
                <Button variant="primary" size="sm" onClick={() => setIsCreateDocOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Document Record
                </Button>
              </div>
            </div>

            {/* Content List */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading documents & folders...</div>
                ) : currentFolders.length === 0 && currentDocs.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      icon={<FolderIcon className="h-8 w-8 text-slate-400" />}
                      title="This folder is empty"
                      description="Create a subfolder or register a document record to start organizing."
                      action={
                        <Button size="sm" onClick={() => setIsCreateDocOpen(true)}>
                          Add Document Record
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {/* Folders List */}
                    {currentFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="group flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors"
                      >
                        <div
                          className="flex items-center gap-3 cursor-pointer flex-1"
                          onClick={() => setCurrentFolderId(folder.id)}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                            <FolderIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600">
                              {folder.name}
                            </span>
                            <p className="text-xs text-slate-400">Created {formatDateTime(folder.createdAt)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setTargetFolderToRename(folder);
                              setRenameValue(folder.name);
                              setIsRenameFolderOpen(true);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                            title="Rename Folder"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFolder(folder)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete Folder"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Documents List */}
                    {currentDocs.map((doc) => {
                      const isSelected = selectedDoc?.id === doc.id;
                      return (
                        <div
                          key={doc.id}
                          className={`group flex items-center justify-between p-3.5 transition-colors cursor-pointer ${
                            isSelected ? 'bg-blue-50/70 border-l-2 border-blue-600' : 'hover:bg-slate-50'
                          }`}
                          onClick={() => loadVersions(doc)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 truncate">{doc.name}</span>
                                <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                                  v{doc.versions?.[0]?.versionNumber || 1}
                                </Badge>
                                {doc.documentType && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {doc.documentType.name}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                <span>{doc.originalFileName}</span>
                                <span>•</span>
                                <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                                <span>•</span>
                                <span>{formatDateTime(doc.updatedAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div
                            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleCopyDocument(doc)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                              title="Duplicate Record"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDocToMove(doc);
                                setTargetFolderIdForMove(doc.folderId);
                                setIsMoveDocOpen(true);
                              }}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                              title="Move Document"
                            >
                              <FolderInput className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(doc)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete Document"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Selected Document Details & Versioning Drawer */}
          {selectedDoc && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm font-bold truncate max-w-[200px]">
                      {selectedDoc.name}
                    </CardTitle>
                    <CardDescription className="text-xs">Document Record Specs</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(null)}>
                    ✕
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4 pt-0 text-xs">
                  {/* File Metadata */}
                  <div className="space-y-1.5 rounded-md bg-slate-50 p-3 border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Original File:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                        {selectedDoc.originalFileName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">MIME Type:</span>
                      <span className="font-mono text-slate-700">{selectedDoc.mimeType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">File Size:</span>
                      <span className="text-slate-700">{(selectedDoc.fileSize / 1024).toFixed(1)} KB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Storage Key:</span>
                      <span className="font-mono text-slate-600 truncate max-w-[160px]" title={selectedDoc.storageKey}>
                        {selectedDoc.storageKey}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Checksum (SHA256):</span>
                      <span className="font-mono text-slate-600 truncate max-w-[150px]" title={selectedDoc.checksum}>
                        {selectedDoc.checksum.substring(0, 16)}...
                      </span>
                    </div>
                  </div>

                  {/* Assigned Tags */}
                  <div>
                    <span className="font-semibold text-slate-700 block mb-1">Tags</span>
                    {selectedDoc.tags && selectedDoc.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedDoc.tags.map((t) => (
                          <Badge key={t.id} variant="neutral" className="text-[10px]">
                            {t.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400">No tags assigned</p>
                    )}
                  </div>

                  {/* Custom Metadata */}
                  {selectedDoc.metadata && Object.keys(selectedDoc.metadata).length > 0 && (
                    <div>
                      <span className="font-semibold text-slate-700 block mb-1">Custom Metadata</span>
                      <div className="rounded-md bg-slate-50 p-2.5 border border-slate-100 space-y-1">
                        {Object.entries(selectedDoc.metadata).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-slate-600">
                            <span className="font-medium text-slate-500">{k}:</span>
                            <span className="font-mono text-slate-800">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Version History */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <History className="h-3.5 w-3.5 text-blue-600" />
                        <span>Version History ({versions.length})</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setIsNewVersionOpen(true)}>
                        <Plus className="mr-1 h-3 w-3" /> New Version
                      </Button>
                    </div>

                    {isLoadingVersions ? (
                      <p className="text-slate-400">Loading versions...</p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {versions.map((v, idx) => (
                          <div
                            key={v.id}
                            className="rounded-md border border-slate-200 p-2 bg-white flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">v{v.versionNumber}</span>
                                {idx === 0 && <Badge variant="success" className="text-[9px] px-1">Active</Badge>}
                                <span className="text-[11px] text-slate-500">{v.fileName}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {formatDateTime(v.createdAt)} {v.changeDescription && `• "${v.changeDescription}"`}
                              </p>
                            </div>

                            {idx !== 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRestoreVersion(v)}
                                className="text-[11px] text-blue-600 hover:text-blue-700"
                              >
                                Restore
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Document Types Tab */}
      {activeTab === 'types' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Document types define standard business classification schemas and metadata field definitions.
            </p>
            <Button size="sm" onClick={() => setIsCreateTypeOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Define Document Type
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documentTypes.map((dt) => (
              <Card key={dt.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900">{dt.name}</CardTitle>
                    <Layers className="h-4 w-4 text-indigo-600" />
                  </div>
                  <CardDescription className="text-xs">
                    {dt.description || 'No description provided'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 text-xs">
                  <span className="font-semibold text-slate-700 block mb-2">Schema Fields</span>
                  {dt.fields && dt.fields.length > 0 ? (
                    <div className="space-y-1.5">
                      {dt.fields.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-slate-600 border border-slate-100"
                        >
                          <span className="font-medium">{f.name}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="neutral" className="text-[9px] px-1">
                              {f.type}
                            </Badge>
                            {f.required && (
                              <span className="text-[9px] text-red-500 font-bold">Required</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">No custom fields defined</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tags Tab */}
      {activeTab === 'tags' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Tags allow cross-cutting categorization and organization-wide document labeling.
            </p>
            <Button size="sm" onClick={() => setIsCreateTagOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create New Tag
            </Button>
          </div>

          <div className="flex flex-wrap gap-2.5 p-6 rounded-lg border border-slate-200 bg-white shadow-2xs">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800"
              >
                <TagIcon className="h-3.5 w-3.5 text-slate-400" />
                <span>{tag.name}</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ({documents.filter((d) => d.tags?.some((t) => t.id === tag.id)).length} docs)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      <Modal isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} title="Create New Folder">
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Folder Name</label>
            <input
              type="text"
              required
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Invoices 2026"
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Create Folder
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename Folder Modal */}
      <Modal isOpen={isRenameFolderOpen} onClose={() => setIsRenameFolderOpen(false)} title="Rename Folder">
        <form onSubmit={handleRenameFolder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Folder Name</label>
            <input
              type="text"
              required
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsRenameFolderOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Name
            </Button>
          </div>
        </form>
      </Modal>

      {/* Register Document Record Modal */}
      <Modal isOpen={isCreateDocOpen} onClose={() => setIsCreateDocOpen(false)} title="Register Document Record">
        <form onSubmit={handleCreateDocument} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
            <input
              type="text"
              required
              value={newDocData.name}
              onChange={(e) => setNewDocData({ ...newDocData, name: e.target.value })}
              placeholder="e.g. Master Services Agreement"
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Original File Name</label>
              <input
                type="text"
                required
                value={newDocData.originalFileName}
                onChange={(e) => setNewDocData({ ...newDocData, originalFileName: e.target.value })}
                placeholder="MSA-Draft-2026.pdf"
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">MIME Type</label>
              <select
                value={newDocData.mimeType}
                onChange={(e) => setNewDocData({ ...newDocData, mimeType: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="application/pdf">PDF (application/pdf)</option>
                <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word (.docx)</option>
                <option value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">Excel (.xlsx)</option>
                <option value="image/png">Image (.png)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Document Type</label>
              <select
                value={newDocData.documentTypeId}
                onChange={(e) => setNewDocData({ ...newDocData, documentTypeId: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="">None / Unclassified</option>
                {documentTypes.map((dt) => (
                  <option key={dt.id} value={dt.id}>{dt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={newDocData.tagNames}
                onChange={(e) => setNewDocData({ ...newDocData, tagNames: e.target.value })}
                placeholder="Urgent, Legal"
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={newDocData.description}
              onChange={(e) => setNewDocData({ ...newDocData, description: e.target.value })}
              placeholder="Optional notes or context..."
              className="w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateDocOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Register Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Version Modal */}
      <Modal isOpen={isNewVersionOpen} onClose={() => setIsNewVersionOpen(false)} title="Upload / Register New Version">
        <form onSubmit={handleCreateVersion} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New File Name</label>
            <input
              type="text"
              required
              value={newVersionData.fileName}
              onChange={(e) => setNewVersionData({ ...newVersionData, fileName: e.target.value })}
              placeholder="e.g. Document-v2-Revised.pdf"
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Change Summary / Notes</label>
            <textarea
              rows={2}
              value={newVersionData.changeDescription}
              onChange={(e) => setNewVersionData({ ...newVersionData, changeDescription: e.target.value })}
              placeholder="e.g. Incorporated vendor feedback into Section 4"
              className="w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsNewVersionOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Commit New Version
            </Button>
          </div>
        </form>
      </Modal>

      {/* Move Document Modal */}
      <Modal isOpen={isMoveDocOpen} onClose={() => setIsMoveDocOpen(false)} title="Move Document">
        <form onSubmit={handleMoveDocument} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Folder</label>
            <select
              value={targetFolderIdForMove || ''}
              onChange={(e) => setTargetFolderIdForMove(e.target.value ? e.target.value : null)}
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="">Root Folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsMoveDocOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Move
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Document Type Modal */}
      <Modal isOpen={isCreateTypeOpen} onClose={() => setIsCreateTypeOpen(false)} title="Define New Document Type">
        <form onSubmit={handleCreateType} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Type Name</label>
            <input
              type="text"
              required
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="e.g. Non-Disclosure Agreement"
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={newTypeDescription}
              onChange={(e) => setNewTypeDescription(e.target.value)}
              placeholder="Standard NDA agreements between business entities..."
              className="w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateTypeOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Create Type
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Tag Modal */}
      <Modal isOpen={isCreateTagOpen} onClose={() => setIsCreateTagOpen(false)} title="Create New Tag">
        <form onSubmit={handleCreateTag} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tag Name</label>
            <input
              type="text"
              required
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="e.g. Board Review"
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateTagOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Create Tag
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
