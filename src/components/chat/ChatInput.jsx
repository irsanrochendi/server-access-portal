import { useState, useRef } from 'react';
import { Send, Paperclip, X } from 'lucide-react';

export default function ChatInput({ onSend, onTyping, room }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);

  const handleTyping = () => {
    onTyping(room);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!text.trim() && !file) return;

    let fileUrl = null;
    let fileName = null;

    if (file) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem('portal_token');
        const res = await fetch(`/api/chat/rooms/${encodeURIComponent(room)}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        fileUrl = data.file_url;
        fileName = data.file_name;
      } catch (err) {
        console.error('Upload error:', err);
        alert('Gagal upload file');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSend(text.trim() || null, fileUrl, fileName);
    setText('');
    removeFile();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-white/[0.02]">
      {/* File preview */}
      {file && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
            📎 {file.name}
            <button onClick={removeFile} className="ml-1 text-slate-400 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          title="Lampirkan file"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Ketik pesan..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={uploading || (!text.trim() && !file)}
          className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white transition-colors flex-shrink-0 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
