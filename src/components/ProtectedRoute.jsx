import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();

  // Belum login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Cek role jika diperlukan
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children || <Outlet />;
}
