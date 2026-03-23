import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';
import Card from '../../components/Card/Card';
import ScanDetailModal from '../../components/ScanDetailModal/ScanDetailModal';

const ScanHistoryPage = () => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedScan, setSelectedScan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtering & Pagination State
  const [selectedProvider, setSelectedProvider] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Fetch all scans for the user on mount
  useEffect(() => {
    const fetchAllScans = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auditscope_token');
        const res = await fetch(`http://localhost:5000/api/projects/all/scans`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setScans(data);
      } catch (err) {
        console.error('Failed to fetch scans:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllScans();
  }, []);

  // Compute filtered and paginated scans
  const processedData = React.useMemo(() => {
    let filtered = scans;

    // Apply Provider Filter
    if (selectedProvider !== 'All') {
      filtered = filtered.filter(scan =>
        scan.project?.provider?.toLowerCase() === selectedProvider.toLowerCase()
      );
    }

    // Calculate Pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

    return {
      totalItems: filtered.length,
      items: paginatedItems,
      totalPages: totalPages
    };
  }, [scans, selectedProvider, currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= processedData.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return '#ef4444';
      case 'High': return '#f97316';
      case 'Medium': return '#eab308';
      default: return '#3b82f6';
    }
  };

  const openScanDetails = (scan) => {
    setSelectedScan(scan);
    setIsModalOpen(true);
  };

  return (
    <DashboardLayout>
      <div style={{ paddingBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-1)' }}>Scan History</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              Browse previous scan results across your cloud providers.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Filter Provider:</span>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setCurrentPage(1); // reset pagination when filter changes
              }}
              style={{
                backgroundColor: 'var(--color-background-dark)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                padding: '6px 12px',
                color: 'var(--color-text)',
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer'
              }}
            >
              <option value="All" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>All Providers</option>
              <option value="gcp" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Google Cloud (GCP)</option>
              <option value="aws" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>AWS</option>
              <option value="azure" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Azure</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-8)' }}>Loading scan history...</div>
        ) : processedData.totalItems === 0 ? (
          <Card style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-3)' }}>
            <div style={{ fontSize: '2.5rem', opacity: 0.5 }}>⏱️</div>
            <h3 style={{ color: 'var(--color-text)' }}>No scans found</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              {selectedProvider !== 'All'
                ? `No scan history matching the ${selectedProvider.toUpperCase()} provider filter.`
                : 'Run a multi-cloud security scan to see your history here!'}
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {processedData.items.map((scan) => (
              <Card 
                key={scan.id} 
                style={{ padding: 'var(--spacing-4)', cursor: 'pointer', transition: 'border-color 0.2s, background-color 0.2s' }}
                onClick={() => openScanDetails(scan)}
                className="hoverableCard"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
                    <div style={{
                      fontSize: 'var(--font-size-xl)',
                      fontWeight: 800,
                      color: scan.score > 80 ? 'var(--color-success)' : scan.score > 50 ? '#eab308' : 'var(--color-danger)'
                    }}>
                      {scan.score}%
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                        {scan.project?.name || 'Cloud Project'} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({scan.project?.provider?.toUpperCase()})</span>
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {new Date(scan.createdAt).toLocaleString()} • {scan.scannedResources} resources scanned
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center' }}>
                    {scan.criticalCount > 0 && (
                      <span style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 600 }}>
                        {scan.criticalCount} Critical
                      </span>
                    )}
                    {scan.highCount > 0 && (
                      <span style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', color: '#f97316', fontWeight: 600 }}>
                        {scan.highCount} High
                      </span>
                    )}
                    {scan.mediumCount > 0 && (
                      <span style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', color: '#eab308', fontWeight: 600 }}>
                        {scan.mediumCount} Medium
                      </span>
                    )}
                    {scan.score === 100 && (
                      <span style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: '#22c55e', fontWeight: 600 }}>
                        Perfect Score 🌟
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {/* Pagination Controls */}
            {processedData.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, processedData.totalItems)} of {processedData.totalItems} scans
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                      color: currentPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === processedData.totalPages}
                    style={{
                      padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                      color: currentPage === processedData.totalPages ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === processedData.totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ScanDetailModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        scan={selectedScan} 
      />
    </DashboardLayout>
  );
};

export default ScanHistoryPage;
