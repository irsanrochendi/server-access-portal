export default function TypingIndicator({ userName }) {
  if (!userName) return null;

  return (
    <div className="px-4 py-1">
      <p className="text-xs text-slate-400 dark:text-slate-500 italic animate-pulse">
        {userName} sedang mengetik...
      </p>
    </div>
  );
}
