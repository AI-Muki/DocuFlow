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
  Upload,
  Download,
  ExternalLink,
  Link2,
  Star,
  MessageSquare,
  Clock,
  RotateCcw,
  Eye,
  Send,
  AlertTriangle,
  FileCode2,
  CheckSquare,
  Square,
  Archive,
  Filter,
  Check,
  Sparkles,
  LayoutGrid,
  List,
  X,
  Loader2,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Calendar,
} from 'lucide-react';
import type {
  Document,
  DocumentComment,
  DocumentFieldDefinition,
  DocumentFilterOptions,
  DocumentSortBy,
  DocumentSortOrder,
  DocumentStatus,
  DocumentType,
  DocumentVersion,
  Folder,
  PaginationMeta,
  Tag,
  User,
  AuditLog,
} from '../../types/index.ts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';
import { EmptyState } from '../ui/empty-state.tsx';
import { Modal } from '../ui/modal.tsx';
import { DocumentUploadModal } from './document-upload-modal.tsx';
import { VersionUploadModal } from './version-upload-modal.tsx';
import { TextViewerModal } from './text-viewer-modal.tsx';
import { DocumentTypesManager } from './document-types-manager.tsx';
import { DocumentDropZone } from './document-drop-zone.tsx';
import { formatDateTime, formatBytes, getInitials } from '../../lib/utils.ts';
import { useToast } from '../ui/toast.tsx';

export interface DocumentsViewProps {
  user: User;
  refreshTrigger?: number;
}

