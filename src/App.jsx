import React, { useContext, useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage/LandingPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ProjectsPage from './pages/Dashboard/ProjectsPage';
import ProjectDetailsPage from './pages/Dashboard/ProjectDetailsPage';
import ScanHistoryPage from './pages/Dashboard/ScanHistoryPage';
import SettingsPage from './pages/Dashboard/SettingsPage';
import AutomationPage from './pages/Dashboard/AutomationPage';

// Auth Pages
import LoginPage from './pages/Auth/LoginPage/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage/RegisterPage';
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage/ForgotPasswordPage';
import ResetPasswordPage from './pages/Auth/ResetPasswordPage/ResetPasswordPage';
import OTPVerifyPage from './pages/Auth/OTPVerifyPage/OTPVerifyPage';

import './App.css';

import { AuthContext } from './contexts/AuthContext';
import DashboardLayout from './pages/Dashboard/DashboardLayout';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null; // wait until auth state is resolved

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return children;
};

const DashboardRouter = ({ path }) => {
  let content = null;
  if (path === '/dashboard/projects') content = <ProjectsPage />;
  else if (path.startsWith('/dashboard/projects/') && path.split('/').length === 4) content = <ProjectDetailsPage projectId={path.split('/')[3]} />;
  else if (path === '/dashboard/history') content = <ScanHistoryPage />;
  else if (path === '/dashboard/settings') return <SettingsPage />; // Full page, no sidebar
  else if (path === '/dashboard/automation') content = <AutomationPage />;
  else content = <DashboardPage />;

  return (
    <DashboardLayout currentPath={path}>
      {content}
    </DashboardLayout>
  );
};

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);

    const handleClick = (e) => {
      const a = e.target.closest('a');
      if (a && a.href && a.origin === window.location.origin && a.target !== '_blank') {
        const isDashboard = a.pathname.startsWith('/dashboard');
        // Prevent default and use HTML5 history API for internal links
        e.preventDefault();
        window.history.pushState(null, '', a.pathname);
        setCurrentPath(a.pathname);
      }
    };
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  const path = currentPath;

  if (path.startsWith('/dashboard')) return <ProtectedRoute><DashboardRouter path={path} /></ProtectedRoute>;

  if (path === '/login') return <LoginPage />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/forgot-password') return <ForgotPasswordPage />;
  if (path === '/reset-password') return <ResetPasswordPage />;
  if (path === '/verify-otp') return <OTPVerifyPage />;

  return (
    <div className="app">
      <LandingPage />
    </div>
  );
}

export default App;
