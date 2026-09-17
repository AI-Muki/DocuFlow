import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center space-x-1.5 text-xs text-slate-500">
      <div className="flex items-center gap-1 text-slate-400">
        <Home className="h-3.5 w-3.5" />
      </div>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-slate-800">{item.label}</span>
            ) : (
              <button
                onClick={item.onClick}
                className="hover:text-slate-800 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
