import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount and verify token is not expired (1-day limit)
  useEffect(() => {
    const token = localStorage.getItem('auditscope_token');
    const savedUser = localStorage.getItem('auditscope_user');

    if (token && savedUser) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();
        
        if (isExpired) {
          // Token expired (24h/1-day limit has been reached)
          localStorage.removeItem('auditscope_token');
          localStorage.removeItem('auditscope_user');
          setUser(null);
        } else {
          setUser(JSON.parse(savedUser));
        }
      } catch (err) {
        console.error('Invalid token format');
        localStorage.removeItem('auditscope_token');
        localStorage.removeItem('auditscope_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch('https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('auditscope_token', data.token);
      localStorage.setItem('auditscope_user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await fetch('https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      // Do NOT set token here; user must verify OTP first
      return { success: true, email: data.email };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const verifyOtp = async (email, otp) => {
    try {
      const response = await fetch('https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed');

      localStorage.setItem('auditscope_token', data.token);
      localStorage.setItem('auditscope_user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('auditscope_token');
    localStorage.removeItem('auditscope_user');
    localStorage.removeItem('last_viewed_scan');
    localStorage.removeItem('latest_scan_result');
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
