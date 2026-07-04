import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Orbit, Sparkles, Shield, Lock, User, Zap, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [customIcon, setCustomIcon] = useState(null);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    fetch('/api/upload/icon')
      .then(r => r.json())
      .then(d => { if (d?.filename) setCustomIcon(d.filename); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin/servers' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden
      bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 dark:from-[#0a0e1a] dark:via-[#0f1729] dark:to-[#0a0e1a]">

      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo Area */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-2xl shadow-indigo-500/40 mb-5 animate-glow">
            {customIcon ? (
              <img src={`/uploads/${customIcon}`} className="w-12 h-12 object-contain" alt="" />
            ) : (
              <Orbit className="w-10 h-10 text-white animate-float" />
            )}
          </div>
          <h1 className="text-3xl font-black gradient-text tracking-tight mb-2">Portal AST</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2 font-medium">
            <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Server Access Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-3xl p-8 animate-fade-in-scale shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Welcome Back</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sign in to continue</p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-500/10 dark:to-rose-500/10 border border-red-300 dark:border-red-500/30 animate-fade-in shadow-lg shadow-red-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <p className="text-sm text-red-700 dark:text-red-400 font-semibold">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Email / Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email or username"
                  required
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl
                    glass border border-slate-300 dark:border-white/10
                    text-slate-900 dark:text-white placeholder-slate-400
                    focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20
                    text-sm font-medium transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl
                    glass border border-slate-300 dark:border-white/10
                    text-slate-900 dark:text-white placeholder-slate-400
                    focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20
                    text-sm font-medium transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-sm
                bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500
                text-white shadow-2xl shadow-indigo-500/40 hover:shadow-indigo-500/60
                transition-all duration-300 active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In to Portal
                  <Sparkles className="w-5 h-5 ml-1 opacity-80" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 mt-8 animate-fade-in">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white glass border border-slate-200 dark:border-white/10 transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" />
                Dark Mode
              </>
            )}
          </button>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
            <Zap className="w-4 h-4 text-amber-500" />
            © 2026 AST Portal
          </span>
        </div>
      </div>
    </div>
  );
}
