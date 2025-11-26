// =============================================================================
// Priority Badge Component - Displays priority levels with colors
// =============================================================================

import type { Priority, CarStatus } from '../types';

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md' | 'lg';
}

const priorityStyles: Record<Priority, string> = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low: 'bg-green-100 text-green-700 border-green-200',
};

const sizeStyles = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
};

export default function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${priorityStyles[priority]} ${sizeStyles[size]}`}
    >
      {priority}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Status Badge Component - Displays car status with colors
// -----------------------------------------------------------------------------

interface StatusBadgeProps {
  status: CarStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusStyles: Record<CarStatus, string> = {
  unscheduled: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
};

const statusLabels: Record<CarStatus, string> = {
  unscheduled: 'Unscheduled',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${statusStyles[status]} ${sizeStyles[size]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Fit Status Badge - For scenario evaluation results
// -----------------------------------------------------------------------------

interface FitStatusBadgeProps {
  status: 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

const fitStatusStyles = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};

const fitStatusLabels = {
  green: 'Good',
  yellow: 'Warning',
  red: 'Over Capacity',
};

export function FitStatusBadge({ status, size = 'md' }: FitStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${fitStatusStyles[status]} ${sizeStyles[size]}`}
    >
      {fitStatusLabels[status]}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Priority Dot - Small colored indicator
// -----------------------------------------------------------------------------

interface PriorityDotProps {
  priority: Priority;
}

const dotColors: Record<Priority, string> = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-green-500',
};

export function PriorityDot({ priority }: PriorityDotProps) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${dotColors[priority]}`}
      title={priority}
    />
  );
}
