import React from 'react';
import styles from './AuthLayout.module.css';
import Header from '../../components/Layout/Header/Header';

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className={styles.layout}>
      {/* Shared Navbar */}
      <Header />

      {/* Background aesthetics */}
      <div className={styles.backgroundGlowTop}></div>
      <div className={styles.backgroundGlowBottom}></div>

      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <div className={styles.cardBody}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
