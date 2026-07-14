import { FileText, Download, Image } from 'lucide-react';
import { useState } from 'react';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];

function isImage(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return IMAGE_EXTS.some(ext => lower.endsWith(ext));
}

export default function MessageBubble({ message, isOwn }) {
  const time = new Date(message.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const [imgError, setImgError] = useState(false);

  const attachmentUrl = message.attachment_url || message.file_url;
  const attachmentName = message.attachment_name || message.file_name;
  const hasImage = attachmentUrl && isImage(attachmentUrl);

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
          {attachmentUrl ? (
            hasImage && !imgError ? (
              <div className="mb-1">
                <a href={attachmentUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={attachmentUrl}
                    alt={attachmentName || 'Image'}
                    className="max-w-full max-h-64 rounded-lg object-cover"
                    onError={() => setImgError(true)}
                  />
                </a>
                {attachmentName && (
                  <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-slate-400'}`}>
                    {attachmentName}
                  </p>
                )}
              </div>
            ) : (
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 ${isOwn ? 'text-white hover:text-blue-100' : 'text-blue-600 dark:text-blue-400 hover:underline'}`}
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{attachmentName || 'File'}</span>
                <Download className="w-3.5 h-3.5 ml-1 flex-shrink-0" />
              </a>
            )
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {/* Content text below image */}
          {attachmentUrl && message.content && (
            <p className="text-sm whitespace-pre-wrap break-words mt-1">{message.content}</p>
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
