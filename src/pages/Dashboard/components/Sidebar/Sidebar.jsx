import React from 'react';
import styles from './Sidebar.module.css';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: '📊' },
  { name: 'Projects', path: '/dashboard/projects', icon: '📁' },
  { name: 'Automation', path: '/dashboard/automation', icon: '⏰' },
  { name: 'Scan History', path: '/dashboard/history', icon: '⏱️' },
];

const Sidebar = () => {
  // Simplistic method to determine active link purely statically for now
  const currentPath = window.location.pathname;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <a href="/" className={styles.logo}>
          <img src="/assets/logo.png" alt="Logo" className={styles.logoImg} />
        </a>
      </div>

      <nav className={styles.navContainer}>
        <ul className={styles.navList}>
          {navItems.map((item, index) => {
            const isActive = currentPath === item.path || (currentPath.startsWith(item.path) && item.path !== '/dashboard');

            return (
              <li key={index} className={styles.navItem}>
                <a
                  href={item.path}
                  className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                >
                  <span className={styles.icon}>{item.icon}</span>
                  <span className={styles.linkText}>{item.name}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <a href="/dashboard/settings" className={`${styles.navLink} ${currentPath.includes('/settings') ? styles.active : ''}`}>
          <span className={styles.icon}>⚙️</span>
          <span className={styles.linkText}>Settings</span>
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
