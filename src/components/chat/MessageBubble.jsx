import { FileText, Download } from 'lucide-react';

export default function MessageBubble({ message, isOwn }) {
  const time = new Date(message.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
        {/* Sender name (others only) */}
        {!isOwn && (
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">
            {message.sender?.name || message.sender_name}
          </p>
        )}

        {/* Message bubble */}
        <div className={`rounded-2xl px-4 py-2.5 ${
          isOwn
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-white dark:bg-white/10 text-slate-900 dark:text-white rounded-bl-md border border-slate-200 dark:border-white/5'
        }`}>
          {(message.attachment_url || message.file_url) ? (
            <a
              href={message.attachment_url || message.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 ${isOwn ? 'text-white hover:text-blue-100' : 'text-blue-600 dark:text-blue-400 hover:underline'}`}
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">{message.attachment_name || message.file_name || 'File'}</span>
              <Download className="w-3.5 h-3.5 ml-1" />
            </a>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        {/* Time */}
        <p className={`text-[10px] text-slate-400 dark:text-slate-500 mt-1 ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>
          {time}
        </p>
      </div>
    </div>
  );
}
