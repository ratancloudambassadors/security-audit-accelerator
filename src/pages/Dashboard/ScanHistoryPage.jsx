import React, { useState, useEffect } from 'react';

import Card from '../../components/Card/Card';
import ScanResultsView from '../../components/ScanResultsView/ScanResultsView';

const ScanHistoryPage = () => {
  const API_BASE = window.location.hostname.includes('run.app') ? 'https://security-audit-accelerator-backend-196053730058.asia-south1.run.app' : 'http://localhost:5000';

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtering & Pagination State
  const queryParams = new URLSearchParams(window.location.search);
  const initialDate = queryParams.get('date') || '';

  const [selectedProvider, setSelectedProvider] = useState('All');
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [sortOrder, setSortOrder] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [selectedScan, setSelectedScan] = useState(null); // inline detail view

  // Fetch all scans for the user on mount
  useEffect(() => {
    const fetchAllScans = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auditscope_token');
        const queryParams = new URLSearchParams(window.location.search);
        const projectIdParam = queryParams.get('project') || 'all';

        let finalScans = [];
        if (projectIdParam !== 'all') {
          // Fetch the project to get its name
          const projRes = await fetch(`${API_BASE}/api/projects/${projectIdParam}`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (projRes.ok) {
            const projData = await projRes.json();
            // Fetch ALL scans and filter by name to handle legacy duplicates
            const allScansRes = await fetch(`${API_BASE}/api/projects/all/scans`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (allScansRes.ok) {
              const allScans = await allScansRes.json();
              finalScans = Array.isArray(allScans) ? allScans.filter(s => s.project && s.project.name === projData.name) : [];
            }
          }
        } else {
          const res = await fetch(`${API_BASE}/api/projects/all/scans`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            finalScans = Array.isArray(data) ? data : [];
          }
        }

        setScans(finalScans);
      } catch (err) {
        console.error('Failed to fetch scans:', err);
        setScans([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAllScans();
  }, [API_BASE]);

  // Compute filtered and paginated scans
  const processedData = React.useMemo(() => {
    let filtered = Array.isArray(scans) ? [...scans] : [];

    // Apply Provider Filter
    if (selectedProvider !== 'All') {
      filtered = filtered.filter(scan =>
        scan?.project?.provider?.toLowerCase() === selectedProvider.toLowerCase()
      );
    }

    // Apply Date Filter
    if (selectedDate) {
      filtered = filtered.filter(scan => {
        const d = new Date(scan.createdAt);
        const scanDateStr = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
        return scanDateStr === selectedDate;
      });
    }

    // Apply Sorting
    if (sortOrder === 'score_desc') {
      filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sortOrder === 'score_asc') {
      filtered.sort((a, b) => (a.score || 0) - (b.score || 0));
    } else if (sortOrder === 'date_desc') {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortOrder === 'date_asc') {
      filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
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
  }, [scans, selectedProvider, selectedDate, sortOrder, currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= processedData.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const openScanDetails = (scan) => {
    const findings = Array.isArray(scan.findings) ? scan.findings
      : (typeof scan.findings === 'string' ? (() => { try { return JSON.parse(scan.findings); } catch (e) { return []; } })() : []);

    let parsedPassedResources = [];
    if (typeof scan.passedResources === 'string') {
      try { parsedPassedResources = JSON.parse(scan.passedResources); } catch (e) { }
    } else if (Array.isArray(scan.passedResources)) {
      parsedPassedResources = scan.passedResources;
    }

    const vulnResSet = new Set(findings.map(f => f.resource));
    const securedCount = Math.max(0, (scan.scannedResources || 0) - vulnResSet.size);

    // Map to the shape ScanResultsView expects
    setSelectedScan({
      provider: (scan.project?.provider || 'gcp').toLowerCase(),
      score: typeof scan.score === 'number' ? scan.score : 0,
      vulnerabilities: findings,
      passedResources: parsedPassedResources,
      scanned: scan.scannedResources || 0,
      isHistory: true,
      projectName: scan.project?.name || 'Cloud Project',
      // Additional metadata for reference
      securedCount,
      vulnResCount: vulnResSet.size,
      criticalCount: scan.criticalCount || findings.filter(f => f.severity === 'Critical').length,
      highCount: scan.highCount || findings.filter(f => f.severity === 'High').length,
      mediumCount: scan.mediumCount || findings.filter(f => f.severity === 'Medium').length,
      lowCount: findings.filter(f => f.severity === 'Low').length,
      date: scan.createdAt ? new Date(scan.createdAt) : new Date(),
    });
  };

  return (
    <div style={{ paddingBottom: 'var(--spacing-4)' }}>

      {/* ── INLINE DETAIL VIEW (full parity with active scan) ── */}
      {selectedScan ? (
        <div>
          {/* Back button */}
          <button
            onClick={() => setSelectedScan(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '20px' }}
          >
            ← Back to Scan History
          </button>

          {/* Reuse the full ScanResultsView — identical UI to active scan */}
          <ScanResultsView scanDataProp={selectedScan} isHistoryView />
        </div>

      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-1)' }}>Scan History</h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                Browse previous scan results across your cloud providers.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setCurrentPage(1); }}
                  style={{ backgroundColor: 'var(--color-background-dark)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '6px 12px', color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}
                />
                {selectedDate && (
                  <button onClick={() => { setSelectedDate(''); setCurrentPage(1); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}>Clear</button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Sort by:</span>
                <select
                  value={sortOrder}
                  onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
                  style={{ backgroundColor: 'var(--color-background-dark)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '6px 12px', color: 'var(--color-text)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}
                >
                  <option value="date_desc" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Newest First</option>
                  <option value="date_asc" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Oldest First</option>
                  <option value="score_desc" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Highest Score</option>
                  <option value="score_asc" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Lowest Score</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Provider:</span>
                <select
                  value={selectedProvider}
                  onChange={(e) => { setSelectedProvider(e.target.value); setCurrentPage(1); }}
                  style={{ backgroundColor: 'var(--color-background-dark)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '6px 12px', color: 'var(--color-text)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}
                >
                  <option value="All" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>All Providers</option>
                  <option value="gcp" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Google Cloud</option>
                  <option value="aws" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>AWS</option>
                  <option value="azure" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Azure</option>
                </select>
              </div>
            </div>
          </div>{/* ← this closes the header/filter row div */}

          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-8)' }}>Loading scan history...</div>
          ) : processedData.totalItems === 0 ? (
            <Card style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-3)' }}>
              <div style={{ opacity: 0.1, marginBottom: '10px' }}>
                <svg viewBox="0 0 24 24" width="60" height="60"><path fill="var(--color-primary)" d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" /></svg>
              </div>
              <h3 style={{ color: 'var(--color-text)' }}>No scans found</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                {selectedProvider !== 'All'
                  ? `No scan history matching the ${selectedProvider.toUpperCase()} provider filter.`
                  : 'Run a multi-cloud security scan to see your history here!'}
              </p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              {(processedData?.items || []).map((scan) => {
                if (!scan) return null;
                const safeProjectName = scan.project?.name || 'Cloud Project';
                const safeProvider = (scan.project?.provider || 'gcp').toUpperCase();
                const safeScore = typeof scan.score === 'number' ? scan.score : 0;
                const safeDate = scan.createdAt ? new Date(scan.createdAt) : new Date();

                return (
                  <Card
                    key={scan.id || Math.random()}
                    style={{ padding: 'var(--spacing-4)', cursor: 'pointer', transition: 'border-color 0.2s, background-color 0.2s' }}
                    onClick={() => openScanDetails(scan)}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            fontSize: 'var(--font-size-xl)',
                            fontWeight: 800,
                            color: safeScore > 80 ? 'var(--color-success)' : safeScore > 50 ? '#eab308' : 'var(--color-danger)'
                          }}>
                            {safeScore}%
                          </div>
                          {/* Score formula tooltip */}
                          <div
                            style={{ position: 'relative', display: 'inline-flex', cursor: 'help' }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseEnter={(e) => { const t = e.currentTarget.querySelector('[data-tip]'); if (t) { t.style.opacity = '1'; t.style.visibility = 'visible'; t.style.transform = 'translateY(-50%) translateX(6px)'; } }}
                            onMouseLeave={(e) => { const t = e.currentTarget.querySelector('[data-tip]'); if (t) { t.style.opacity = '0'; t.style.visibility = 'hidden'; t.style.transform = 'translateY(-50%) translateX(0)'; } }}
                          >
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '15px', height: '15px', borderRadius: '50%',
                              border: '1.5px solid var(--color-border)',
                              backgroundColor: 'rgba(100,116,139,0.1)',
                              color: 'var(--color-text-muted)',
                              fontSize: '9px', fontWeight: 700, lineHeight: 1,
                              flexShrink: 0
                            }}>?</span>
                            <div data-tip style={{
                              opacity: 0, visibility: 'hidden',
                              transition: 'all 0.2s ease',
                              position: 'absolute',
                              top: '50%', left: '100%',
                              transform: 'translateY(-50%) translateX(0)',
                              marginLeft: '10px',
                              backgroundColor: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '10px',
                              padding: '12px 14px',
                              width: '240px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              zIndex: 200,
                              pointerEvents: 'none',
                              textAlign: 'left',
                            }}>
                              <div style={{ position: 'absolute', top: '50%', right: '100%', marginTop: '-5px', borderWidth: '5px 5px 5px 0', borderStyle: 'solid', borderColor: 'transparent var(--color-border) transparent transparent' }} />
                              <div style={{ position: 'absolute', top: '50%', right: 'calc(100% - 1px)', marginTop: '-4px', borderWidth: '4px 4px 4px 0', borderStyle: 'solid', borderColor: 'transparent var(--color-bg) transparent transparent' }} />
                              <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '11px', marginBottom: '6px' }}>🛡️ How is the Score calculated?</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text)', lineHeight: 1.6 }}>
                                <div style={{ background: 'rgba(99,102,241,0.07)', borderRadius: '6px', padding: '6px 8px', fontFamily: 'monospace', marginBottom: '7px', fontSize: '10.5px' }}>
                                  Score = (Secured Resources ÷ Total Scanned) × 100
                                </div>
                                A resource is <strong>Secured</strong> only if it has <em>zero</em> vulnerability findings. Even one finding marks it as vulnerable.
                              </div>
                              <div style={{ marginTop: '7px', fontSize: '10px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '6px' }}>
                                e.g. 190 secured out of 200 scanned → <strong style={{ color: 'var(--color-primary)' }}>95%</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                            {safeProjectName} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({safeProvider})</span>
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                            <span style={{ fontWeight: 500 }}>Date:</span> {safeDate.toLocaleDateString()} &nbsp;|&nbsp; <span style={{ fontWeight: 500 }}>Time:</span> {safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {scan.scannedResources || 0} resources scanned
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
                      </div>
                    </div>
                  </Card>
                );
              })}

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
      )}
    </div>
  );
};

export default ScanHistoryPage;