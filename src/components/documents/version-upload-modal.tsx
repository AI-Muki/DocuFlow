import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, RefreshCw } from 'lucide-react';
import { Modal } from '../ui/modal.tsx';
import { Button } from '../ui/button.tsx';
import type { Document } from '../../types/index.ts';

export interface VersionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  onVersionUploaded: () => void;
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

export function VersionUploadModal({
  isOpen,
  onClose,
  document: targetDoc,
  onVersionUploaded,
}: VersionUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [changeDescription, setChangeDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!targetDoc) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
        setError(
          `Unsupported file format (.${ext || 'unknown'}). Supported: ${SUPPORTED_EXTENSIONS.join(', ').toUpperCase()}`
        );
        setSelectedFile(null);
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setError('File exceeds 25MB maximum limit');
        setSelectedFile(null);
        return;
      }
      setError(null);
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (changeDescription.trim()) {
      formData.append('changeDescription', changeDescription.trim());
    }

    try {
      const res = await fetch(`/api/documents/${targetDoc.id}/versions/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || 'Failed to upload new version');
      }

      setSelectedFile(null);
      setChangeDescription('');
      onVersionUploaded();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to upload version');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isUploading) {
          onClose();
          setSelectedFile(null);
          setError(null);
        }
      }}
      title={`Upload New Version for "${targetDoc.name}"`}
      description="Upload an updated file revision. A new sequential version will be registered automatically."
      className="max-w-md"
    >
      <form onSubmit={handleUpload} className="space-y-4">
        {/* File Picker */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-5 text-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
          />
          <div className="flex flex-col items-center justify-center space-y-1.5 text-xs">
            <UploadCloud className="h-6 w-6 text-blue-600" />
            {selectedFile ? (
              <div className="text-slate-800 font-semibold truncate max-w-xs">
                📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            ) : (
              <div>
                <p className="font-semibold text-slate-800">Click to choose revision file</p>
                <p className="text-slate-500 text-[11px]">Max 25MB (PDF, DOCX, XLSX, images, etc.)</p>
              </div>
            )}
          </div>
        </div>

        {/* Change description */}
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Change Description / Revision Notes
          </label>
          <textarea
            value={changeDescription}
            onChange={(e) => setChangeDescription(e.target.value)}
            placeholder="e.g. Updated Section 4 terms per legal review"
            rows={3}
            className="w-full text-xs rounded-md border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isUploading || !selectedFile}>
            {isUploading ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Uploading Revision...
              </>
            ) : (
              'Upload Version'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
