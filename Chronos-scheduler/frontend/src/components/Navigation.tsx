// =============================================================================
// Navigation Component - Breadcrumbs and secondary navigation helpers
// =============================================================================

import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

// -----------------------------------------------------------------------------
// Breadcrumbs Component
// -----------------------------------------------------------------------------

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center text-sm text-gray-500 mb-4">
      <Link to="/dashboard" className="hover:text-gray-700 transition-colors">
        <Home size={16} />
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight size={16} className="mx-2" />
          {item.to ? (
            <Link to={item.to} className="hover:text-gray-700 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}

// -----------------------------------------------------------------------------
// Tab Navigation
// -----------------------------------------------------------------------------

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function TabNavigation({ tabs, activeTab, onChange }: TabNavigationProps) {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex gap-4 -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page Header
// -----------------------------------------------------------------------------

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Filter Bar
// -----------------------------------------------------------------------------

interface FilterBarProps {
  children: React.ReactNode;
  onClear?: () => void;
}

export function FilterBar({ children, onClear }: FilterBarProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap items-end gap-4">
        {children}
        {onClear && (
          <button
            onClick={onClear}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Navigation default export
// -----------------------------------------------------------------------------

export default function Navigation() {
  const location = useLocation();
  
  // Build breadcrumbs from current path
  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = pathParts.map((part, index) => {
    const to = '/' + pathParts.slice(0, index + 1).join('/');
    const label = part.charAt(0).toUpperCase() + part.slice(1);
    const isLast = index === pathParts.length - 1;
    
    return {
      label,
      to: isLast ? undefined : to,
    };
  });

  if (breadcrumbs.length === 0) {
    return null;
  }

  return <Breadcrumbs items={breadcrumbs} />;
}
