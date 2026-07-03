import { SearchX } from "lucide-react";

export default function EmptyState({ title = "Tidak ada data", description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <SearchX className="w-7 h-7 text-neutral-400 dark:text-neutral-500" />
      </div>
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      {description && <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1.5 text-center max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
