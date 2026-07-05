import { useState } from 'react';
import { Globe, Terminal, Monitor, ExternalLink, Copy, Check, Lock, Key } from 'lucide-react';
import { api } from '../services/api';

const typeIcons = {
  web: Globe,
  rdp: Monitor,
  ssh: Terminal,
};

const typeColors = {
  web: 'from-blue-500 to-cyan-500',
  rdp: 'from-purple-500 to-pink-500',
  ssh: 'from-emerald-500 to-teal-500',
};

export default function ResourceCard({ resource }) {
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const Icon = typeIcons[resource.type] || Globe;

  const handleClick = async () => {
    if (resource.type === 'web') {
      if (resource.auto_login_enabled) {
        setLoading(true);
        try {
          const creds = await api.getResourceCredentials(resource.id);
          setCredentials(creds);
          setShowPassword(true);
        } catch (e) {
          window.open(resource.url, '_blank');
        }
        setLoading(false);
      } else {
        window.open(resource.url, '_blank');
      }
    } else {
      // RDP or SSH - show connection modal
      setLoading(true);
      try {
        const creds = await api.getResourceCredentials(resource.id);
        setCredentials(creds);
        setShowPassword(true);
      } catch (e) {
        setShowPassword(true);
      }
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categoryColors = {
    web: 'border-blue-200 dark:border-blue-500/30',
    rdp: 'border-purple-200 dark:border-purple-500/30',
    ssh: 'border-emerald-200 dark:border-emerald-500/30',
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`w-full text-left bg-white dark:bg-white/5 rounded-2xl border ${categoryColors[resource.type] || 'border-slate-200 dark:border-white/10'} p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${typeColors[resource.type] || 'from-gray-400 to-gray-500'} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate text-sm">{resource.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{resource.url}</p>
          </div>
          {resource.has_password && (
            <div className="flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center" title="Kredensial tersimpan">
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          )}
        </div>

        {/* Category badge */}
        {resource.category && (
          <div className="mb-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
              {resource.category}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500">Klik untuk akses</span>
          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
        </div>
      </button>

      {/* Password / Credentials Modal */}
      {showPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowPassword(false); setCredentials(null); }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`bg-gradient-to-r ${typeColors[resource.type] || 'from-gray-400 to-gray-500'} p-4`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{resource.name}</h3>
                  <p className="text-white/70 text-xs">{resource.url}</p>
                </div>
              </div>
            </div>

            {/* Credentials */}
            <div className="p-5 space-y-4">
              {credentials ? (
                <>
                  {credentials.username && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Username</p>
                      <div className="flex items-center gap-2">
                        <input readOnly value={credentials.username} className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white" />
                        <button onClick={() => handleCopy(credentials.username)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {credentials.password && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Password</p>
                      <div className="flex items-center gap-2">
                        <input readOnly type={copied ? 'text' : 'password'} value={credentials.password} className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white" />
                        <button onClick={() => handleCopy(credentials.password)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <button onClick={() => window.open(credentials.url || resource.url, '_blank')} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Buka Resource
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Tidak ada kredensial</p>
                  <button onClick={() => window.open(resource.url, '_blank')} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Buka Resource
                  </button>
                </div>
              )}

              <button onClick={() => { setShowPassword(false); setCredentials(null); }} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
