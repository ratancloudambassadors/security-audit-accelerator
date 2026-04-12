import React, { useContext } from 'react';
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

import { Toaster } from 'react-hot-toast';
import { AuthContext } from './contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null; // wait until auth state is resolved

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return children;
};

function App() {
  const path = window.location.pathname;

  // Dashboard sub-routes (must be checked before the generic /dashboard catch-all)
  if (path === '/dashboard/projects') return <ProtectedRoute><ProjectsPage /></ProtectedRoute>;
  if (path.startsWith('/dashboard/projects/') && path.split('/').length === 4) return <ProtectedRoute><ProjectDetailsPage projectId={path.split('/')[3]} /></ProtectedRoute>;
  if (path === '/dashboard/history') return <ProtectedRoute><ScanHistoryPage /></ProtectedRoute>;
  if (path === '/dashboard/settings') return <ProtectedRoute><SettingsPage /></ProtectedRoute>;
  if (path === '/dashboard/automation') return <ProtectedRoute><AutomationPage /></ProtectedRoute>;

  // The main dashboard prefix matcher
  if (path.startsWith('/dashboard')) return <ProtectedRoute><DashboardPage /></ProtectedRoute>;

  if (path === '/login') return <LoginPage />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/forgot-password') return <ForgotPasswordPage />;
  if (path === '/reset-password') return <ResetPasswordPage />;
  if (path === '/verify-otp') return <OTPVerifyPage />;

  return (
    <div className="app">
      <Toaster position="top-right" />
      <LandingPage />
    </div>
  );
}

export default App;
