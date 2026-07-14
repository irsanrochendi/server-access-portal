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
      {/* File preview — compact, doesn't break layout */}
      {file && (
        <div className="mb-2 p-2 bg-slate-50 dark:bg-white/5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {file.type.startsWith('image/') ? (
              <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <span className="text-lg">📎</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={removeFile} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
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
        <div className="flex-1 min-w-0">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); handleTyping(); }}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan..."
            rows={1}
            className="w-full resize-none rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
          />
          <p className="text-[10px] text-slate-400 mt-1 pl-1">Maksimal 10MB per file</p>
        </div>

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
