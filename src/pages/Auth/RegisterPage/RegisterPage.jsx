import React, { useState, useContext, useMemo } from 'react';
import { AuthContext } from '../../../contexts/AuthContext';
import AuthLayout from '../AuthLayout';
import Button from '../../../components/Button/Button';
import styles from './RegisterPage.module.css';
import toast from 'react-hot-toast';

// ─── Password strength scorer ────────────────────────────────────────────────
const getStrength = (pw) => {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: 'Weak',   color: '#ef4444' };
  if (score === 2) return { score: 2, label: 'Fair',   color: '#f97316' };
  if (score === 3) return { score: 3, label: 'Good',   color: '#eab308' };
  return             { score: 4, label: 'Strong', color: '#22c55e' };
};

// ─── Email format check ───────────────────────────────────────────────────────
const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

const EyeIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const RegisterPage = () => {
  const { register } = useContext(AuthContext);
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);

  // Live validations
  const strength      = useMemo(() => getStrength(password), [password]);
  const emailError    = emailTouched && email && !isValidEmail(email)
                          ? 'Please enter a valid email address'
                          : '';
  const confirmError  = confirm && confirm !== password
                          ? 'Passwords do not match'
                          : '';

  // Requirements list
  const requirements = [
    { label: 'At least 8 characters',         ok: password.length >= 8 },
    { label: 'One uppercase letter (A–Z)',     ok: /[A-Z]/.test(password) },
    { label: 'One number (0–9)',               ok: /[0-9]/.test(password) },
    { label: 'One special character (!@#…)',   ok: /[^A-Za-z0-9]/.test(password) },
  ];

  const canSubmit = name.trim()
    && email.trim()
    && isValidEmail(email)
    && strength.score >= 2        // at least Fair
    && confirm === password
    && confirm.length > 0
    && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    const toastId = toast.loading('Creating your account...');
    try {
      const result = await register(name, email, password);
      if (result.success) {
        toast.success('OTP sent to your email!', { id: toastId });
        window.location.href = `/verify-otp?email=${encodeURIComponent(result.email || email)}`;
      } else {
        toast.error(result.error || 'Failed to create account', { id: toastId });
      }
    } catch (err) {
      toast.error(err.message || 'An unexpected error occurred', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create an Account"
      subtitle="Join CA AuditScope to secure your cloud infrastructure"
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>

        {/* Full Name */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Full Name</label>
          <input
            className={styles.input}
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Email */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Work Email</label>
          <input
            className={`${styles.input} ${emailError ? styles.inputError : email && isValidEmail(email) ? styles.inputOk : ''}`}
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            required
          />
          {emailError && (
            <span className={styles.errorMsg}>⚠ {emailError}</span>
          )}
          {!emailError && email && isValidEmail(email) && (
            <span className={styles.okMsg}>✓ Valid email</span>
          )}
        </div>

        {/* Password */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Password</label>
          <div className={styles.pwWrap}>
            <input
              className={styles.input}
              type={showPw ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPw(v => !v)}
              tabIndex={-1}
            >
              <EyeIcon open={showPw} />
            </button>
          </div>

          {/* Strength bar */}
          {password && (
            <>
              <div className={styles.strengthBar}>
                {[1,2,3,4].map(i => (
                  <div
                    key={i}
                    className={styles.strengthSegment}
                    style={{
                      backgroundColor: i <= strength.score ? strength.color : 'var(--color-border)',
                      transition: 'background-color 0.25s',
                    }}
                  />
                ))}
              </div>
              <span className={styles.strengthLabel} style={{ color: strength.color }}>
                {strength.label} password
              </span>

              {/* Requirements checklist */}
              <ul className={styles.requirements}>
                {requirements.map((r) => (
                  <li key={r.label} className={r.ok ? styles.reqOk : styles.reqPending}>
                    <span className={styles.reqDot}>{r.ok ? '✓' : '○'}</span>
                    {r.label}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Confirm Password */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Confirm Password</label>
          <div className={styles.pwWrap}>
            <input
              className={`${styles.input} ${confirmError ? styles.inputError : confirm && confirm === password ? styles.inputOk : ''}`}
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowConfirm(v => !v)}
              tabIndex={-1}
            >
              <EyeIcon open={showConfirm} />
            </button>
          </div>
          {confirmError && (
            <span className={styles.errorMsg}>⚠ {confirmError}</span>
          )}
          {!confirmError && confirm && confirm === password && (
            <span className={styles.okMsg}>✓ Passwords match</span>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          className={styles.submitBtn}
          disabled={!canSubmit}
        >
          {loading ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>

      <div className={styles.termsText}>
        By signing up, you agree to our <a href="/">Terms of Service</a> and <a href="/">Privacy Policy</a>.
      </div>

      <div className={styles.footerText}>
        Already have an account? <a href="/login" className={styles.link}>Log in</a>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
