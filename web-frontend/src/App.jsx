import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { LoadingSpinner } from './components/Loading';

// Lazy-loaded pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const Meeting = lazy(() => import('./pages/Meeting'));

const getSafeNextPath = (search) => {
  const nextParam = new URLSearchParams(search).get('next');
  if (!nextParam) return null;
  if (!nextParam.startsWith('/') || nextParam.startsWith('//')) return null;
  return nextParam;
};

const getDefaultPathForUser = (user) => (user?.role === 'teacher' ? '/teacher' : '/student');

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  if (!user) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  if (!user) return children;

  const safeNextPath = getSafeNextPath(location.search);
  return <Navigate to={safeNextPath || getDefaultPathForUser(user)} replace />;
};

const RootRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getDefaultPathForUser(user)} replace />;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3600,
            style: {
              background: 'rgba(7, 12, 23, 0.92)',
              color: '#f8fbff',
              border: '1px solid rgba(136, 165, 191, 0.28)',
              borderRadius: '14px',
              boxShadow: '0 14px 34px rgba(0, 0, 0, 0.35)',
            },
            success: {
              iconTheme: {
                primary: '#12b886',
                secondary: '#f8fbff',
              },
            },
            error: {
              iconTheme: {
                primary: '#e5484d',
                secondary: '#f8fbff',
              },
            },
          }}
        />

        <Router>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestRoute>
                    <Register />
                  </GuestRoute>
                }
              />

              <Route
                path="/teacher"
                element={
                  <ProtectedRoute role="teacher">
                    <TeacherDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/student"
                element={
                  <ProtectedRoute role="student">
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/meet/:roomId"
                element={
                  <ProtectedRoute>
                    <Meeting />
                  </ProtectedRoute>
                }
              />

              <Route path="/" element={<RootRoute />} />
            </Routes>
          </Suspense>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
