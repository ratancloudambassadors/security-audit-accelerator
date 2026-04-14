import React from 'react';
import styles from './Sidebar.module.css';

// Tour target IDs map each nav item to its data-tour value
const navItems = [
  { name: 'Dashboard',   path: '/dashboard',            icon: '📊', tourId: 'tour-sidebar-dashboard'  },
  { name: 'Projects',    path: '/dashboard/projects',   icon: '📁', tourId: 'tour-sidebar-projects'   },
  { name: 'Automation',  path: '/dashboard/automation', icon: '⏰', tourId: 'tour-sidebar-automation' },
  { name: 'Scan History',path: '/dashboard/history',    icon: '⏱️', tourId: 'tour-sidebar-history'    },
];

const Sidebar = ({ currentPath }) => {
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
            const isActive =
              currentPath === item.path ||
              (currentPath.startsWith(item.path) && item.path !== '/dashboard');

            return (
              <li key={index} className={styles.navItem}>
                <a
                  href={item.path}
                  data-tour={item.tourId}
                  className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                >
                  <span className={styles.icon}>{item.icon}</span>
                  <span className={styles.linkText}>{item.name}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <a
          href="/dashboard/settings"
          data-tour="tour-sidebar-settings"
          className={`${styles.navLink} ${currentPath.includes('/settings') ? styles.active : ''}`}
        >
          <span className={styles.icon}>⚙️</span>
          <span className={styles.linkText}>Settings</span>
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
