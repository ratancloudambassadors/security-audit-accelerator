import React, { useState, useContext } from 'react';
import { AuthContext } from '../../../contexts/AuthContext';
import AuthLayout from '../AuthLayout';
import Input from '../../../components/Input/Input';
import Button from '../../../components/Button/Button';
import styles from './LoginPage.module.css';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const loginPromise = login(email, password);
    
    toast.promise(loginPromise, {
      loading: 'Logging in...',
      success: (result) => {
        if (!result.success) throw new Error(result.error);
        return 'Logged in Successfully.';
      },
      error: (err) => err.message
    }).then((result) => {
      if (result && result.success) {
        window.location.href = '/dashboard';
      }
    }).catch((err) => {
      if (err.message && err.message.toLowerCase().includes('verify')) {
        setTimeout(() => {
          window.location.href = `/verify-otp?email=${encodeURIComponent(email)}`;
        }, 1500);
      }
    })
    .finally(() => setLoading(false));
  };

  return (
    <AuthLayout 
      title="Welcome Back" 
      subtitle="Enter your credentials to access your account"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input 
          label="Email Address" 
          type="email" 
          placeholder="name@company.com" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <div className={styles.passwordGroup}>
          <Input 
            label="Password" 
            type="password" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <a href="/forgot-password" className={styles.forgotLink}>
            Forgot password?
          </a>
        </div>
        
        <Button type="submit" variant="primary" className={styles.submitBtn} loading={loading}>
          Log In
        </Button>
      </form>

      <div className={styles.footerText}>
        Don't have an account? <a href="/register" className={styles.link}>Sign up</a>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
