import React, { useState, useEffect, useContext, useRef } from 'react';
import styles from './DashboardNavbar.module.css';
import Select from '../../../../components/Select/Select';
import Button from '../../../../components/Button/Button';
import ScannerModal from '../../../../components/ScannerModal/ScannerModal';
import { AuthContext } from '../../../../contexts/AuthContext';

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
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleScanComplete = (e) => {
      const results = e.detail;
      if (results && results.vulnerabilities) {
        const uniqueServices = new Set();
        results.vulnerabilities.forEach(v => {
          const match = v.resource.match(/^([^(]+)/);
          if (match) uniqueServices.add(match[1].trim());
          else uniqueServices.add('Other');
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
    console.log("Scan Finished with Results:", results);
    const event = new CustomEvent('scanCompleted', { detail: results });
    window.dispatchEvent(event);
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
            <Select
              options={providerOptions}
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              placeholder="Choose Provider..."
              className={styles.selectProvider}
            />

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

            <div className={styles.userProfile} ref={profileRef} onClick={() => setProfileOpen(!profileOpen)} style={{ position: 'relative', cursor: 'pointer' }}>
              {user?.displayPicture ? (
                <img
                  src={`http://localhost:5000${user.displayPicture}`}
                  alt="Profile"
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatar}>{getInitial()}</div>
              )}


              {profileOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', padding: '8px 0', backgroundColor: '#1a1d2e', border: '1px solid #2d3148', borderRadius: 'var(--radius-md)', minWidth: '150px', boxShadow: '0 4px 12px rgba(0,0,0,0.6)', zIndex: 100 }}>
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
      />
    </>
  );
};

export default DashboardNavbar;
