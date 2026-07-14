import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { api } from '../../services/api';

// Allowed extensions map for display
const EXT_DISPLAY = {
  '.pdf': 'PDF', '.doc': 'DOC', '.docx': 'DOCX', '.txt': 'TXT',
  '.png': 'PNG', '.jpg': 'JPG', '.jpeg': 'JPEG', '.gif': 'GIF',
  '.zip': 'ZIP', '.rar': 'RAR', '.exe': 'EXE', '.msi': 'MSI', '.7z': '7Z',
};

function formatAllowed(extensions) {
  return extensions
    .map(e => EXT_DISPLAY[e] || e.replace('.', '').toUpperCase())
    .join(', ');
}

export default function ChatInput({ onSend, onTyping, room }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [whitelist, setWhitelist] = useState([]);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Fetch whitelist on mount
  useEffect(() => {
    api.getChatUploadWhitelist()
      .then(data => setWhitelist(data.extensions || []))
      .catch(() => {});
  }, []);

  const handleTyping = () => {
    onTyping(room);
  };

  const handleFileChange = (e) => {
    setUploadError('');
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!whitelist.includes(ext)) {
      setUploadError(`Format tidak diizinkan. Gunakan: ${formatAllowed(whitelist)}`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(f);
  };

  const removeFile = () => {
    setFile(null);
    setUploadError('');
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
        if (data.error) throw new Error(data.error);
        fileUrl = data.file_url;
        fileName = data.file_name;
      } catch (err) {
        console.error('Upload error:', err);
        setUploadError(err.message || 'Gagal upload file');
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
    <div className="border-t border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-slate-900/50">
      {/* Upload error */}
      {uploadError && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
        </div>
      )}

      {/* File preview — modern compact chip, locked to input width */}
      {file && (
        <div className="mb-2 pl-11 pr-12">
          <div className="group flex items-center gap-3 max-w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#252532] px-3 py-2 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Paperclip className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-white/95 truncate">{file.name}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={removeFile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors flex-shrink-0"
              title="Hapus lampiran"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          title={whitelist.length > 0 ? `Lampirkan file (format: ${formatAllowed(whitelist)})` : 'Lampirkan file'}
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
            className="w-full resize-none rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#252532] px-4 py-2.5 text-sm text-slate-900 dark:text-white/95 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
          />
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
