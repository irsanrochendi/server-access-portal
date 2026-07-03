import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({ open, title, message, onConfirm, onCancel, loading, confirmText = "Hapus", confirmColor = "red" }) {
  if (!open) return null;

  const colorMap = {
    red: "bg-red-600 hover:bg-red-700",
    amber: "bg-amber-600 hover:bg-amber-700",
    indigo: "bg-indigo-600 hover:bg-indigo-700",
  };
  const btnClass = colorMap[confirmColor] || colorMap.red;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md mx-4 p-6 animate-scale-in border border-neutral-200/60 dark:border-neutral-800/60 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center shrink-0 border border-red-200/60 dark:border-red-800/60">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title || "Konfirmasi"}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{message}</p>
          </div>
          <button onClick={onCancel} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-all disabled:opacity-50">Batal</button>
          <button onClick={onConfirm} disabled={loading} className={'px-4 py-2 text-sm font-medium text-white rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 ' + btnClass}>
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
