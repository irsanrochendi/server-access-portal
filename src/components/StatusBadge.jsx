import { Wifi, WifiOff, HelpCircle } from 'lucide-react';

const statusConfig = {
  online: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    border: 'border-emerald-200 dark:border-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'Online',
    animate: true,
  },
  offline: {
    bg: 'bg-red-100 dark:bg-red-500/15',
    border: 'border-red-200 dark:border-red-500/20',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Offline',
    animate: false,
  },
  unknown: {
    bg: 'bg-slate-100 dark:bg-slate-500/15',
    border: 'border-slate-200 dark:border-slate-500/20',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-500',
    label: 'Unknown',
    animate: false,
  },
};

export default function StatusBadge({ status, showLabel = true, size = 'sm' }) {
  const config = statusConfig[status] || statusConfig.unknown;

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-[11px] px-2 py-1 gap-1.5',
    md: 'text-xs px-2.5 py-1.5 gap-2',
  };

  const dotSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
  };

  return (
    <span className={`inline-flex items-center rounded-full border font-medium transition-all
      ${config.bg} ${config.text} ${sizeClasses[size] || sizeClasses.sm}`}>
      <span className={`relative flex ${dotSizes[size] || dotSizes.sm} items-center justify-center`}>
        {config.animate && (
          <span className={`absolute inset-0 rounded-full ${config.dot} opacity-50 animate-ping`} />
        )}
        <span className={`relative w-full h-full rounded-full ${config.dot}`} />
      </span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
