import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '../types/types';

export const useAuthGuard = (currentUser: User | null, loading: boolean) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only check auth when not loading and route has changed
    if (loading) return;

    const publicPaths = ['/'];
    const currentPath = location.pathname;

    // If user is not authenticated and trying to access protected route
    if (!currentUser && !publicPaths.includes(currentPath)) {
      console.log(`AuthGuard: Unauthorized access attempt to ${currentPath}, redirecting to login`);
      navigate('/', { replace: true });
      return;
    }

    // If user is authenticated but accessing login page
    if (currentUser && currentPath === '/') {
      console.log('AuthGuard: Authenticated user accessing login, redirecting to dashboard');
      const redirectPath = currentUser.role === 'admin' ? '/admin-choice' : '/dashboard';
      navigate(redirectPath, { replace: true });
      return;
    }

    // Role-based route protection
    if (currentUser && currentPath.startsWith('/admin') && currentUser.role !== 'admin') {
      console.log('AuthGuard: Non-admin user attempting admin access, redirecting to user dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }

  }, [currentUser, loading, location.pathname, navigate]);

  // Prevent unauthorized access by hiding content during auth check
  const shouldShowContent = !loading && (
    location.pathname === '/' || 
    (currentUser && (
      location.pathname === '/dashboard' ||
      (location.pathname.startsWith('/admin') && currentUser.role === 'admin')
    ))
  );

  return { shouldShowContent };
};