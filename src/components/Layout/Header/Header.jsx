import React from 'react';
import styles from './Header.module.css';
import Button from '../../Button/Button';

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerContent}`}>
        <div className={styles.logo}>
          <a href="/">
            <img src="/assets/logo.png" alt="Logo" className={styles.logoImg} />
          </a>
        </div>

        <nav className={styles.nav}>
          <ul className={styles.navList}>
            <li><a href="#features" className={styles.navLink}>Features</a></li>
            <li><a href="#about-us" className={styles.navLink}>About Us</a></li>
            <li><a href="#how-it-works" className={styles.navLink}>How it Works</a></li>
            <li><a href="#pricing" className={styles.navLink}>Pricing</a></li>
          </ul>
        </nav>

        <div className={styles.actions}>
          <a href="/login" className={`${styles.loginBtn}`} style={{ textDecoration: 'none' }}>
            <Button variant="ghost" as="span">Log In</Button>
          </a>
          <Button variant="primary" onClick={() => window.location.href = '/register'}>Free Scan</Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
