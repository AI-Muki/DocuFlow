import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, ShieldCheck, X } from 'lucide-react';

export interface GlobalDragOverlayProps {
  onFilesDropped: (files: File[]) => void;
  organizationName?: string;
}

export function GlobalDragOverlay({ onFilesDropped, organizationName }: GlobalDragOverlayProps) {
  const [isDraggingOverWindow, setIsDraggingOverWindow] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      // Only respond if dragging files from the OS
      if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) {
        return;
      }
      e.preventDefault();
      dragCounter.current += 1;
      setIsDraggingOverWindow(true);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!isDraggingOverWindow) {
        setIsDraggingOverWindow(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDraggingOverWindow(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDraggingOverWindow(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const filesArray = Array.from(e.dataTransfer.files);
        onFilesDropped(filesArray);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingOverWindow) {
        dragCounter.current = 0;
        setIsDraggingOverWindow(false);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDraggingOverWindow, onFilesDropped]);

  if (!isDraggingOverWindow) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md transition-all duration-200 pointer-events-auto select-none"
      role="region"
      aria-label="File drop target overlay"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border-3 border-dashed border-blue-400 bg-white/95 p-10 text-center shadow-2xl ring-8 ring-blue-500/20 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={() => {
            dragCounter.current = 0;
            setIsDraggingOverWindow(false);
          }}
          className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Dismiss drop overlay (Esc)"
          aria-label="Dismiss drop overlay"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center justify-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-lg ring-8 ring-blue-100 animate-bounce">
            <UploadCloud className="h-10 w-10" />
          </div>

          <div className="space-y-1.5 max-w-lg">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Drop Files to Intake Documents
            </h2>
            <p className="text-sm text-slate-600">
              Release your files anywhere to upload securely into{' '}
              <strong className="text-slate-900">{organizationName || 'your organization'}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {['PDF', 'DOCX', 'XLSX', 'PPTX', 'PNG', 'JPG', 'TXT'].map((ext) => (
              <span
                key={ext}
                className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-mono font-semibold text-blue-700"
              >
                .{ext.toLowerCase()}
              </span>
            ))}
            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
              Max 25 MB/file
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Automatic SHA-256 integrity verification & multi-tenant isolation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
