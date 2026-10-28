import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.ts';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-description' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        className={cn(
          'relative z-50 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl transition-all',
          className
        )}
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 id="dialog-title" className="text-base font-semibold text-slate-900">{title}</h3>
            {description && <p id="dialog-description" className="mt-1 text-xs text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="py-4">{children}</div>

        {footer && <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}
