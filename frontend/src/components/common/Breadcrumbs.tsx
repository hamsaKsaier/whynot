import React from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight, FiHome } from 'react-icons/fi';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 text-sm ${className}`}
    >
      <Link
        to="/app"
        className="text-slate-400 hover:text-slate-200 transition-colors"
        aria-label="Home"
      >
        <FiHome className="h-4 w-4" />
      </Link>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <FiChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" aria-hidden="true" />
          {item.path && index < items.length - 1 ? (
            <Link
              to={item.path}
              className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          ) : (
            <span className="text-white font-medium flex items-center gap-1" aria-current="page">
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
