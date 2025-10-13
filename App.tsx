import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './src/components/LoginPage';
import AdminDashboard from './src/components/AdminDashboard';
import OrderPage from './src/components/OrderPage';
import AdminChoicePage from './src/components/AdminChoicePage';
import ProtectedRoute from './src/components/ProtectedRoute';
import { useBillingData } from './hooks/useBillingData';
import type { User } from './types/types';
import { loginWithEmployeeID, auth, observeUser } from './src/services/authService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './src/firebase';

// Map Firebase/Auth errors to user-friendly messages
function mapAuthErrorToMessage(error: any): string {
  const code: string | undefined = error?.code || (typeof error?.message === 'string' && (error.message.match(/\((auth\/[a-zA-Z0-9-]+)\)/)?.[1]));
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Invalid Employee ID or Password';
    case 'auth/user-not-found':
      return 'Invalid Employee ID or Password';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network issue. Check your internet connection and try again.';
    case 'auth/invalid-email':
      return 'Invalid Employee ID or Password';
    case 'auth/user-disabled':
      return 'No account found for this Employee ID.';
    case 'auth/operation-not-allowed':
      return 'No account found for this Employee ID.';
    case 'auth/popup-closed-by-user':
      return 'Please try again.';
    default:
      return 'Sign-in failed. Please check your credentials and try again.';
  }
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // Add date state\n  const [sessionTimeout, setSessionTimeout] = useState<NodeJS.Timeout | null>(null); // Add session timeout
  const billingData = useBillingData({ selectedDate, currentUser }); // Pass selected date and currentUser to hook
  const navigate = useNavigate();

  // Force logout on app startup to require authentication every time
  useEffect(() => {
    const forceLogout = async () => {
      try {
        // Only sign out if there's an existing session to prevent interference with fresh logins
        if (auth.currentUser) {
          await auth.signOut();
          console.log('Cleared existing session on app startup');
        }
      } catch (error) {
        console.log('No existing session to clear on startup');
      }
      setCurrentUser(null);
    };

    forceLogout();
  }, []);

  // Disable browser cache for security
  useEffect(() => {
    // Prevent page caching
    window.history.replaceState(null, '', window.location.href);
    
    // Add cache control headers via meta tags
    const metaTag = document.createElement('meta');
    metaTag.httpEquiv = 'Cache-Control';
    metaTag.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(metaTag);

    const pragmaTag = document.createElement('meta');
    pragmaTag.httpEquiv = 'Pragma';
    pragmaTag.content = 'no-cache';
    document.head.appendChild(pragmaTag);

    const expiresTag = document.createElement('meta');
    expiresTag.httpEquiv = 'Expires';
    expiresTag.content = '0';
    document.head.appendChild(expiresTag);

    return () => {
      document.head.removeChild(metaTag);
      document.head.removeChild(pragmaTag);
      document.head.removeChild(expiresTag);
    };
  }, []);

  // Modified Firebase auth state observer - allows login but no persistence across browser restarts
  useEffect(() => {
    const unsubscribe = observeUser(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log('Auth state: User authenticated');
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setCurrentUser({ ...docSnap.data(), id: firebaseUser.uid } as User);
          } else {
            const defaultUser: User = {
              id: firebaseUser.uid,
              name: firebaseUser.email || '',
              role: 'user',
            };
            await setDoc(docRef, {
              name: firebaseUser.email || '',
              role: 'user',
              createdAt: new Date(),
            });
            setCurrentUser(defaultUser);
          }
        } else {
          console.log('Auth state: No user authenticated');
          setCurrentUser(null);
          // Ensure we're on login page when no user
          const currentPath = window.location.pathname;
          if (currentPath !== '/') {
            console.log('Auth state changed: No user, redirecting to login');
            navigate('/', { replace: true });
          }
        }
        setLoading(false);
      } catch (err: any) {
        console.error('Error in observeUser:', err);
        setLoginError(mapAuthErrorToMessage(err));
        setCurrentUser(null);
        navigate('/', { replace: true });
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Session timeout management - logout after inactivity\n  useEffect(() => {\n    let timeoutId: NodeJS.Timeout;\n    \n    const resetTimeout = () => {\n      if (timeoutId) clearTimeout(timeoutId);\n      \n      if (currentUser) {\n        // Auto logout after 30 minutes of inactivity\n        timeoutId = setTimeout(async () => {\n          console.log('Session timeout - logging out user');\n          await handleLogout();\n        }, 30 * 60 * 1000); // 30 minutes\n      }\n    };\n\n    const handleActivity = () => {\n      resetTimeout();\n    };\n\n    // Reset timeout on user activity\n    if (currentUser) {\n      resetTimeout();\n      \n      // Listen for user activity\n      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];\n      events.forEach(event => {\n        document.addEventListener(event, handleActivity, { passive: true });\n      });\n\n      return () => {\n        if (timeoutId) clearTimeout(timeoutId);\n        events.forEach(event => {\n          document.removeEventListener(event, handleActivity);\n        });\n      };\n    }\n  }, [currentUser]);\n\n  // Enhanced security: Force redirect to login for any protected route access\n  useEffect(() => {\n    const currentPath = window.location.pathname;\n    \n    // If user is not authenticated and trying to access protected routes\n    if (!currentUser && !loading && currentPath !== '/') {\n      console.log('Direct route access blocked: Not authenticated, redirecting to login');\n      navigate('/', { replace: true });\n    }\n  }, [currentUser, loading, navigate]);\n\n  // Enhanced security: Check auth state when window gains focus
  useEffect(() => {
    const handleFocus = async () => {
      if (currentUser) {
        try {
          // Verify user is still authenticated
          const user = auth.currentUser;
          if (!user) {
            console.log('Focus check: User no longer authenticated, logging out');
            setCurrentUser(null);
            navigate('/', { replace: true });
          }
        } catch (err) {
          console.error('Focus check error:', err);
          setCurrentUser(null);
          navigate('/', { replace: true });
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentUser, navigate]);

  // Enhanced browser navigation protection
  useEffect(() => {
    const handlePopstate = async (event: PopStateEvent) => {
      event.preventDefault();
      
      if (!currentUser) {
        console.log('Navigation blocked: No authenticated user');
        navigate('/', { replace: true });
        return;
      }

      const targetPath = window.location.pathname;
      
      // Check if user has access to the target path
      if (targetPath.startsWith('/admin') && currentUser.role !== 'admin') {
        console.log('Navigation blocked: Non-admin accessing admin route');
        navigate('/dashboard', { replace: true });
        return;
      }

      console.log('Navigation allowed to:', targetPath);
    };

    // Add beforeunload protection
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentUser) {
        event.preventDefault();
        event.returnValue = 'Are you sure you want to leave? You will be logged out.';
        return event.returnValue;
      }
    };

    window.addEventListener('popstate', handlePopstate);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser, navigate]);

  // Handle login from LoginPage
  const handleLogin = async (employeeID: string, phone: string) => {
    try {
      setLoading(true);
      const userCredential = await loginWithEmployeeID(employeeID, phone);
      console.log('Authenticated user:', userCredential.user);
      const docRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(docRef);
      let role: string;
      if (!docSnap.exists()) {
        role = 'faculty';
        await setDoc(docRef, {
          name: employeeID, // Store the actual employee ID instead of email
          role,
          createdAt: new Date(),
          employee: {
            employeeId: employeeID,
            email: userCredential.user.email
          }
        });
      } else {
        const data = docSnap.data();
        role = data.role;
      }
      const loggedUser: User = {
        id: userCredential.user.uid,
        name: employeeID, // Use the actual employee ID instead of email
        role: (role as 'admin' | 'user'),
        email: userCredential.user.email, // Store email separately for reference
      };
      setCurrentUser(loggedUser);
      setLoginError(null);

      // Pre-fetch data before navigation to ensure it's available immediately
      try {
        if ((billingData as any).refreshData) {
          await (billingData as any).refreshData();
        }
      } catch (e) {
        console.warn('Preload refreshData failed, continuing navigation');
      }

      // Role-based navigation
      if (role === 'admin') {
        navigate('/admin-choice', { replace: true });
      } else if (role === 'faculty') {
        navigate('/dashboard', { replace: true });
      } else {
        console.error('Invalid role assigned:', role);
        alert('Invalid role assigned.');
        await auth.signOut();
        setCurrentUser(null);
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError(mapAuthErrorToMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setCurrentUser(null);
      setLoginError(null);
      
      // Clear browser history to prevent back button access
      window.history.replaceState(null, '', '/');
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Logout error:', err);
      setLoginError(mapAuthErrorToMessage(err));
    }
  };

  const handleDateSelectionChange = (date: Date | null) => {
    setSelectedDate(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-lg text-slate-600">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          currentUser ? (
            // If user is already authenticated, redirect to appropriate dashboard
            currentUser.role === 'admin' ? (
              <Navigate to="/admin-choice" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <LoginPage 
              error={loginError} 
              clearError={() => setLoginError(null)} 
              onLogin={handleLogin}
            />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute user={currentUser} loading={loading}>
            <OrderPage
              user={currentUser}
              vegetables={billingData.vegetables}
              availableStock={billingData.availableStock}
              addBill={billingData.addBill}
              onLogout={handleLogout}
              onUpdateUser={handleUpdateUser}
              loading={(billingData as any).loading}
              onRefresh={(billingData as any).refreshData}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admindashboard"
        element={
          <ProtectedRoute user={currentUser} loading={loading} requiredRole="admin">
            <AdminDashboard
              user={currentUser}
              vegetables={billingData.vegetables}
              availableStock={billingData.availableStock}
              addVegetable={billingData.addVegetable}
              updateVegetable={billingData.updateVegetable}
              deleteVegetable={billingData.deleteVegetable}
              bills={billingData.bills}
              updateBill={billingData.updateBill}
              addBill={billingData.addBill}
              onLogout={handleLogout}
              onUpdateUser={handleUpdateUser}
              selectedDate={selectedDate}
              onDateSelectionChange={handleDateSelectionChange}
              loading={(billingData as any).loading}
              onRefresh={(billingData as any).refreshData}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-choice"
        element={
          <ProtectedRoute user={currentUser} loading={loading} requiredRole="admin">
            <AdminChoicePage />
          </ProtectedRoute>
        }
      />
      {/* Catch-all route - redirect any unknown paths to login */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
};

export default App;