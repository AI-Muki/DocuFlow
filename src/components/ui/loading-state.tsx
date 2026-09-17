import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils.ts';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-slate-500 gap-3', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      <span className="text-xs font-medium text-slate-600">{message}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />;
}
