export default function TypingIndicator({ userName }) {
  if (!userName || (Array.isArray(userName) && userName.length === 0)) return null;

  const users = Array.isArray(userName) ? userName : [userName];
  const names = users.filter(Boolean);

  if (names.length === 0) return null;

  let text;
  if (names.length === 1) {
    text = `${names[0]} sedang mengetik...`;
  } else if (names.length === 2) {
    text = `${names[0]} dan ${names[1]} sedang mengetik...`;
  } else {
    text = `${names[0]} dan ${names.length - 1} lainnya sedang mengetik...`;
  }

  return (
    <div className="px-4 py-1">
      <p className="text-xs text-slate-400 dark:text-slate-500 italic animate-pulse">
        {text}
      </p>
    </div>
  );
}
