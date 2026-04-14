import React, { useState, useEffect, useContext, useRef } from 'react';
import styles from './DashboardNavbar.module.css';
import Select from '../../../../components/Select/Select';
import Button from '../../../../components/Button/Button';
import ScannerModal from '../../../../components/ScannerModal/ScannerModal';
import { AuthContext } from '../../../../contexts/AuthContext';

const getServiceName = (resource) => {
  const match = resource.match(/^([^(]+)/);
  let sName = match ? match[1].trim() : 'Other';
  const lowerName = sName.toLowerCase();
  
  if (lowerName.includes('compute')) return 'Compute Engine';
  if (lowerName.includes('iam')) return 'IAM';
  if (lowerName.includes('storage') || lowerName.includes('bucket')) return 'Storage';
  if (lowerName.includes('sql') || lowerName.includes('database')) return 'Database';
  if (lowerName.includes('network') || lowerName.includes('vpc') || lowerName.includes('firewall') || lowerName.includes('router') || lowerName.includes('route')) return 'Network';
  if (lowerName.includes('kubernetes') || lowerName.includes('gke') || lowerName.includes('eks')) return 'Kubernetes';
  if (lowerName.includes('kms') || lowerName.includes('key')) return 'KMS';
  if (lowerName.includes('func') || lowerName.includes('lambda')) return 'Functions';
  
  return sName;
};

const defaultServiceOptions = [
  { value: 'all', label: 'All Services' }
];

const providerOptions = [
  { value: 'aws', label: 'Amazon Web Services (AWS)' },
  { value: 'gcp', label: 'Google Cloud Platform (GCP)' },
  { value: 'azure', label: 'Microsoft Azure' },
];

const DashboardNavbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [selectedService, setSelectedService] = useState('all');
  const [dynamicServiceOptions, setDynamicServiceOptions] = useState(defaultServiceOptions);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scanBackgroundStatus, setScanBackgroundStatus] = useState('idle'); // idle, scanning, completed
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleScanComplete = (e) => {
      const results = e.detail;
      if (results && results.vulnerabilities) {
        const uniqueServices = new Set();
        results.vulnerabilities.forEach(v => {
          uniqueServices.add(getServiceName(v.resource));
        });

        const newOptions = [
          { value: 'all', label: 'All Services' },
          ...Array.from(uniqueServices).sort().map(s => ({ value: s, label: s }))
        ];
        setDynamicServiceOptions(newOptions);
        setSelectedService('all');
        if (results.provider) setSelectedProvider(results.provider);
      }
    };
    window.addEventListener('scanCompleted', handleScanComplete);
    return () => window.removeEventListener('scanCompleted', handleScanComplete);
  }, []);

  useEffect(() => {
    const event = new CustomEvent('filterByServiceChanged', { detail: selectedService });
    window.dispatchEvent(event);
  }, [selectedService]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleScanClick = () => {
    if (selectedProvider) {
      setIsModalOpen(true);
    }
  };

  const handleScanComplete = (results) => {
    // Store in localStorage for DashboardPage to pick up when it mounts
    localStorage.setItem('last_viewed_scan', JSON.stringify(results));
    
    // Ensure Dashboard picks up the update if already mounted
    window.dispatchEvent(new CustomEvent('scanCompleted', { detail: results }));
    
    // Navigate to the Dashboard page directly
    window.history.pushState(null, '', '/dashboard');
    window.dispatchEvent(new Event('popstate'));
  };

  const getInitial = () => {
    if (user && user.name) return user.name.charAt(0).toUpperCase();
    if (user && user.email) return user.email.charAt(0).toUpperCase();
    return 'A';
  };

  return (
    <>
      <header className={styles.navbar}>
        <div className={styles.mobileMenuToggle}>
          <span className={styles.hamburger}>☰</span>
        </div>

        <div className={styles.navControls}>
          <div className={styles.controlGroup}>
            <span className={styles.label}>Filter:</span>
            <Select
              options={dynamicServiceOptions}
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className={styles.selectFilter}
            />
          </div>

          <div className={styles.actionGroup}>
            {scanBackgroundStatus !== 'idle' && (
              <button 
                className={`${styles.scanIndicator} ${scanBackgroundStatus === 'completed' ? styles.scanIndicatorCompleted : ''}`} 
                onClick={() => setIsModalOpen(true)}
                title={scanBackgroundStatus === 'completed' ? "Scan Complete - View Results" : "Scan in Progress - View Details"}
              >
                {scanBackgroundStatus === 'completed' ? '✓' : ''}
              </button>
            )}

            <div data-tour="tour-navbar-provider">
              <Select
                options={providerOptions}
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                placeholder="Choose Provider..."
                className={styles.selectProvider}
              />
            </div>

            <div data-tour="tour-navbar-scan">
              <Button
                variant={selectedProvider ? "primary" : "secondary"}
                size="small"
                className={styles.scanBtn}
                disabled={!selectedProvider}
                onClick={handleScanClick}
                title={!selectedProvider ? "Please select a provider first" : "Start Audit Scan"}
              >
                Scan
              </Button>
            </div>

            <div
              data-tour="tour-navbar-profile"
              className={styles.userProfile}
              ref={profileRef}
              onClick={() => setProfileOpen(!profileOpen)}
              style={{ position: 'relative', cursor: 'pointer' }}
            >
              {user?.displayPicture ? (
                <img
                  src={user.displayPicture.startsWith('data:') ? user.displayPicture : `https://security-audit-accelerator-backend-196053730058.asia-south1.run.app${user.displayPicture}`}
                  alt="Profile"
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatar}>{getInitial()}</div>
              )}


              {profileOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', padding: '8px 0', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', minWidth: '200px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100 }}>
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>{user?.name || 'User'}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{user?.email || ''}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); logout(); }}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <ScannerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        provider={selectedProvider}
        onScanComplete={handleScanComplete}
        onScanStatusChange={setScanBackgroundStatus}
      />
    </>
  );
};

export default DashboardNavbar;
