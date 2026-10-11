import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  AlertCircle,
  FileText,
  Settings2,
  X,
  Sliders,
  HelpCircle,
} from 'lucide-react';
import type { DocumentType, DocumentFieldDefinition, FieldType } from '../../types/index.ts';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';
import { Modal } from '../ui/modal.tsx';
import { EmptyState } from '../ui/empty-state.tsx';
import { useToast } from '../ui/toast.tsx';

export interface DocumentTypesManagerProps {
  onTypesUpdated?: () => void;
  canManage?: boolean;
}

const FIELD_TYPES: { type: FieldType; label: string; description: string }[] = [
  { type: 'TEXT', label: 'Text', description: 'Single-line or short text value' },
  { type: 'NUMBER', label: 'Number', description: 'Numeric quantities or monetary amounts' },
  { type: 'DATE', label: 'Date', description: 'Calendar date (ISO format)' },
  { type: 'BOOLEAN', label: 'Boolean', description: 'True/false flag or toggle' },
  { type: 'SELECT', label: 'Single Select', description: 'Choose one option from a defined list' },
  { type: 'MULTI_SELECT', label: 'Multi Select', description: 'Select multiple options from a defined list' },
];

export function DocumentTypesManager({ onTypesUpdated, canManage = true }: DocumentTypesManagerProps) {
  const { addToast } = useToast();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [isSubmittingType, setIsSubmittingType] = useState(false);

  const [isEditTypeOpen, setIsEditTypeOpen] = useState(false);
  const [typeToEdit, setTypeToEdit] = useState<DocumentType | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypeDescription, setEditTypeDescription] = useState('');

  const [typeToDelete, setTypeToDelete] = useState<DocumentType | null>(null);
  const [isDeleteTypeOpen, setIsDeleteTypeOpen] = useState(false);
  const [isDeletingType, setIsDeletingType] = useState(false);

  // Custom Field Modals
  const [isCreateFieldOpen, setIsCreateFieldOpen] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('TEXT');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptionsText, setFieldOptionsText] = useState('');
  const [fieldOrder, setFieldOrder] = useState<number>(1);
  const [isSubmittingField, setIsSubmittingField] = useState(false);

  const [isEditFieldOpen, setIsEditFieldOpen] = useState(false);
  const [fieldToEdit, setFieldToEdit] = useState<DocumentFieldDefinition | null>(null);
  const [editFieldName, setEditFieldName] = useState('');
  const [editFieldType, setEditFieldType] = useState<FieldType>('TEXT');
  const [editFieldRequired, setEditFieldRequired] = useState(false);
  const [editFieldOptionsText, setEditFieldOptionsText] = useState('');
  const [editFieldOrder, setEditFieldOrder] = useState<number>(1);

  const [fieldToDelete, setFieldToDelete] = useState<DocumentFieldDefinition | null>(null);
  const [isDeleteFieldOpen, setIsDeleteFieldOpen] = useState(false);

  const loadTypes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/document-types');
      const data = await res.json();
      if (data.success) {
        setTypes(data.data);
        if (!selectedTypeId && data.data.length > 0) {
          setSelectedTypeId(data.data[0].id);
        }
      }
    } catch {
      addToast('Failed to load document types', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, []);

  const selectedType = types.find((t) => t.id === selectedTypeId) || null;

  // Auto-generate key when typing field name
  const handleFieldNameChange = (name: string) => {
    setFieldName(name);
    const generated = name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .split(/\s+/)
      .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
      .join('');
    setFieldKey(generated);
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeName.trim()) return;

    setIsSubmittingType(true);
    try {
      const res = await fetch('/api/document-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: typeName.trim(),
          description: typeDescription.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || data.message || 'Failed to create document type');

      addToast(`Document type "${data.data.name}" created`, 'success');
      setIsCreateTypeOpen(false);
      setTypeName('');
      setTypeDescription('');
      await loadTypes();
      setSelectedTypeId(data.data.id);
      onTypesUpdated?.();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setIsSubmittingType(false);
    }
  };

  const handleEditType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeToEdit || !editTypeName.trim()) return;

    try {
      const res = await fetch(`/api/document-types/${typeToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTypeName.trim(),
          description: editTypeDescription.trim() || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || data.message || 'Failed to update document type');

      addToast('Document type updated', 'success');
      setIsEditTypeOpen(false);
      await loadTypes();
      onTypesUpdated?.();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleDeleteType = async () => {
    if (!typeToDelete) return;

    setIsDeletingType(true);
    try {
      const res = await fetch(`/api/document-types/${typeToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || data.message || 'Cannot delete document type');

      addToast(`Document type "${typeToDelete.name}" deleted`, 'success');
      setIsDeleteTypeOpen(false);
      setTypeToDelete(null);
      await loadTypes();
      if (selectedTypeId === typeToDelete.id) {
        setSelectedTypeId(null);
      }
      onTypesUpdated?.();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setIsDeletingType(false);
    }
  };

  const openCreateFieldModal = () => {
    if (!selectedType) return;
    setFieldName('');
    setFieldKey('');
    setFieldType('TEXT');
    setFieldRequired(false);
    setFieldOptionsText('');
    setFieldOrder((selectedType.fields?.length || 0) + 1);
    setIsCreateFieldOpen(true);
  };

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !fieldName.trim() || !fieldKey.trim()) return;

    setIsSubmittingField(true);
    try {
      let options: string[] | undefined = undefined;
      if (fieldType === 'SELECT' || fieldType === 'MULTI_SELECT') {
        options = fieldOptionsText
          .split(',')
          .map((opt) => opt.trim())
          .filter(Boolean);
        if (options.length === 0) {
          throw new Error('Please specify at least one option for select fields (comma-separated)');
        }
      }

      const res = await fetch(`/api/document-types/${selectedType.id}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fieldName.trim(),
          key: fieldKey.trim(),
          type: fieldType,
          required: fieldRequired,
          options,
          order: fieldOrder,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || data.message || 'Failed to create field');

      addToast(`Field "${data.data.name}" added`, 'success');
      setIsCreateFieldOpen(false);
      await loadTypes();
      onTypesUpdated?.();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setIsSubmittingField(false);
    }
  };

  const openEditFieldModal = (field: DocumentFieldDefinition) => {
    setFieldToEdit(field);
    setEditFieldName(field.name);
    setEditFieldType(field.type);
    setEditFieldRequired(field.required);
    setEditFieldOptionsText(field.options?.join(', ') || '');
    setEditFieldOrder(field.order ?? 1);
    setIsEditFieldOpen(true);
  };

  const handleEditField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !fieldToEdit || !editFieldName.trim()) return;

    try {
      let options: string[] | null | undefined = undefined;
      if (editFieldType === 'SELECT' || editFieldType === 'MULTI_SELECT') {
        options = editFieldOptionsText
          .split(',')
          .map((opt) => opt.trim())
          .filter(Boolean);
        if (options.length === 0) {
          throw new Error('Please specify at least one option for select fields');
        }
      } else {
        options = null;
      }

      const res = await fetch(`/api/document-types/${selectedType.id}/fields/${fieldToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFieldName.trim(),
          type: editFieldType,
          required: editFieldRequired,
          options,
          order: editFieldOrder,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || data.message || 'Failed to update field');

      addToast(`Field updated`, 'success');
      setIsEditFieldOpen(false);
      setFieldToEdit(null);
      await loadTypes();
      onTypesUpdated?.();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleDeleteField = async () => {
    if (!selectedType || !fieldToDelete) return;

    try {
      const res = await fetch(`/api/document-types/${selectedType.id}/fields/${fieldToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || data.message || 'Failed to delete field');

      addToast(`Field "${fieldToDelete.name}" deleted`, 'success');
      setIsDeleteFieldOpen(false);
      setFieldToDelete(null);
      await loadTypes();
      onTypesUpdated?.();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    }
  };

  const handleMoveFieldOrder = async (field: DocumentFieldDefinition, direction: 'up' | 'down') => {
    if (!selectedType || !selectedType.fields) return;
    const currentFields = [...selectedType.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const currentIndex = currentFields.findIndex((f) => f.id === field.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentFields.length) return;

    const otherField = currentFields[targetIndex];
    const currentOrder = field.order ?? currentIndex + 1;
    const otherOrder = otherField.order ?? targetIndex + 1;

    try {
      await Promise.all([
        fetch(`/api/document-types/${selectedType.id}/fields/${field.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: otherOrder }),
        }),
        fetch(`/api/document-types/${selectedType.id}/fields/${otherField.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: currentOrder }),
        }),
      ]);

      await loadTypes();
      onTypesUpdated?.();
    } catch {
      addToast('Failed to reorder fields', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" />
            Document Types & Custom Metadata Schemas
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure enterprise document classifications and dynamic custom metadata fields.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setIsCreateTypeOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Document Type
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading document types and metadata schemas...</div>
      ) : types.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-10 w-10 text-slate-300" />}
          title="No document types configured"
          description="Create your first document classification type (e.g. Invoice, Contract, Receipt) to begin organizing metadata."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setIsCreateTypeOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Define Document Type
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Document Types List */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Classification Types ({types.length})
              </span>
            </div>

            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
              {types.map((t) => {
                const isSelected = selectedTypeId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTypeId(t.id)}
                    className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">{t.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {t.fields?.length || 0} fields
                        </span>
                      </div>
                      {t.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{t.description}</p>
                      )}
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setTypeToEdit(t);
                            setEditTypeName(t.name);
                            setEditTypeDescription(t.description || '');
                            setIsEditTypeOpen(true);
                          }}
                          className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                          title="Edit Type"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setTypeToDelete(t);
                            setIsDeleteTypeOpen(true);
                          }}
                          className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete Type"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Custom Fields for Selected Type */}
          <div className="lg:col-span-8">
            {selectedType ? (
              <div className="rounded-lg border border-slate-200 bg-white shadow-2xs p-5 space-y-5">
                {/* Type Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{selectedType.name}</h3>
                      <Badge variant="secondary" className="text-[10px]">
                        {selectedType.fields?.length || 0} Custom Fields
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedType.description || 'No description specified'}
                    </p>
                  </div>

                  {canManage && (
                    <Button size="sm" onClick={openCreateFieldModal}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Field
                    </Button>
                  )}
                </div>

                {/* Fields Table */}
                {!selectedType.fields || selectedType.fields.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    <Sliders className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No custom fields defined</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      Add custom fields (e.g. Invoice Number, Amount, Counterparty, Due Date) to dynamically collect structured metadata for {selectedType.name}.
                    </p>
                    {canManage && (
                      <Button size="sm" variant="outline" className="mt-4" onClick={openCreateFieldModal}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add First Field
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                          <th className="py-2.5 px-3 w-12 text-center">#</th>
                          <th className="py-2.5 px-3">Field Name</th>
                          <th className="py-2.5 px-3">Key</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Required</th>
                          <th className="py-2.5 px-3">Options</th>
                          {canManage && <th className="py-2.5 px-3 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedType.fields
                          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                          .map((f, idx) => (
                            <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {f.order ?? idx + 1}
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-900">{f.name}</td>
                              <td className="py-3 px-3">
                                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                                  {f.key}
                                </code>
                              </td>
                              <td className="py-3 px-3">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  {f.type}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                {f.required ? (
                                  <span className="text-red-600 font-bold text-[10px] bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                    Required
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">Optional</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-500 max-w-[160px] truncate" title={f.options?.join(', ')}>
                                {f.options && f.options.length > 0 ? (
                                  <span className="text-[11px] text-slate-600">
                                    {f.options.join(', ')}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              {canManage && (
                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleMoveFieldOrder(f, 'up')}
                                      disabled={idx === 0}
                                      className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveFieldOrder(f, 'down')}
                                      disabled={idx === (selectedType.fields?.length || 1) - 1}
                                      className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => openEditFieldModal(f)}
                                      className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                      title="Edit Field"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setFieldToDelete(f);
                                        setIsDeleteFieldOpen(true);
                                      }}
                                      className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                      title="Delete Field"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Select a document type on the left to configure fields.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Document Type */}
      <Modal isOpen={isCreateTypeOpen} onClose={() => setIsCreateTypeOpen(false)} title="Create New Document Type">
        <form onSubmit={handleCreateType} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Type Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              placeholder="e.g. Purchase Order, Contract, Receipt"
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={typeDescription}
              onChange={(e) => setTypeDescription(e.target.value)}
              placeholder="Brief description of the document category..."
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateTypeOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmittingType || !typeName.trim()}>
              Create Document Type
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Document Type */}
      <Modal isOpen={isEditTypeOpen} onClose={() => setIsEditTypeOpen(false)} title="Edit Document Type">
        <form onSubmit={handleEditType} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Type Name</label>
            <input
              type="text"
              required
              value={editTypeName}
              onChange={(e) => setEditTypeName(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={editTypeDescription}
              onChange={(e) => setEditTypeDescription(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditTypeOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Document Type (Safety Check) */}
      <Modal isOpen={isDeleteTypeOpen} onClose={() => setIsDeleteTypeOpen(false)} title="Delete Document Type">
        <div className="space-y-4 text-xs text-slate-600">
          <div className="flex items-start gap-3 rounded-md bg-amber-50 p-3 border border-amber-200 text-amber-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Safe Deletion Policy</p>
              <p className="mt-0.5 text-[11px]">
                Document types can only be deleted if no active documents are currently assigned to them.
                If documents are classified under "{typeToDelete?.name}", deletion will be safely rejected.
              </p>
            </div>
          </div>

          <p>
            Are you sure you want to delete the document type <strong className="text-slate-900">"{typeToDelete?.name}"</strong> and all its custom field definitions?
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteTypeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteType}
              disabled={isDeletingType}
            >
              {isDeletingType ? 'Verifying & Deleting...' : 'Delete Document Type'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Create Custom Field */}
      <Modal isOpen={isCreateFieldOpen} onClose={() => setIsCreateFieldOpen(false)} title={`Add Field to ${selectedType?.name}`}>
        <form onSubmit={handleCreateField} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Field Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fieldName}
                onChange={(e) => handleFieldNameChange(e.target.value)}
                placeholder="e.g. Invoice Number, Total Amount"
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Field Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                placeholder="e.g. invoiceNumber"
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Alphanumeric, camelCase recommended</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Field Type</label>
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value as FieldType)}
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label} ({t.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Order Index</label>
              <input
                type="number"
                min={1}
                value={fieldOrder}
                onChange={(e) => setFieldOrder(parseInt(e.target.value, 10) || 1)}
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {(fieldType === 'SELECT' || fieldType === 'MULTI_SELECT') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Options (comma-separated) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fieldOptionsText}
                onChange={(e) => setFieldOptionsText(e.target.value)}
                placeholder="e.g. USD, EUR, GBP, CAD or Offer Letter, NDA, Tax Form"
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="fieldRequired"
              checked={fieldRequired}
              onChange={(e) => setFieldRequired(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="fieldRequired" className="text-xs font-medium text-slate-700 select-none">
              Mark this field as Required during document upload and metadata validation
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateFieldOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmittingField}>
              Add Field
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Custom Field */}
      <Modal isOpen={isEditFieldOpen} onClose={() => setIsEditFieldOpen(false)} title="Edit Custom Field">
        <form onSubmit={handleEditField} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Field Name</label>
              <input
                type="text"
                required
                value={editFieldName}
                onChange={(e) => setEditFieldName(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Field Key</label>
              <input
                type="text"
                disabled
                value={fieldToEdit?.key || ''}
                className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Field Type</label>
              <select
                value={editFieldType}
                onChange={(e) => setEditFieldType(e.target.value as FieldType)}
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label} ({t.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Order Index</label>
              <input
                type="number"
                min={1}
                value={editFieldOrder}
                onChange={(e) => setEditFieldOrder(parseInt(e.target.value, 10) || 1)}
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {(editFieldType === 'SELECT' || editFieldType === 'MULTI_SELECT') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Options (comma-separated)</label>
              <input
                type="text"
                required
                value={editFieldOptionsText}
                onChange={(e) => setEditFieldOptionsText(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editFieldRequired"
              checked={editFieldRequired}
              onChange={(e) => setEditFieldRequired(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="editFieldRequired" className="text-xs font-medium text-slate-700 select-none">
              Mark this field as Required
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditFieldOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Field
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Field Confirmation */}
      <Modal isOpen={isDeleteFieldOpen} onClose={() => setIsDeleteFieldOpen(false)} title="Delete Custom Field">
        <div className="space-y-4 text-xs text-slate-600">
          <p>
            Are you sure you want to delete the field <strong className="text-slate-900">"{fieldToDelete?.name}"</strong>?
            Any existing saved metadata values for this field will also be removed.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteFieldOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteField}>
              Delete Field
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
