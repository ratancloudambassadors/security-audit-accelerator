import React from 'react';
import LandingPage from './pages/LandingPage/LandingPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ProjectsPage from './pages/Dashboard/ProjectsPage';
import ScanHistoryPage from './pages/Dashboard/ScanHistoryPage';
import SettingsPage from './pages/Dashboard/SettingsPage';

// Auth Pages
import LoginPage from './pages/Auth/LoginPage/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage/RegisterPage';
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage/ForgotPasswordPage';
import ResetPasswordPage from './pages/Auth/ResetPasswordPage/ResetPasswordPage';
import OTPVerifyPage from './pages/Auth/OTPVerifyPage/OTPVerifyPage';

import './App.css';

import { Toaster } from 'react-hot-toast';

function App() {
  const path = window.location.pathname;

  // Dashboard sub-routes (must be checked before the generic /dashboard catch-all)
  if (path === '/dashboard/projects') return <ProjectsPage />;
  if (path === '/dashboard/history') return <ScanHistoryPage />;
  if (path === '/dashboard/settings') return <SettingsPage />;

  // The main dashboard prefix matcher
  if (path.startsWith('/dashboard')) return <DashboardPage />;

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