export function DocumentsView({ user, refreshTrigger }: DocumentsViewProps) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'explorer' | 'types' | 'tags'>('explorer');

  // Explorer & View Filter State
  const [docView, setDocView] = useState<'explorer' | 'favorites' | 'recent' | 'trash'>('explorer');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Phase 2F: Advanced Search, Filter, Sort & Pagination State
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedFolderScope, setSelectedFolderScope] = useState<'current' | 'all'>('current');
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatus | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<string | null>(null);
  const [selectedSizePreset, setSelectedSizePreset] = useState<string | null>(null);
  const [createdFrom, setCreatedFrom] = useState<string | null>(null);
  const [createdTo, setCreatedTo] = useState<string | null>(null);
  const [updatedFrom, setUpdatedFrom] = useState<string | null>(null);
  const [updatedTo, setUpdatedTo] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<DocumentSortBy>('updatedAt');
  const [sortOrder, setSortOrder] = useState<DocumentSortOrder>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [orgUsers, setOrgUsers] = useState<User[]>([]);

  // View Switcher (List vs Grid)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      return (localStorage.getItem('docuflow_doc_view_mode') as 'list' | 'grid') || 'list';
    } catch {
      return 'list';
    }
  });

  const handleSetViewMode = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    try {
      localStorage.setItem('docuflow_doc_view_mode', mode);
    } catch {}
  };

  // Phase 2D: Bulk Operations State
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isBulkAddTagOpen, setIsBulkAddTagOpen] = useState(false);
  const [bulkTagId, setBulkTagId] = useState('');
  const [isBulkRemoveTagOpen, setIsBulkRemoveTagOpen] = useState(false);
  const [bulkRemoveTagId, setBulkRemoveTagId] = useState('');
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState<string | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkArchiveOpen, setIsBulkArchiveOpen] = useState(false);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Phase 2D: Document Metadata Editing State
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [metadataFormValues, setMetadataFormValues] = useState<Record<string, unknown>>({});
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({});
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  // Phase 2D: Tag Management on Document & Global
  const [isAddingDocTag, setIsAddingDocTag] = useState(false);
  const [selectedDocTagId, setSelectedDocTagId] = useState('');
  const [inlineNewTagName, setInlineNewTagName] = useState('');
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [isDeleteTagOpen, setIsDeleteTagOpen] = useState(false);

  // Selected Item for Detail / Drawer
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'versions' | 'comments' | 'activity'>('details');
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<DocumentVersion | null>(null);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

  // Comments State
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);

  // Activity Log State
  const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // Text Viewer Modal State
  const [isTextViewerOpen, setIsTextViewerOpen] = useState(false);
  const [textViewerDocId, setTextViewerDocId] = useState<string | null>(null);
  const [textViewerDocName, setTextViewerDocName] = useState<string>('');
  const [textViewerVersionNumber, setTextViewerVersionNumber] = useState<number | null>(null);

  // Permanent Delete Modal State
  const [docToPurge, setDocToPurge] = useState<Document | null>(null);
  const [isPurgingDoc, setIsPurgingDoc] = useState(false);

  // Permission checks
  const canDelete = Boolean(
    user.permissions?.includes('documents.delete') ||
    user.roles?.some((r) => r.name === 'SUPER_ADMIN' || r.name === 'ORG_ADMIN')
  );

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

  // Phase 2B: Real Upload Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadInitialFiles, setUploadInitialFiles] = useState<File[]>([]);
  const [isVersionUploadOpen, setIsVersionUploadOpen] = useState(false);

  // Debounce search query
  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
      setIsSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch metadata: folders, types, tags, users
  const fetchMetadata = async () => {
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

      try {
        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();
        if (usersData.success) {
          setOrgUsers(usersData.data || []);
        }
      } catch {
        // Non-admin may not have users.read
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Fetch server-side filtered, sorted, paginated documents
  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (docView !== 'explorer') {
        params.set('view', docView);
      } else {
        if (selectedFolderScope === 'current') {
          params.set('folderId', currentFolderId === null ? 'null' : currentFolderId);
        } else {
          params.set('folderId', 'all');
        }
      }

      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }
      if (selectedDocumentTypeId) {
        params.set('documentTypeId', selectedDocumentTypeId);
      }
      if (selectedStatus) {
        params.set('status', selectedStatus);
      }
      if (selectedOwnerId) {
        params.set('ownerId', selectedOwnerId);
      }
      if (selectedTagFilter) {
        params.set('tagId', selectedTagFilter);
      }
      if (selectedFileType) {
        params.set('fileType', selectedFileType);
      }
      if (selectedSizePreset) {
        if (selectedSizePreset === '<1MB') params.set('maxSize', '1048576');
        else if (selectedSizePreset === '1-10MB') {
          params.set('minSize', '1048576');
          params.set('maxSize', '10485760');
        } else if (selectedSizePreset === '10-50MB') {
          params.set('minSize', '10485760');
          params.set('maxSize', '52428800');
        } else if (selectedSizePreset === '>50MB') {
          params.set('minSize', '52428800');
        }
      }
      if (createdFrom) params.set('createdFrom', createdFrom);
      if (createdTo) params.set('createdTo', createdTo);
      if (updatedFrom) params.set('updatedFrom', updatedFrom);
      if (updatedTo) params.set('updatedTo', updatedTo);

      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/documents?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.data || []);
        if (data.pagination) {
          setPaginationMeta(data.pagination);
        }
      }
    } catch {
      addToast('Failed to load document records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [
    docView,
    currentFolderId,
    selectedFolderScope,
    debouncedSearch,
    selectedDocumentTypeId,
    selectedStatus,
    selectedOwnerId,
    selectedTagFilter,
    selectedFileType,
    selectedSizePreset,
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo,
    sortBy,
    sortOrder,
    page,
    pageSize,
  ]);

  const fetchData = async () => {
    await Promise.all([fetchMetadata(), fetchDocuments()]);
  };

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchData();
    }
  }, [refreshTrigger]);

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedDocumentTypeId(null);
    setSelectedStatus(null);
    setSelectedOwnerId(null);
    setSelectedTagFilter(null);
    setSelectedFileType(null);
    setSelectedSizePreset(null);
    setCreatedFrom(null);
    setCreatedTo(null);
    setUpdatedFrom(null);
    setUpdatedTo(null);
    setSelectedFolderScope('current');
    setPage(1);
  };

  const handleToggleSort = (field: DocumentSortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
    setPage(1);
  };

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

  // Load versions, comments, and activity for selected document
  const selectDocument = async (doc: Document) => {
    setSelectedDoc(doc);
    loadVersions(doc);
    loadComments(doc.id);
    loadActivity(doc.id);
  };

  const loadVersions = async (doc: Document) => {
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

  const loadComments = async (docId: string) => {
    setIsLoadingComments(true);
    try {
      const res = await fetch(`/api/documents/${docId}/comments`);
      const data = await res.json();
      if (data.success) {
        setComments(data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingComments(false);
    }
  };

  const loadActivity = async (docId: string) => {
    setIsLoadingActivity(true);
    try {
      const res = await fetch(`/api/documents/${docId}/activity`);
      const data = await res.json();
      if (data.success) {
        setActivityLogs(data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !newCommentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newCommentText.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to post comment');

      setNewCommentText('');
      addToast('Comment added', 'success');
      loadComments(selectedDoc.id);
      loadActivity(selectedDoc.id);
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/comments/${commentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to delete comment');

      addToast('Comment deleted', 'success');
      loadComments(selectedDoc.id);
      loadActivity(selectedDoc.id);
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleStartEditComment = (comment: DocumentComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!selectedDoc || !editingCommentText.trim()) return;
    setIsUpdatingComment(true);
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingCommentText.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to update comment');

      setEditingCommentId(null);
      setEditingCommentText('');
      addToast('Comment updated', 'success');
      loadComments(selectedDoc.id);
      loadActivity(selectedDoc.id);
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setIsUpdatingComment(false);
    }
  };

  // Phase 2C: Favorite Toggle
  const handleToggleFavorite = async (docId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`/api/documents/${docId}/favorite`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, isFavorite: data.isFavorite } : d))
        );
        if (selectedDoc?.id === docId) {
          setSelectedDoc((prev) => (prev ? { ...prev, isFavorite: data.isFavorite } : null));
        }
        addToast(data.isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
      }
    } catch {
      addToast('Failed to update favorite', 'error');
    }
  };

  // Phase 2C: Restore Document from Trash
  const handleRestoreDocument = async (doc: Document, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`/api/documents/${doc.id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to restore document');

      addToast(`"${doc.name}" restored successfully`, 'success');
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  // Phase 2E: Permanently Purge Document Modal Trigger
  const handlePurgeDocument = (doc: Document, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDocToPurge(doc);
  };

  const handleConfirmPurgeDocument = async () => {
    if (!docToPurge) return;
    setIsPurgingDoc(true);
    try {
      const res = await fetch(`/api/documents/${docToPurge.id}/permanent`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to permanently delete');

      addToast(`"${docToPurge.name}" permanently deleted`, 'success');
      if (selectedDoc?.id === docToPurge.id) setSelectedDoc(null);
      setDocToPurge(null);
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setIsPurgingDoc(false);
    }
  };

  // Phase 2C: Text Viewer
  const handleOpenTextViewer = (doc: Document, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTextViewerDocId(doc.id);
    setTextViewerDocName(doc.name);
    setIsTextViewerOpen(true);
  };

  // Phase 2B: File Download & Access Handlers
  const handleDownloadFile = (docId: string, versionNumber?: number) => {
    const url = `/api/documents/${docId}/download${versionNumber ? `?version=${versionNumber}` : ''}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('File download started', 'info');
  };

  const handlePreviewFile = (docId: string, versionNumber?: number) => {
    const url = `/api/documents/${docId}/preview${versionNumber ? `?version=${versionNumber}` : ''}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopySignedLink = async (docId: string, versionNumber?: number) => {
    try {
      const url = `/api/documents/${docId}/signed-url${versionNumber ? `?version=${versionNumber}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data?.url) {
        const fullUrl = `${window.location.origin}${data.data.url}`;
        await navigator.clipboard.writeText(fullUrl);
        addToast('Secure signed link copied to clipboard (valid for 15 min)', 'success');
      } else {
        throw new Error(data.message || 'Failed to generate signed link');
      }
    } catch (err) {
      addToast('Could not generate signed link', 'error');
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

  const handleRestoreVersion = (ver: DocumentVersion) => {
    setVersionToRestore(ver);
  };

  const handleConfirmRestoreVersion = async () => {
    if (!selectedDoc || !versionToRestore) return;
    setIsRestoringVersion(true);
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/versions/${versionToRestore.versionNumber}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to restore version');

      addToast(`Restored from v${versionToRestore.versionNumber} as new version v${data.data.versionNumber}`, 'success');
      setVersionToRestore(null);
      loadVersions(selectedDoc);
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setIsRestoringVersion(false);
    }
  };

  const handlePreviewVersion = (doc: Document, versionNumber?: number) => {
    setTextViewerDocId(doc.id);
    setTextViewerDocName(doc.name);
    setTextViewerVersionNumber(versionNumber || null);
    setIsTextViewerOpen(true);
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

  // --------------------------------------------------------------------
  // Phase 2D: Bulk Selection & Actions
  // --------------------------------------------------------------------
  const handleToggleSelectDoc = (docId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAllVisible = () => {
    if (selectedDocIds.length === currentDocs.length && currentDocs.length > 0) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(currentDocs.map((d) => d.id));
    }
  };

  const handleExecuteBulkAction = async (action: 'add-tag' | 'remove-tag' | 'move' | 'delete' | 'archive') => {
    if (selectedDocIds.length === 0) return;
    setIsSubmittingBulk(true);

    try {
      const payload: Record<string, unknown> = {
        action,
        documentIds: selectedDocIds,
      };

      if (action === 'add-tag') {
        if (!bulkTagId) throw new Error('Please select a tag to assign');
        payload.tagId = bulkTagId;
      } else if (action === 'remove-tag') {
        if (!bulkRemoveTagId) throw new Error('Please select a tag to remove');
        payload.tagId = bulkRemoveTagId;
      } else if (action === 'move') {
        payload.targetFolderId = bulkTargetFolderId;
      }

      const res = await fetch('/api/documents/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || data.message || 'Bulk operation failed');

      addToast(`Bulk ${action.replace('-', ' ')} completed for ${data.data?.affectedCount || selectedDocIds.length} document(s)`, 'success');
      setSelectedDocIds([]);
      setIsBulkAddTagOpen(false);
      setIsBulkRemoveTagOpen(false);
      setIsBulkMoveOpen(false);
      setIsBulkDeleteOpen(false);
      setIsBulkArchiveOpen(false);
      await fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // --------------------------------------------------------------------
  // Phase 2D: Document Metadata Dynamic Editing
  // --------------------------------------------------------------------
  const handleStartEditMetadata = () => {
    if (!selectedDoc) return;
    const initialValues: Record<string, unknown> = { ...(selectedDoc.metadata || {}) };
    setMetadataFormValues(initialValues);
    setMetadataErrors({});
    setIsEditingMetadata(true);
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;

    // Validate required fields
    const docType = documentTypes.find((dt) => dt.id === selectedDoc.documentTypeId);
    const errors: Record<string, string> = {};

    if (docType?.fields) {
      for (const field of docType.fields) {
        if (field.required) {
          const val = metadataFormValues[field.key];
          if (val === undefined || val === null || val === '') {
            errors[field.key] = `${field.name} is required`;
          } else if (Array.isArray(val) && val.length === 0) {
            errors[field.key] = `${field.name} is required`;
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setMetadataErrors(errors);
      addToast('Please fill in all required metadata fields', 'error');
      return;
    }

    setIsSavingMetadata(true);
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: metadataFormValues }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || data.message || 'Failed to save metadata');

      addToast('Document metadata updated', 'success');
      setSelectedDoc((prev) => (prev ? { ...prev, metadata: data.data } : null));
      setDocuments((prev) =>
        prev.map((d) => (d.id === selectedDoc.id ? { ...d, metadata: data.data } : d))
      );
      setIsEditingMetadata(false);
      setMetadataErrors({});
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleUpdateDocumentType = async (newTypeId: string) => {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentTypeId: newTypeId || null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to update document type');

      addToast('Document classification updated', 'success');
      setSelectedDoc(data.data);
      setDocuments((prev) => prev.map((d) => (d.id === selectedDoc.id ? data.data : d)));
      setIsEditingMetadata(false);
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  // --------------------------------------------------------------------
  // Phase 2D: Tags Management on Document
  // --------------------------------------------------------------------
  const handleAssignTagToDoc = async (tagId: string) => {
    if (!selectedDoc || !tagId) return;
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to assign tag');

      addToast('Tag assigned', 'success');
      const tagObj = tags.find((t) => t.id === tagId);
      if (tagObj) {
        const updatedTags = [...(selectedDoc.tags || []), tagObj];
        setSelectedDoc({ ...selectedDoc, tags: updatedTags });
        setDocuments((prev) =>
          prev.map((d) => (d.id === selectedDoc.id ? { ...d, tags: updatedTags } : d))
        );
      }
      setIsAddingDocTag(false);
      setSelectedDocTagId('');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleCreateAndAssignTag = async () => {
    if (!selectedDoc || !inlineNewTagName.trim()) return;
    try {
      const tagRes = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inlineNewTagName.trim() }),
      });
      const tagData = await tagRes.json();
      if (!tagData.success) throw new Error(tagData.message || 'Failed to create tag');

      const createdTag: Tag = tagData.data;
      setTags((prev) => (prev.some((t) => t.id === createdTag.id) ? prev : [...prev, createdTag]));

      await handleAssignTagToDoc(createdTag.id);
      setInlineNewTagName('');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleRemoveTagFromDoc = async (docId: string, tagId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`/api/documents/${docId}/tags/${tagId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to remove tag');

      addToast('Tag removed', 'success');
      if (selectedDoc?.id === docId) {
        const updatedTags = (selectedDoc.tags || []).filter((t) => t.id !== tagId);
        setSelectedDoc({ ...selectedDoc, tags: updatedTags });
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, tags: updatedTags } : d))
        );
      }
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;
    try {
      const res = await fetch(`/api/tags/${tagToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to delete tag');

      addToast(`Tag "${tagToDelete.name}" deleted`, 'success');
      setIsDeleteTagOpen(false);
      setTagToDelete(null);
      await fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  // Folder list in explorer view (shown when at folder root/subfolder and not in multi-folder search)
  const isSearchOrFilterActive =
    Boolean(debouncedSearch.trim()) ||
    Boolean(selectedDocumentTypeId) ||
    Boolean(selectedStatus) ||
    Boolean(selectedOwnerId) ||
    Boolean(selectedTagFilter) ||
    Boolean(selectedFileType) ||
    Boolean(selectedSizePreset) ||
    Boolean(createdFrom || createdTo) ||
    Boolean(updatedFrom || updatedTo);

  const currentFolders =
    docView === 'explorer' && !isSearchOrFilterActive && selectedFolderScope === 'current'
      ? folders.filter((f) => f.parentFolderId === currentFolderId)
      : [];

  // Documents are returned pre-filtered, sorted, and paginated from the server
  const currentDocs = documents;

  // Active filter items for pills / badges display
  const activeFilterList: { id: string; label: string; onRemove: () => void }[] = [];
  if (searchQuery.trim()) {
    activeFilterList.push({
      id: 'search',
      label: `Search: "${searchQuery.trim()}"`,
      onRemove: () => {
        setSearchQuery('');
        setDebouncedSearch('');
      },
    });
  }
  if (selectedDocumentTypeId) {
    const typeName = documentTypes.find((t) => t.id === selectedDocumentTypeId)?.name || selectedDocumentTypeId;
    activeFilterList.push({
      id: 'type',
      label: `Type: ${typeName}`,
      onRemove: () => setSelectedDocumentTypeId(null),
    });
  }
  if (selectedStatus) {
    activeFilterList.push({
      id: 'status',
      label: `Status: ${selectedStatus}`,
      onRemove: () => setSelectedStatus(null),
    });
  }
  if (selectedOwnerId) {
    const owner = orgUsers.find((u) => u.id === selectedOwnerId);
    const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.trim() || owner.email : selectedOwnerId;
    activeFilterList.push({
      id: 'owner',
      label: `Owner: ${ownerName}`,
      onRemove: () => setSelectedOwnerId(null),
    });
  }
  if (selectedTagFilter) {
    const tagName = tags.find((t) => t.id === selectedTagFilter)?.name || selectedTagFilter;
    activeFilterList.push({
      id: 'tag',
      label: `Tag: ${tagName}`,
      onRemove: () => setSelectedTagFilter(null),
    });
  }
  if (selectedFileType) {
    activeFilterList.push({
      id: 'fileType',
      label: `File: ${selectedFileType.toUpperCase()}`,
      onRemove: () => setSelectedFileType(null),
    });
  }
  if (selectedSizePreset) {
    activeFilterList.push({
      id: 'size',
      label: `Size: ${selectedSizePreset}`,
      onRemove: () => setSelectedSizePreset(null),
    });
  }
  if (createdFrom || createdTo) {
    activeFilterList.push({
      id: 'createdDate',
      label: `Created: ${createdFrom || 'Start'} to ${createdTo || 'End'}`,
      onRemove: () => {
        setCreatedFrom(null);
        setCreatedTo(null);
      },
    });
  }
  if (updatedFrom || updatedTo) {
    activeFilterList.push({
      id: 'updatedDate',
      label: `Modified: ${updatedFrom || 'Start'} to ${updatedTo || 'End'}`,
      onRemove: () => {
        setUpdatedFrom(null);
        setUpdatedTo(null);
      },
    });
  }
  if (docView === 'explorer' && selectedFolderScope === 'all') {
    activeFilterList.push({
      id: 'scope',
      label: 'Scope: All Folders',
      onRemove: () => setSelectedFolderScope('current'),
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Document Management</h1>
            <Badge variant="info">Phase 2D Active</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Enterprise document storage, hierarchical explorer, custom metadata schemas, tagging, bulk actions & favorites.
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
            <FolderIcon className="h-3.5 w-3.5" /> Documents
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
        <div className="space-y-4">
          {/* Phase 2D View Navigation & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setDocView('explorer');
                  setCurrentFolderId(null);
                  setSelectedTagFilter(null);
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  docView === 'explorer'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <FolderIcon className="h-3.5 w-3.5" /> Folder Explorer
              </button>
              <button
                onClick={() => {
                  setDocView('favorites');
                  setSelectedTagFilter(null);
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  docView === 'favorites'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Star className="h-3.5 w-3.5" /> Starred
              </button>
              <button
                onClick={() => {
                  setDocView('recent');
                  setSelectedTagFilter(null);
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  docView === 'recent'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Clock className="h-3.5 w-3.5" /> Recent
              </button>
              <button
                onClick={() => {
                  setDocView('trash');
                  setSelectedTagFilter(null);
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  docView === 'trash'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" /> Trash
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Folder Scope Toggle (Explorer view only) */}
              {docView === 'explorer' && (
                <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFolderScope('current');
                      setPage(1);
                    }}
                    className={`rounded px-2 py-1 font-medium transition-colors ${
                      selectedFolderScope === 'current'
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Browse documents in current folder"
                  >
                    Current Folder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFolderScope('all');
                      setPage(1);
                    }}
                    className={`rounded px-2 py-1 font-medium transition-colors ${
                      selectedFolderScope === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Search across all organization folders"
                  >
                    All Folders
                  </button>
                </div>
              )}

              {/* Fast Instant Search Bar with Debounce & Clear */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search name, file, tags, type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search documents"
                  className="h-8 rounded-md border border-slate-200 bg-slate-50 pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 sm:w-60"
                />
                {isSearching ? (
                  <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-blue-600" />
                ) : searchQuery ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setDebouncedSearch('');
                      setPage(1);
                    }}
                    className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                    title="Clear search"
                    aria-label="Clear search query"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {/* Filters Toggle Button */}
              <Button
                variant={isFilterPanelOpen || activeFilterList.length > 0 ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                className="h-8 text-xs relative"
                aria-label="Toggle filter panel"
              >
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                <span>Filters</span>
                {activeFilterList.length > 0 && (
                  <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                    {activeFilterList.length}
                  </span>
                )}
              </Button>

              {/* View Switcher: List vs Grid */}
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => handleSetViewMode('list')}
                  className={`rounded p-1 transition-colors ${
                    viewMode === 'list' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                  }`}
                  title="List View"
                  aria-label="List View"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSetViewMode('grid')}
                  className={`rounded p-1 transition-colors ${
                    viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                  }`}
                  title="Grid View"
                  aria-label="Grid View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>

              {docView === 'explorer' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsCreateFolderOpen(true)}>
                    <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> New Folder
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsCreateDocOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Manual Record
                  </Button>
                </>
              )}
              {docView !== 'trash' && (
                <Button variant="primary" size="sm" onClick={() => setIsUploadModalOpen(true)}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Files
                </Button>
              )}
            </div>
          </div>

          {/* Phase 2F: Expandable Advanced Filters Panel */}
          {isFilterPanelOpen && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800">Advanced Document Filters</span>
                </div>
                {activeFilterList.length > 0 && (
                  <button
                    onClick={handleClearAllFilters}
                    className="text-xs text-rose-600 hover:text-rose-800 font-medium transition-colors"
                  >
                    Reset all filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
                {/* Document Type */}
                <div>
                  <label htmlFor="filter-doctype" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Document Type
                  </label>
                  <select
                    id="filter-doctype"
                    value={selectedDocumentTypeId || ''}
                    onChange={(e) => {
                      setSelectedDocumentTypeId(e.target.value || null);
                      setPage(1);
                    }}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">All Document Types</option>
                    {documentTypes.map((dt) => (
                      <option key={dt.id} value={dt.id}>
                        {dt.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label htmlFor="filter-status" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Status
                  </label>
                  <select
                    id="filter-status"
                    value={selectedStatus || ''}
                    onChange={(e) => {
                      setSelectedStatus((e.target.value as DocumentStatus) || null);
                      setPage(1);
                    }}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="PENDING_PROCESSING">PENDING_PROCESSING</option>
                    <option value="PROCESSING">PROCESSING</option>
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label htmlFor="filter-tag" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tag
                  </label>
                  <select
                    id="filter-tag"
                    value={selectedTagFilter || ''}
                    onChange={(e) => {
                      setSelectedTagFilter(e.target.value || null);
                      setPage(1);
                    }}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">All Tags</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Owner */}
                <div>
                  <label htmlFor="filter-owner" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Owner
                  </label>
                  <select
                    id="filter-owner"
                    value={selectedOwnerId || ''}
                    onChange={(e) => {
                      setSelectedOwnerId(e.target.value || null);
                      setPage(1);
                    }}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">All Owners</option>
                    {orgUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {`${u.firstName} ${u.lastName}`.trim() || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Type */}
                <div>
                  <label htmlFor="filter-filetype" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    File Type
                  </label>
                  <select
                    id="filter-filetype"
                    value={selectedFileType || ''}
                    onChange={(e) => {
                      setSelectedFileType(e.target.value || null);
                      setPage(1);
                    }}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">All File Formats</option>
                    <option value="pdf">PDF Documents (.pdf)</option>
                    <option value="word">Word Documents (.docx, .doc)</option>
                    <option value="spreadsheet">Spreadsheets (.xlsx, .csv)</option>
                    <option value="presentation">Presentations (.pptx, .ppt)</option>
                    <option value="image">Images (PNG, JPG, SVG, WebP)</option>
                    <option value="text">Text & Code (.txt, .md, .json)</option>
                    <option value="archive">Archives (.zip, .tar, .gz)</option>
                  </select>
                </div>

                {/* File Size */}
                <div>
                  <label htmlFor="filter-filesize" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    File Size
                  </label>
                  <select
                    id="filter-filesize"
                    value={selectedSizePreset || ''}
                    onChange={(e) => {
                      setSelectedSizePreset(e.target.value || null);
                      setPage(1);
                    }}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">All Sizes</option>
                    <option value="<1MB">&lt; 1 MB</option>
                    <option value="1-10MB">1 MB – 10 MB</option>
                    <option value="10-50MB">10 MB – 50 MB</option>
                    <option value=">50MB">&gt; 50 MB</option>
                  </select>
                </div>

                {/* Created Date From */}
                <div>
                  <label htmlFor="filter-created-from" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Created From
                  </label>
                  <input
                    type="date"
                    id="filter-created-from"
                    value={createdFrom || ''}
                    onChange={(e) => {
                      setCreatedFrom(e.target.value || null);
                      setPage(1);
                    }}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Created Date To */}
                <div>
                  <label htmlFor="filter-created-to" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Created To
                  </label>
                  <input
                    type="date"
                    id="filter-created-to"
                    value={createdTo || ''}
                    onChange={(e) => {
                      setCreatedTo(e.target.value || null);
                      setPage(1);
                    }}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Modified Date From */}
                <div>
                  <label htmlFor="filter-updated-from" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Modified From
                  </label>
                  <input
                    type="date"
                    id="filter-updated-from"
                    value={updatedFrom || ''}
                    onChange={(e) => {
                      setUpdatedFrom(e.target.value || null);
                      setPage(1);
                    }}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Modified Date To */}
                <div>
                  <label htmlFor="filter-updated-to" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Modified To
                  </label>
                  <input
                    type="date"
                    id="filter-updated-to"
                    value={updatedTo || ''}
                    onChange={(e) => {
                      setUpdatedTo(e.target.value || null);
                      setPage(1);
                    }}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Sort By & Order */}
                <div>
                  <label htmlFor="filter-sortby" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Sort By
                  </label>
                  <div className="flex items-center gap-1">
                    <select
                      id="filter-sortby"
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value as DocumentSortBy);
                        setPage(1);
                      }}
                      className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="updatedAt">Modified Date</option>
                      <option value="createdAt">Created Date</option>
                      <option value="name">Name</option>
                      <option value="fileSize">File Size</option>
                      <option value="documentType">Document Type</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        setPage(1);
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 shrink-0"
                      title={sortOrder === 'asc' ? 'Ascending (click for Descending)' : 'Descending (click for Ascending)'}
                      aria-label="Toggle sort order"
                    >
                      {sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Filters Display & Results Count */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
            <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
              {activeFilterList.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-medium text-blue-800"
                >
                  <span>{item.label}</span>
                  <button
                    onClick={item.onRemove}
                    className="rounded-full p-0.5 hover:bg-blue-200 hover:text-blue-900 transition-colors"
                    aria-label={`Remove filter ${item.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              {activeFilterList.length > 1 && (
                <button
                  onClick={handleClearAllFilters}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold underline underline-offset-2 ml-1"
                >
                  Clear all ({activeFilterList.length})
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              {isLoading ? (
                <span className="flex items-center gap-1 text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                </span>
              ) : paginationMeta.total > 0 ? (
                <span>
                  Showing{' '}
                  <strong className="text-slate-700">
                    {Math.min((paginationMeta.page - 1) * paginationMeta.limit + 1, paginationMeta.total)}–
                    {Math.min(paginationMeta.page * paginationMeta.limit, paginationMeta.total)}
                  </strong>{' '}
                  of <strong className="text-slate-700">{paginationMeta.total}</strong> documents
                </span>
              ) : (
                <span>0 documents found</span>
              )}
            </div>
          </div>

          {/* Phase 2D: Sticky Bulk Actions Toolbar */}
          {selectedDocIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 text-white p-3 shadow-md">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-white bg-blue-600 px-2 py-0.5 rounded">
                  {selectedDocIds.length} Selected
                </span>
                <button
                  onClick={handleSelectAllVisible}
                  className="text-[11px] text-slate-300 hover:text-white underline underline-offset-2 ml-1"
                >
                  {selectedDocIds.length === currentDocs.length ? 'Deselect All' : `Select All (${currentDocs.length})`}
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                  onClick={() => {
                    setBulkTagId(tags[0]?.id || '');
                    setIsBulkAddTagOpen(true);
                  }}
                >
                  <TagIcon className="h-3 w-3 mr-1" /> Add Tag
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                  onClick={() => {
                    setBulkRemoveTagId(tags[0]?.id || '');
                    setIsBulkRemoveTagOpen(true);
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Remove Tag
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                  onClick={() => {
                    setBulkTargetFolderId(null);
                    setIsBulkMoveOpen(true);
                  }}
                >
                  <FolderInput className="h-3 w-3 mr-1" /> Move
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                  onClick={() => setIsBulkArchiveOpen(true)}
                >
                  <Archive className="h-3 w-3 mr-1" /> Archive
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  onClick={() => setIsBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={() => setSelectedDocIds([])}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Trash Recovery Banner */}
          {docView === 'trash' && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">Trash & Document Recovery</p>
                <p className="text-amber-700">
                  Documents in trash can be restored back to your active workspace or permanently purged.
                </p>
              </div>
            </div>
          )}

          {/* Main Content Layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Main Documents & Folders Column */}
            <div className={`${selectedDoc ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
              {/* Breadcrumb Path (for Explorer mode) */}
              {docView === 'explorer' && (
                <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 text-xs font-medium text-slate-600 shadow-2xs">
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
              )}

              {/* Quick Folder Intake Drop-Zone Component */}
              {docView !== 'trash' && (
                <DocumentDropZone
                  compact
                  folderName={folderPath.length > 0 ? folderPath[folderPath.length - 1].name : 'Root Folder'}
                  onFilesDropped={(files) => {
                    setUploadInitialFiles(files);
                    setIsUploadModalOpen(true);
                  }}
                  title="Drop documents here to upload directly to this folder, or click to browse"
                  description="Fast document intake directly into current folder hierarchy."
                />
              )}

              {/* Content List */}
              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-8 text-center text-xs text-slate-500">Loading document records...</div>
                  ) : currentFolders.length === 0 && currentDocs.length === 0 ? (
                    <div className="p-8">
                      {activeFilterList.length > 0 ? (
                        <EmptyState
                          icon={<Search className="h-8 w-8 text-slate-400" />}
                          title="No matching documents found"
                          description="No documents match your active search terms or filter criteria. Try adjusting your query or resetting filters."
                          action={
                            <div className="flex items-center gap-2 justify-center">
                              <Button size="sm" variant="outline" onClick={handleClearAllFilters}>
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Clear all filters
                              </Button>
                            </div>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={
                            docView === 'trash' ? (
                              <Trash2 className="h-8 w-8 text-slate-400" />
                            ) : docView === 'favorites' ? (
                              <Star className="h-8 w-8 text-amber-400" />
                            ) : (
                              <FolderIcon className="h-8 w-8 text-slate-400" />
                            )
                          }
                          title={
                            docView === 'trash'
                              ? 'Trash is empty'
                              : docView === 'favorites'
                              ? 'No starred documents'
                              : docView === 'recent'
                              ? 'No recent documents'
                              : 'This folder is empty'
                          }
                          description={
                            docView === 'trash'
                              ? 'No deleted documents found.'
                              : docView === 'favorites'
                              ? 'Click the star icon on any document to add it to your favorites.'
                              : 'Upload files or create subfolders to start organizing documents.'
                          }
                          action={
                            docView === 'explorer' ? (
                              <div className="flex items-center gap-2 justify-center">
                                <Button size="sm" variant="outline" onClick={() => setIsCreateFolderOpen(true)}>
                                  <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> New Folder
                                </Button>
                                <Button size="sm" onClick={() => setIsUploadModalOpen(true)}>
                                  <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Files
                                </Button>
                              </div>
                            ) : undefined
                          }
                        />
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {/* Folders List (only in Explorer mode) */}
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

                      {/* Documents View: List or Grid */}
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                          {currentDocs.map((doc) => {
                            const isSelected = selectedDoc?.id === doc.id;
                            const isChecked = selectedDocIds.includes(doc.id);
                            return (
                              <div
                                key={doc.id}
                                onClick={() => selectDocument(doc)}
                                className={`group relative rounded-lg border p-3.5 transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                                    : isChecked
                                    ? 'border-blue-300 bg-blue-50/20'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                                }`}
                              >
                                <div>
                                  {/* Card Top: Checkbox, Type Badge, Star */}
                                  <div className="flex items-center justify-between gap-1 mb-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          handleToggleSelectDoc(doc.id);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        title="Select for bulk action"
                                      />
                                      {doc.documentType ? (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 truncate max-w-[120px]">
                                          {doc.documentType.name}
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                          v{doc.versions?.[0]?.versionNumber || 1}
                                        </Badge>
                                      )}
                                      {doc.status === 'DELETED' && (
                                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                          In Trash
                                        </Badge>
                                      )}
                                    </div>

                                    {docView !== 'trash' && (
                                      <button
                                        onClick={(e) => handleToggleFavorite(doc.id, e)}
                                        className={`rounded p-1 transition-colors hover:bg-slate-100 ${
                                          doc.isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                                        }`}
                                        title={doc.isFavorite ? 'Starred' : 'Add to Starred'}
                                      >
                                        <Star className={`h-4 w-4 ${doc.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                                      </button>
                                    )}
                                  </div>

                                  {/* Card Body: Icon & Name */}
                                  <div className="flex items-start gap-2.5 my-1.5">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                                      <FileText className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h3 className="text-xs font-bold text-slate-900 truncate" title={doc.name}>
                                        {doc.name}
                                      </h3>
                                      <p className="text-[11px] text-slate-400 truncate mt-0.5" title={doc.originalFileName}>
                                        {doc.originalFileName}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Tags or Trash Details */}
                                  {docView === 'trash' ? (
                                    <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] space-y-0.5 text-slate-600 bg-slate-50/70 p-2 rounded">
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Deleted by:</span>
                                        <span className="font-semibold text-slate-800">
                                          {doc.deletedBy ? `${doc.deletedBy.firstName} ${doc.deletedBy.lastName}`.trim() || doc.deletedBy.email : 'Unknown'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Deleted date:</span>
                                        <span className="font-semibold text-slate-800">{doc.deletedAt ? formatDateTime(doc.deletedAt) : 'N/A'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Original folder:</span>
                                        <span className="font-semibold text-slate-800">{doc.folder?.name || 'Root'}</span>
                                      </div>
                                    </div>
                                  ) : doc.tags && doc.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {doc.tags.slice(0, 3).map((t) => (
                                        <Badge key={t.id} variant="secondary" className="text-[9px] px-1">
                                          {t.name}
                                        </Badge>
                                      ))}
                                      {doc.tags.length > 3 && (
                                        <span className="text-[9px] text-slate-400 font-medium self-center">
                                          +{doc.tags.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  ) : null}
                                </div>

                                {/* Card Footer: Metadata & Quick Actions */}
                                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                  <span>{formatBytes(doc.fileSize)}</span>

                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                    {docView === 'trash' ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-[10px] text-emerald-700 px-1.5"
                                          onClick={(e) => handleRestoreDocument(doc, e)}
                                        >
                                          Restore
                                        </Button>
                                        {canDelete && (
                                          <Button
                                            size="sm"
                                            variant="danger"
                                            className="h-6 text-[10px] px-1.5"
                                            onClick={(e) => handlePurgeDocument(doc, e)}
                                          >
                                            Permanently Delete
                                          </Button>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={(e) => handleOpenTextViewer(doc, e)}
                                          className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                          title="View Text"
                                        >
                                          <FileCode2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDownloadFile(doc.id)}
                                          className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                          title="Download"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handlePreviewFile(doc.id)}
                                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                          title="Preview"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteDocument(doc)}
                                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                          title="Move to Trash"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* List Mode */
                        <div>
                          {currentDocs.length > 0 && docView !== 'trash' && (
                            <div className="hidden sm:grid grid-cols-12 gap-3 px-3.5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100 items-center select-none">
                              <div className="col-span-6 flex items-center gap-1.5 pl-7">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSort('name')}
                                  className="flex items-center gap-1 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 rounded px-1 -ml-1 transition-colors"
                                  aria-label="Sort by Document Name"
                                >
                                  <span>Document Name</span>
                                  {sortBy === 'name' ? (
                                    sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3 text-slate-300" />
                                  )}
                                </button>
                              </div>
                              <div className="col-span-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSort('fileSize')}
                                  className="flex items-center gap-1 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 rounded px-1 -ml-1 transition-colors"
                                  aria-label="Sort by File Size"
                                >
                                  <span>Size</span>
                                  {sortBy === 'fileSize' || sortBy === 'size' ? (
                                    sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3 text-slate-300" />
                                  )}
                                </button>
                              </div>
                              <div className="col-span-4 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSort('updatedAt')}
                                  className="flex items-center gap-1 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 rounded px-1 -ml-1 transition-colors"
                                  aria-label="Sort by Modified Date"
                                >
                                  <span>Modified</span>
                                  {sortBy === 'updatedAt' || sortBy === 'modified' ? (
                                    sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3 text-slate-300" />
                                  )}
                                </button>
                                <span className="pr-2 font-normal text-slate-400">Actions</span>
                              </div>
                            </div>
                          )}
                          <div className="divide-y divide-slate-100">
                          {currentDocs.map((doc) => {
                          const isSelected = selectedDoc?.id === doc.id;
                          const isChecked = selectedDocIds.includes(doc.id);
                          return (
                            <div
                              key={doc.id}
                              className={`group flex items-center justify-between p-3.5 transition-colors cursor-pointer ${
                                isSelected ? 'bg-blue-50/70 border-l-2 border-blue-600' : isChecked ? 'bg-blue-50/30' : 'hover:bg-slate-50'
                              }`}
                              onClick={() => selectDocument(doc)}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                                {/* Bulk Selection Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleSelectDoc(doc.id);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                  title="Select for bulk action"
                                />

                                {/* Star / Favorite Button */}
                                {docView !== 'trash' && (
                                  <button
                                    onClick={(e) => handleToggleFavorite(doc.id, e)}
                                    className={`rounded p-1 transition-colors hover:bg-slate-100 shrink-0 ${
                                      doc.isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                                    }`}
                                    title={doc.isFavorite ? 'Starred' : 'Add to Starred'}
                                  >
                                    <Star
                                      className={`h-4 w-4 ${doc.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`}
                                    />
                                  </button>
                                )}

                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-900 truncate">{doc.name}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      v{doc.versions?.[0]?.versionNumber || 1}
                                    </Badge>
                                    {doc.documentType && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        {doc.documentType.name}
                                      </Badge>
                                    )}
                                    {doc.status === 'DELETED' && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                        In Trash
                                      </Badge>
                                    )}
                                  </div>
                                  {docView === 'trash' ? (
                                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-slate-500">
                                      <span>Original folder: <strong className="text-slate-700">{doc.folder?.name || 'Root'}</strong></span>
                                      <span>•</span>
                                      <span>Deleted date: <strong className="text-slate-700">{doc.deletedAt ? formatDateTime(doc.deletedAt) : 'N/A'}</strong></span>
                                      <span>•</span>
                                      <span>Deleted by: <strong className="text-slate-700">{doc.deletedBy ? `${doc.deletedBy.firstName} ${doc.deletedBy.lastName}`.trim() || doc.deletedBy.email : 'Unknown'}</strong></span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                      <span>{doc.originalFileName}</span>
                                      <span>•</span>
                                      <span>{formatBytes(doc.fileSize)}</span>
                                      <span>•</span>
                                      <span>{formatDateTime(doc.updatedAt)}</span>
                                      {doc.tags && doc.tags.length > 0 && (
                                        <>
                                          <span>•</span>
                                          <div className="flex items-center gap-1">
                                            {doc.tags.slice(0, 2).map((t) => (
                                              <Badge key={t.id} variant="secondary" className="text-[9px] px-1 py-0">
                                                {t.name}
                                              </Badge>
                                            ))}
                                            {doc.tags.length > 2 && (
                                              <span className="text-[9px] text-slate-400">+{doc.tags.length - 2}</span>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Quick Actions */}
                              <div
                                className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {docView === 'trash' ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                                      onClick={(e) => handleRestoreDocument(doc, e)}
                                    >
                                      <RotateCcw className="mr-1 h-3 w-3" /> Restore
                                    </Button>
                                    {canDelete && (
                                      <Button
                                        size="sm"
                                        variant="danger"
                                        className="h-7 text-xs px-2"
                                        onClick={(e) => handlePurgeDocument(doc, e)}
                                      >
                                        <Trash2 className="mr-1 h-3 w-3" /> Permanently Delete
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => handleOpenTextViewer(doc, e)}
                                      className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                      title="View Text / Code"
                                    >
                                      <FileCode2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDownloadFile(doc.id)}
                                      className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                      title="Download File"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handlePreviewFile(doc.id)}
                                      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                      title="Preview in Tab"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </button>
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
                                      title="Move to Trash"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

                  {/* Pagination Controls */}
                  {paginationMeta.total > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>Per page:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setPage(1);
                          }}
                          className="h-7 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                          aria-label="Items per page"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <span className="hidden sm:inline text-slate-400">|</span>
                        <span>
                          Page <strong className="text-slate-800">{paginationMeta.page}</strong> of{' '}
                          <strong className="text-slate-800">{paginationMeta.totalPages}</strong> ({paginationMeta.total} total)
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPage(1)}
                          disabled={!paginationMeta.hasPrev}
                          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="First page"
                          aria-label="First page"
                        >
                          <ChevronsLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={!paginationMeta.hasPrev}
                          className="flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Previous page"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          <span>Previous</span>
                        </button>

                        {/* Page Numbers */}
                        <div className="flex items-center gap-1 px-1">
                          {Array.from({ length: Math.min(5, paginationMeta.totalPages) }, (_, i) => {
                            let pNum: number;
                            if (paginationMeta.totalPages <= 5) {
                              pNum = i + 1;
                            } else if (paginationMeta.page <= 3) {
                              pNum = i + 1;
                            } else if (paginationMeta.page >= paginationMeta.totalPages - 2) {
                              pNum = paginationMeta.totalPages - 4 + i;
                            } else {
                              pNum = paginationMeta.page - 2 + i;
                            }
                            return (
                              <button
                                key={pNum}
                                type="button"
                                onClick={() => setPage(pNum)}
                                className={`flex h-7 w-7 items-center justify-center rounded text-xs font-semibold transition-colors ${
                                  paginationMeta.page === pNum
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                                aria-label={`Go to page ${pNum}`}
                                aria-current={paginationMeta.page === pNum ? 'page' : undefined}
                              >
                                {pNum}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(paginationMeta.totalPages, p + 1))}
                          disabled={!paginationMeta.hasNext}
                          className="flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Next page"
                          aria-label="Next page"
                        >
                          <span>Next</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage(paginationMeta.totalPages)}
                          disabled={!paginationMeta.hasNext}
                          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Last page"
                          aria-label="Last page"
                        >
                          <ChevronsRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={(e) => handleToggleFavorite(selectedDoc.id, e)}
                        className={`rounded p-1 transition-colors hover:bg-slate-100 ${
                          selectedDoc.isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                        }`}
                        title={selectedDoc.isFavorite ? 'Starred' : 'Add to Starred'}
                      >
                        <Star
                          className={`h-4 w-4 ${selectedDoc.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`}
                        />
                      </button>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-bold truncate max-w-[180px]">
                          {selectedDoc.name}
                        </CardTitle>
                        <CardDescription className="text-3xs truncate">
                          {selectedDoc.originalFileName}
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(null)}>
                      ✕
                    </Button>
                  </CardHeader>

                  {/* Drawer Tabs */}
                  <div className="flex border-b border-slate-200 px-4">
                    <button
                      onClick={() => setDrawerTab('details')}
                      className={`border-b-2 py-2 px-2.5 text-xs font-semibold transition-colors ${
                        drawerTab === 'details'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setDrawerTab('versions')}
                      className={`border-b-2 py-2 px-2.5 text-xs font-semibold transition-colors ${
                        drawerTab === 'versions'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Versions ({versions.length})
                    </button>
                    <button
                      onClick={() => setDrawerTab('comments')}
                      className={`border-b-2 py-2 px-2.5 text-xs font-semibold transition-colors ${
                        drawerTab === 'comments'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Comments ({comments.length})
                    </button>
                    <button
                      onClick={() => setDrawerTab('activity')}
                      className={`border-b-2 py-2 px-2.5 text-xs font-semibold transition-colors ${
                        drawerTab === 'activity'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Activity
                    </button>
                  </div>

                  <CardContent className="space-y-4 pt-3 text-xs">
                    {/* DETAILS TAB */}
                    {drawerTab === 'details' && (
                      <div className="space-y-3">
                        {/* File Metadata */}
                        <div className="space-y-1.5 rounded-md bg-slate-50 p-3 border border-slate-100">
                          <div className="flex justify-between">
                            <span className="text-slate-500">MIME Type:</span>
                            <span className="font-mono text-slate-700">{selectedDoc.mimeType}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">File Size:</span>
                            <span className="text-slate-700">{formatBytes(selectedDoc.fileSize)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Status:</span>
                            <Badge
                              variant={selectedDoc.status === 'ACTIVE' ? 'success' : 'secondary'}
                              className="text-[9px] px-1.5"
                            >
                              {selectedDoc.status}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Storage Key:</span>
                            <span className="font-mono text-slate-600 truncate max-w-[150px]" title={selectedDoc.storageKey}>
                              {selectedDoc.storageKey}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">SHA256 Checksum:</span>
                            <span className="font-mono text-slate-600 truncate max-w-[140px]" title={selectedDoc.checksum}>
                              {selectedDoc.checksum.substring(0, 16)}...
                            </span>
                          </div>
                        </div>

                        {/* File Access & Operations Bar */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <Button
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => handleDownloadFile(selectedDoc.id)}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => handlePreviewFile(selectedDoc.id)}
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                            onClick={(e) => handleOpenTextViewer(selectedDoc, e)}
                          >
                            <FileCode className="mr-1.5 h-3.5 w-3.5" /> View Text
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => handleCopySignedLink(selectedDoc.id)}
                            title="Copy temporary signed URL (valid 15m)"
                          >
                            <Link2 className="mr-1.5 h-3.5 w-3.5" /> Signed Link
                          </Button>
                        </div>

                        {/* Assigned Tags */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700 text-xs">Tags</span>
                            <button
                              type="button"
                              onClick={() => setIsAddingDocTag(!isAddingDocTag)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> {isAddingDocTag ? 'Cancel' : 'Add Tag'}
                            </button>
                          </div>

                          {/* Inline tag addition */}
                          {isAddingDocTag && (
                            <div className="p-2 rounded-md bg-slate-50 border border-slate-200 space-y-2">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={selectedDocTagId}
                                  onChange={(e) => setSelectedDocTagId(e.target.value)}
                                  className="flex-1 h-7 text-xs rounded border border-slate-300 bg-white px-2"
                                >
                                  <option value="">Select existing tag...</option>
                                  {tags
                                    .filter((t) => !selectedDoc.tags?.some((st) => st.id === t.id))
                                    .map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name}
                                      </option>
                                    ))}
                                </select>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-2"
                                  disabled={!selectedDocTagId}
                                  onClick={() => handleAssignTagToDoc(selectedDocTagId)}
                                >
                                  Assign
                                </Button>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Or create new tag..."
                                  value={inlineNewTagName}
                                  onChange={(e) => setInlineNewTagName(e.target.value)}
                                  className="flex-1 h-7 text-xs rounded border border-slate-300 bg-white px-2"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  disabled={!inlineNewTagName.trim()}
                                  onClick={handleCreateAndAssignTag}
                                >
                                  Create & Add
                                </Button>
                              </div>
                            </div>
                          )}

                          {selectedDoc.tags && selectedDoc.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedDoc.tags.map((t) => (
                                <Badge key={t.id} variant="secondary" className="text-[10px] pr-1 flex items-center gap-1">
                                  {t.name}
                                  <button
                                    type="button"
                                    onClick={(e) => handleRemoveTagFromDoc(selectedDoc.id, t.id, e)}
                                    className="hover:text-red-600 rounded p-0.5"
                                    title="Remove tag"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">No tags assigned</p>
                          )}
                        </div>

                        {/* Custom Metadata & Dynamic Document Type Fields */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-700 text-xs">Custom Metadata</span>
                              {selectedDoc.documentType && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {selectedDoc.documentType.name}
                                </Badge>
                              )}
                            </div>
                            {!isEditingMetadata ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-blue-600 hover:text-blue-700 px-1.5"
                                onClick={handleStartEditMetadata}
                              >
                                <Edit2 className="h-3 w-3 mr-1" /> Edit Metadata
                              </Button>
                            ) : (
                              <button
                                type="button"
                                className="text-xs text-slate-400 hover:text-slate-600"
                                onClick={() => setIsEditingMetadata(false)}
                              >
                                Cancel
                              </button>
                            )}
                          </div>

                          {/* Dynamic Metadata Form */}
                          {isEditingMetadata ? (
                            <form onSubmit={handleSaveMetadata} className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                              {/* Change Document Type */}
                              <div>
                                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                  Document Classification / Type
                                </label>
                                <select
                                  value={selectedDoc.documentTypeId || ''}
                                  onChange={(e) => handleUpdateDocumentType(e.target.value)}
                                  className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 focus:ring-1 focus:ring-blue-600"
                                >
                                  <option value="">Unclassified / None</option>
                                  {documentTypes.map((dt) => (
                                    <option key={dt.id} value={dt.id}>
                                      {dt.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Dynamic Fields */}
                              {(() => {
                                const currentDocType = documentTypes.find((dt) => dt.id === selectedDoc.documentTypeId);
                                const fields = currentDocType?.fields || [];
                                if (fields.length === 0) {
                                  return (
                                    <p className="text-xs text-slate-500 italic">
                                      {selectedDoc.documentTypeId
                                        ? 'No custom fields configured for this document type.'
                                        : 'Select a document type above to populate custom schema fields.'}
                                    </p>
                                  );
                                }

                                return (
                                  <div className="space-y-2.5 pt-1">
                                    {fields.map((f) => {
                                      const val = metadataFormValues[f.key];
                                      const err = metadataErrors[f.key];
                                      return (
                                        <div key={f.id} className="space-y-1">
                                          <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-slate-700">
                                              {f.name} {f.required && <span className="text-red-500">*</span>}
                                            </label>
                                            <span className="text-[10px] text-slate-400 font-mono">{f.type}</span>
                                          </div>

                                          {f.type === 'TEXT' && (
                                            <input
                                              type="text"
                                              value={val !== undefined && val !== null ? String(val) : ''}
                                              onChange={(e) =>
                                                setMetadataFormValues({ ...metadataFormValues, [f.key]: e.target.value })
                                              }
                                              className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 focus:ring-1 focus:ring-blue-600"
                                              placeholder={`Enter ${f.name.toLowerCase()}...`}
                                            />
                                          )}

                                          {f.type === 'NUMBER' && (
                                            <input
                                              type="number"
                                              step="any"
                                              value={val !== undefined && val !== null ? String(val) : ''}
                                              onChange={(e) =>
                                                setMetadataFormValues({
                                                  ...metadataFormValues,
                                                  [f.key]: e.target.value === '' ? '' : Number(e.target.value),
                                                })
                                              }
                                              className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 focus:ring-1 focus:ring-blue-600"
                                              placeholder={`Enter number...`}
                                            />
                                          )}

                                          {f.type === 'DATE' && (
                                            <input
                                              type="date"
                                              value={
                                                val
                                                  ? String(val).split('T')[0]
                                                  : ''
                                              }
                                              onChange={(e) =>
                                                setMetadataFormValues({ ...metadataFormValues, [f.key]: e.target.value })
                                              }
                                              className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 focus:ring-1 focus:ring-blue-600"
                                            />
                                          )}

                                          {f.type === 'BOOLEAN' && (
                                            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 pt-1">
                                              <input
                                                type="checkbox"
                                                checked={Boolean(val)}
                                                onChange={(e) =>
                                                  setMetadataFormValues({ ...metadataFormValues, [f.key]: e.target.checked })
                                                }
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              <span>{f.name} is enabled / true</span>
                                            </label>
                                          )}

                                          {f.type === 'SELECT' && (
                                            <select
                                              value={val !== undefined && val !== null ? String(val) : ''}
                                              onChange={(e) =>
                                                setMetadataFormValues({ ...metadataFormValues, [f.key]: e.target.value })
                                              }
                                              className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 focus:ring-1 focus:ring-blue-600"
                                            >
                                              <option value="">Select option...</option>
                                              {f.options?.map((opt) => (
                                                <option key={opt} value={opt}>
                                                  {opt}
                                                </option>
                                              ))}
                                            </select>
                                          )}

                                          {f.type === 'MULTI_SELECT' && (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                              {f.options?.map((opt) => {
                                                const selectedList: string[] = Array.isArray(val) ? (val as string[]) : [];
                                                const isChecked = selectedList.includes(opt);
                                                return (
                                                  <button
                                                    type="button"
                                                    key={opt}
                                                    onClick={() => {
                                                      const updated = isChecked
                                                        ? selectedList.filter((item) => item !== opt)
                                                        : [...selectedList, opt];
                                                      setMetadataFormValues({ ...metadataFormValues, [f.key]: updated });
                                                    }}
                                                    className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                                                      isChecked
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                    }`}
                                                  >
                                                    {opt}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {err && <p className="text-[10px] text-red-600">{err}</p>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}

                              <div className="flex justify-end gap-2 pt-2 border-t border-blue-200/60">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setIsEditingMetadata(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  variant="primary"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={isSavingMetadata}
                                >
                                  {isSavingMetadata ? 'Saving...' : 'Save Metadata'}
                                </Button>
                              </div>
                            </form>
                          ) : (
                            /* View State */
                            <div className="rounded-md bg-slate-50 p-2.5 border border-slate-100 space-y-2">
                              {(() => {
                                const currentDocType = documentTypes.find((dt) => dt.id === selectedDoc.documentTypeId);
                                const fields = currentDocType?.fields || [];
                                const entries = selectedDoc.metadata ? Object.entries(selectedDoc.metadata) : [];

                                if (entries.length === 0) {
                                  return (
                                    <p className="text-xs text-slate-400 italic py-1">
                                      No custom metadata configured. Click "Edit Metadata" to add details.
                                    </p>
                                  );
                                }

                                return (
                                  <div className="space-y-1.5">
                                    {entries.map(([k, v]) => {
                                      const matchingField = fields.find((f) => f.key === k);
                                      const label = matchingField ? matchingField.name : k;
                                      const displayVal = Array.isArray(v)
                                        ? v.join(', ')
                                        : typeof v === 'boolean'
                                        ? v ? 'Yes' : 'No'
                                        : String(v);

                                      return (
                                        <div key={k} className="flex items-center justify-between text-xs text-slate-600">
                                          <span className="font-medium text-slate-500">{label}:</span>
                                          <span className="font-semibold text-slate-800 text-right truncate max-w-[180px]" title={displayVal}>
                                            {displayVal}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* VERSIONS TAB */}
                    {drawerTab === 'versions' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">Version History</span>
                          <Button variant="outline" size="sm" onClick={() => setIsVersionUploadOpen(true)}>
                            <Upload className="mr-1 h-3 w-3" /> New Version
                          </Button>
                        </div>

                        {isLoadingVersions ? (
                          <p className="text-slate-400 text-center py-4">Loading versions...</p>
                        ) : versions.length === 0 ? (
                          <div className="py-6 text-center text-slate-400">
                            <Layers className="mx-auto h-6 w-6 text-slate-300 mb-1" />
                            <p className="text-xs">No version records found.</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                            {versions.map((v, idx) => (
                              <div
                                key={v.id}
                                className="rounded-lg border border-slate-200 p-3 bg-white space-y-2 shadow-2xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900 text-xs">v{v.versionNumber}</span>
                                      {idx === 0 && (
                                        <Badge variant="success" className="text-[9px] px-1.5 py-0.5">
                                          Current Active
                                        </Badge>
                                      )}
                                      <span className="text-xs font-semibold text-slate-700 truncate" title={v.fileName}>
                                        {v.fileName}
                                      </span>
                                    </div>

                                    {/* Detailed Version Specs */}
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-500 mt-2">
                                      <div>
                                        <span className="text-slate-400">Uploaded by: </span>
                                        <span className="font-medium text-slate-700">
                                          {v.uploadedByUser
                                            ? `${v.uploadedByUser.firstName} ${v.uploadedByUser.lastName}`.trim() || v.uploadedByUser.email
                                            : 'System / Unknown'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400">Date: </span>
                                        <span className="font-medium text-slate-700">{formatDateTime(v.createdAt)}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400">Size: </span>
                                        <span className="font-medium text-slate-700">{formatBytes(v.fileSize)}</span>
                                      </div>
                                      <div className="col-span-2">
                                        <span className="text-slate-400">Change description: </span>
                                        <span className="italic text-slate-600">
                                          {v.changeDescription || 'No description provided'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions: Preview, Download, Restore */}
                                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePreviewVersion(selectedDoc, v.versionNumber)}
                                    className="text-xs h-7 px-2 text-slate-700 hover:text-blue-600"
                                    title={`Preview v${v.versionNumber}`}
                                  >
                                    <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadFile(selectedDoc.id, v.versionNumber)}
                                    className="text-xs h-7 px-2 text-slate-700 hover:text-blue-600"
                                    title={`Download v${v.versionNumber}`}
                                  >
                                    <Download className="mr-1 h-3.5 w-3.5" /> Download
                                  </Button>
                                  {idx !== 0 && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => handleRestoreVersion(v)}
                                      className="text-xs h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white"
                                      title={`Restore v${v.versionNumber} as new current version`}
                                    >
                                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* COMMENTS TAB */}
                    {drawerTab === 'comments' && (
                      <div className="space-y-3">
                        {/* New Comment Input */}
                        <form onSubmit={handleAddComment} className="space-y-2">
                          <textarea
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Add a comment or review note..."
                            rows={2}
                            className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="submit"
                              size="sm"
                              disabled={isSubmittingComment || !newCommentText.trim()}
                              className="h-7 text-xs"
                            >
                              <Send className="mr-1 h-3 w-3" /> Post Comment
                            </Button>
                          </div>
                        </form>

                        {/* Comments Thread */}
                        {isLoadingComments ? (
                          <p className="text-slate-400 text-center py-4">Loading comments...</p>
                        ) : comments.length === 0 ? (
                          <div className="py-6 text-center text-slate-400">
                            <MessageSquare className="mx-auto h-6 w-6 text-slate-300 mb-1" />
                            <p className="text-xs">No comments yet.</p>
                            <p className="text-3xs text-slate-400">Start the conversation with your team.</p>
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                            {comments.map((c) => {
                              const isOwn = c.userId === user.id;
                              const isEditing = editingCommentId === c.id;

                              return (
                                <div
                                  key={c.id}
                                  className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1.5 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[9px]">
                                        {getInitials(c.userName)}
                                      </div>
                                      <span className="font-semibold text-slate-800 text-[11px]">{c.userName}</span>
                                      <span className="text-[10px] text-slate-400">{formatDateTime(c.createdAt)}</span>
                                    </div>
                                    {isOwn && !isEditing && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleStartEditComment(c)}
                                          className="rounded p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                                          title="Edit comment"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteComment(c.id)}
                                          className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100"
                                          title="Delete comment"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {isEditing ? (
                                    <div className="space-y-1.5 pt-1">
                                      <textarea
                                        value={editingCommentText}
                                        onChange={(e) => setEditingCommentText(e.target.value)}
                                        rows={2}
                                        className="w-full rounded border border-blue-400 bg-blue-50/20 p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                      />
                                      <div className="flex justify-end gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={handleCancelEditComment}
                                          className="h-6 text-[10px] px-2"
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="primary"
                                          disabled={isUpdatingComment || !editingCommentText.trim()}
                                          onClick={() => handleUpdateComment(c.id)}
                                          className="h-6 text-[10px] px-2"
                                        >
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-slate-700 text-xs whitespace-pre-wrap pl-6">
                                      {c.content}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ACTIVITY TAB */}
                    {drawerTab === 'activity' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">Activity Timeline</span>
                          <span className="text-[11px] text-slate-400">
                            {activityLogs.length} event{activityLogs.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {isLoadingActivity ? (
                          <p className="text-slate-400 text-center py-4">Loading audit logs...</p>
                        ) : activityLogs.length === 0 ? (
                          <div className="py-6 text-center text-slate-400">
                            <History className="mx-auto h-6 w-6 text-slate-300 mb-1" />
                            <p className="text-xs">No activity records yet.</p>
                          </div>
                        ) : (
                          <div className="relative pl-6 space-y-3 max-h-80 overflow-y-auto pr-1 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            {activityLogs.map((log) => {
                              const meta = (log.metadata || {}) as Record<string, unknown>;
                              let label = 'Activity';
                              let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';

                              switch (log.action) {
                                case 'document.uploaded':
                                case 'document.created':
                                  label = 'Uploaded';
                                  badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                                  break;
                                case 'document.renamed':
                                  label = 'Renamed';
                                  badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                                  break;
                                case 'document.moved':
                                  label = 'Moved';
                                  badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
                                  break;
                                case 'document.downloaded':
                                  label = 'Downloaded';
                                  badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                  break;
                                case 'document.version_created':
                                case 'document_version.created':
                                  label = meta.versionNumber ? `Version created (v${meta.versionNumber})` : 'Version created';
                                  badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                                  break;
                                case 'document.version_restored':
                                case 'document_version.restored':
                                  label = meta.newVersionNumber
                                    ? `Version restored (to v${meta.newVersionNumber})`
                                    : 'Version restored';
                                  badgeColor = 'bg-teal-50 text-teal-700 border-teal-200';
                                  break;
                                case 'document_comment.created':
                                  label = 'Comment added';
                                  badgeColor = 'bg-sky-50 text-sky-700 border-sky-200';
                                  break;
                                case 'document_comment.updated':
                                  label = 'Comment edited';
                                  badgeColor = 'bg-sky-50 text-sky-700 border-sky-200';
                                  break;
                                case 'document_comment.deleted':
                                  label = 'Comment deleted';
                                  badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                                  break;
                                case 'document.deleted':
                                  label = 'Deleted (moved to trash)';
                                  badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                                  break;
                                case 'document.restored':
                                  label = 'Restored from trash';
                                  badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                  break;
                                case 'document.purged':
                                  label = 'Permanently purged';
                                  badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
                                  break;
                                default:
                                  label = log.action.replace('document.', '').replace(/_/g, ' ');
                                  badgeColor = 'bg-slate-50 text-slate-700 border-slate-200';
                              }

                              return (
                                <div key={log.id} className="relative group">
                                  <div className="absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 shadow-2xs" />
                                  <div className="rounded-lg border border-slate-100 bg-white p-2.5 shadow-2xs space-y-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
                                        {label}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {formatDateTime(log.createdAt)}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600">
                                      by <span className="font-medium text-slate-800">{log.userName || log.userEmail || log.userId || 'System'}</span>
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Types Tab */}
      {activeTab === 'types' && (
        <DocumentTypesManager
          onTypesUpdated={fetchData}
          canManage={user.roles.some((r) => r.name === 'SUPER_ADMIN' || r.name === 'ORG_ADMIN')}
        />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {tags.map((tag) => {
              const docCount = documents.filter((d) => d.tags?.some((t) => t.id === tag.id)).length;
              return (
                <div
                  key={tag.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600 shrink-0">
                      <TagIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate">{tag.name}</span>
                      <span className="text-[10px] text-slate-400">{docCount} document(s)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedTagFilter(tag.id);
                        setActiveTab('explorer');
                      }}
                      className="rounded px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      title="Filter documents by this tag"
                    >
                      Filter
                    </button>
                    <button
                      onClick={() => {
                        setTagToDelete(tag);
                        setIsDeleteTagOpen(true);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete Tag"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
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

      {/* Phase 2B: Real Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setUploadInitialFiles([]);
        }}
        onUploadSuccess={() => {
          fetchData();
          addToast('Document files uploaded successfully', 'success');
        }}
        currentFolderId={currentFolderId}
        folders={folders}
        documentTypes={documentTypes}
        tags={tags}
        initialFiles={uploadInitialFiles}
      />

      {/* Phase 2B: Real Version Upload Modal */}
      <VersionUploadModal
        isOpen={isVersionUploadOpen}
        onClose={() => setIsVersionUploadOpen(false)}
        document={selectedDoc}
        onVersionUploaded={() => {
          if (selectedDoc) {
            loadVersions(selectedDoc);
            fetchData();
            addToast('New document version registered', 'success');
          }
        }}
      />
      {/* Phase 2C & 2E: Inline Text Viewer Modal */}
      <TextViewerModal
        isOpen={isTextViewerOpen}
        onClose={() => {
          setIsTextViewerOpen(false);
          setTextViewerDocId(null);
          setTextViewerVersionNumber(null);
        }}
        documentId={textViewerDocId}
        documentName={textViewerDocName}
        versionNumber={textViewerVersionNumber}
      />

      {/* Phase 2E: Restore Version Modal */}
      <Modal
        isOpen={Boolean(versionToRestore)}
        onClose={() => setVersionToRestore(null)}
        title="Restore Document Version"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
            <RotateCcw className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-950">Restore to v{versionToRestore?.versionNumber}</p>
              <p className="text-blue-800 mt-1">
                Restoring this version will create a new current version (v{(versions[0]?.versionNumber || 1) + 1}) containing a copy of v{versionToRestore?.versionNumber}'s contents.
              </p>
              <p className="text-blue-700 text-2xs mt-1 font-medium">
                All existing versions (including intermediate versions) will remain immutable in history and never be deleted.
              </p>
            </div>
          </div>

          <div className="rounded border border-slate-200 p-2.5 bg-slate-50 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">File:</span>
              <span className="font-medium text-slate-800">{versionToRestore?.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Size:</span>
              <span className="font-medium text-slate-800">{versionToRestore ? formatBytes(versionToRestore.fileSize) : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Created:</span>
              <span className="font-medium text-slate-800">{versionToRestore ? formatDateTime(versionToRestore.createdAt) : ''}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setVersionToRestore(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isRestoringVersion}
              onClick={handleConfirmRestoreVersion}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {isRestoringVersion ? 'Restoring...' : 'Confirm Restore'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Phase 2E: Permanently Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(docToPurge)}
        onClose={() => setDocToPurge(null)}
        title="Permanently Delete Document"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-bold text-rose-950">Permanent Deletion Warning</p>
              <p className="text-rose-800 mt-1">
                Are you sure you want to permanently purge <strong>"{docToPurge?.name}"</strong>?
              </p>
              <p className="text-rose-700 text-2xs mt-1 font-semibold">
                This action is IRREVERSIBLE. The document record, storage binary, versions, comments, and audit logs will be permanently removed.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDocToPurge(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isPurgingDoc}
              onClick={handleConfirmPurgeDocument}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {isPurgingDoc ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Phase 2D: Bulk Add Tag Modal */}
      <Modal isOpen={isBulkAddTagOpen} onClose={() => setIsBulkAddTagOpen(false)} title="Bulk Add Tag">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Select a tag to assign to all <strong>{selectedDocIds.length}</strong> selected documents:
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Tag</label>
            <select
              value={bulkTagId}
              onChange={(e) => setBulkTagId(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="">Choose a tag...</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsBulkAddTagOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmittingBulk || !bulkTagId}
              onClick={() => handleExecuteBulkAction('add-tag')}
            >
              {isSubmittingBulk ? 'Applying...' : `Assign Tag to ${selectedDocIds.length} Document(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Phase 2D: Bulk Remove Tag Modal */}
      <Modal isOpen={isBulkRemoveTagOpen} onClose={() => setIsBulkRemoveTagOpen(false)} title="Bulk Remove Tag">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Select a tag to remove from the <strong>{selectedDocIds.length}</strong> selected documents:
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Tag</label>
            <select
              value={bulkRemoveTagId}
              onChange={(e) => setBulkRemoveTagId(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="">Choose a tag to remove...</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsBulkRemoveTagOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmittingBulk || !bulkRemoveTagId}
              onClick={() => handleExecuteBulkAction('remove-tag')}
            >
              {isSubmittingBulk ? 'Removing...' : `Remove Tag from ${selectedDocIds.length} Document(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Phase 2D: Bulk Move Modal */}
      <Modal isOpen={isBulkMoveOpen} onClose={() => setIsBulkMoveOpen(false)} title="Bulk Move Documents">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Move <strong>{selectedDocIds.length}</strong> selected documents to destination folder:
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Folder</label>
            <select
              value={bulkTargetFolderId || ''}
              onChange={(e) => setBulkTargetFolderId(e.target.value ? e.target.value : null)}
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="">Root Folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsBulkMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmittingBulk}
              onClick={() => handleExecuteBulkAction('move')}
            >
              {isSubmittingBulk ? 'Moving...' : `Move ${selectedDocIds.length} Document(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Phase 2D: Bulk Archive Modal */}
      <Modal isOpen={isBulkArchiveOpen} onClose={() => setIsBulkArchiveOpen(false)} title="Bulk Archive Confirmation">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to archive <strong>{selectedDocIds.length}</strong> selected documents?
            Their status will be set to <strong>ARCHIVED</strong>.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsBulkArchiveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmittingBulk}
              onClick={() => handleExecuteBulkAction('archive')}
            >
              {isSubmittingBulk ? 'Archiving...' : `Archive ${selectedDocIds.length} Document(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Phase 2D: Bulk Delete Modal */}
      <Modal isOpen={isBulkDeleteOpen} onClose={() => setIsBulkDeleteOpen(false)} title="Bulk Delete Confirmation">
        <div className="space-y-4">
          <div className="rounded-md bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
            <p className="font-semibold">Move documents to Trash?</p>
            <p className="mt-1">
              You are about to move <strong>{selectedDocIds.length}</strong> document(s) to the Trash.
              They can be restored later from the Trash folder if needed.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isSubmittingBulk}
              onClick={() => handleExecuteBulkAction('delete')}
            >
              {isSubmittingBulk ? 'Deleting...' : `Move ${selectedDocIds.length} to Trash`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Phase 2D: Delete Tag Confirmation Modal */}
      <Modal isOpen={isDeleteTagOpen} onClose={() => setIsDeleteTagOpen(false)} title="Delete Tag Confirmation">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to delete tag <strong>"{tagToDelete?.name}"</strong>? It will be removed from all documents across your organization.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteTagOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteTag}
            >
              Delete Tag
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
