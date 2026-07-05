import { useAuth } from '../contexts/AuthContext';
import { useResources } from '../contexts/ResourceContext';
import ResourceGrid from '../components/ResourceGrid';
import OnlineUsers from './OnlineUsers';
import { Users } from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { resources, loading } = useResources();

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Selamat Datang, {user?.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Akses resource perusahaan Anda
          </p>
        </div>

        {/* Online Users Widget */}
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Online Users</h2>
          </div>
          <OnlineUsers compact />
        </div>

        {/* Resource Grid */}
        <ResourceGrid resources={resources} loading={loading} />
      </div>
    );
  }

  // Admin view — konten admin yang sudah ada (servers, statistik, dll)
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
        Admin Dashboard
      </h1>
      {/* Konten admin dashboard existing — bisa pindah dari AdminServers atau buat overview */}
      <p className="text-slate-500 dark:text-slate-400">
        Selamat datang di panel admin. Gunakan menu sidebar untuk mengelola server, user, dan resource.
      </p>
    </div>
  );
}
