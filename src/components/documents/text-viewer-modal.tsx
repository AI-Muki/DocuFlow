import React, { useState, useEffect } from 'react';
import {
  FileCode,
  Copy,
  Check,
  Download,
  AlertCircle,
  Search,
} from 'lucide-react';
import { Modal } from '../ui/modal.tsx';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';

export interface TextViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string | null;
  documentName?: string;
  versionNumber?: number | null;
}

export function TextViewerModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  versionNumber,
}: TextViewerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<{ text: string; fileName: string; mimeType: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen || !documentId) {
      setData(null);
      setError(null);
      setSearchTerm('');
      return;
    }

    const fetchText = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const url = `/api/documents/${documentId}/text-content${versionNumber ? `?version=${versionNumber}` : ''}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.message || 'Could not load text content for this document');
        }
        setData(json.data);
      } catch (err: unknown) {
        setError((err as Error).message || 'Failed to read file contents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchText();
  }, [isOpen, documentId, versionNumber]);

  const handleCopy = async () => {
    if (!data?.text) return;
    try {
      await navigator.clipboard.writeText(data.text);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    if (!documentId) return;
    const link = document.createElement('a');
    link.href = `/api/documents/${documentId}/download${versionNumber ? `?version=${versionNumber}` : ''}`;
    link.setAttribute('download', data?.fileName || 'document.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const lines = data?.text ? data.text.split('\n') : [];
  const lineCount = lines.length;
  const charCount = data?.text ? data.text.length : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-blue-600" />
          <span className="truncate max-w-md">{documentName || data?.fileName || 'Document Content'}</span>
          {versionNumber && (
            <Badge variant="secondary" className="font-mono text-2xs">
              v{versionNumber}
            </Badge>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Top Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {data && (
              <>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {data.mimeType}
                </Badge>
                <span>{lineCount.toLocaleString()} lines</span>
                <span>•</span>
                <span>{charCount.toLocaleString()} characters</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Find in text..."
                className="h-7 w-36 rounded-md border border-slate-200 bg-slate-50 pl-7 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 sm:w-48"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!data?.text}
              className="h-7 text-xs"
            >
              {hasCopied ? (
                <>
                  <Check className="mr-1 h-3 w-3 text-emerald-600" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" /> Copy Text
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!data}
              className="h-7 text-xs"
            >
              <Download className="mr-1 h-3 w-3" /> Download
            </Button>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="flex h-80 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400">
            Reading and parsing document contents...
          </div>
        ) : error ? (
          <div className="flex h-80 flex-col items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50/50 p-6 text-center text-xs text-rose-700">
            <AlertCircle className="h-6 w-6 text-rose-500" />
            <span className="font-medium">{error}</span>
            <p className="text-3xs text-rose-500">Binary or unsupported encoding files can be downloaded or opened directly.</p>
          </div>
        ) : (
          <div className="relative max-h-[500px] min-h-[250px] overflow-auto rounded-lg border border-slate-200 bg-slate-950 font-mono text-xs text-slate-200 shadow-inner">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => {
                  const lineNumber = idx + 1;
                  const isMatch = searchTerm.trim() && line.toLowerCase().includes(searchTerm.toLowerCase());
                  return (
                    <tr
                      key={lineNumber}
                      className={`hover:bg-slate-900/60 transition-colors ${
                        isMatch ? 'bg-amber-500/20 text-amber-200' : ''
                      }`}
                    >
                      <td className="w-12 select-none border-r border-slate-800 px-3 py-0.5 text-right font-mono text-[11px] text-slate-500">
                        {lineNumber}
                      </td>
                      <td className="px-3 py-0.5 whitespace-pre font-mono text-[12px] leading-5 text-slate-200">
                        {line || ' '}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
