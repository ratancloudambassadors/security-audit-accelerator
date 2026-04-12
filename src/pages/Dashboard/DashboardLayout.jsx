import React from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import DashboardNavbar from './components/DashboardNavbar/DashboardNavbar';
import styles from './DashboardLayout.module.css';

const DashboardLayout = ({ children, currentPath }) => {
  return (
    <div className={styles.dashboardContainer}>
      <Sidebar currentPath={currentPath} />
      <div className={styles.mainContentArea}>
        <DashboardNavbar />
        <main className={styles.pageContent}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
