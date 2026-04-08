import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from './DashboardLayout';
import Section from '../../components/Section/Section';
import Card from '../../components/Card/Card';
import ScheduleModal from '../../components/ScheduleModal/ScheduleModal';

const DashboardPage = () => {
  const [scanData, setScanData] = useState(null);
  const [reportStatus, setReportStatus] = useState(null); // null | 'downloading' | 'sending' | 'sent' | 'error'
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // Filtering and Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    // Check if we came from ScanHistory with a specific scan object
    const historicalScan = localStorage.getItem('last_viewed_scan');
    if (historicalScan) {
      console.log('Dashboard loading historical scan data');
      const scan = JSON.parse(historicalScan);
      setScanData(scan);
      
      // Dispatch event so Navbar knows to update its Service dropdown options
      // Use short timeout to ensure Navbar's event listener is ready.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('scanCompleted', { detail: scan }));
      }, 50);
      
      // Clean up so it doesn't persist forever on refresh
      localStorage.removeItem('last_viewed_scan');
    }
  }, []);

  useEffect(() => {
    const handleScanComplete = (e) => {
      console.log('Dashboard received new scan data:', e.detail);
      setScanData(e.detail);
      // Reset filters on new scan
      setSearchTerm('');
      setSeverityFilter('All');
      setServiceFilter('all');
      setCurrentPage(1);
    };

    const handleServiceFilterChanged = (e) => {
      setServiceFilter(e.detail);
      setCurrentPage(1);
    };

    window.addEventListener('scanCompleted', handleScanComplete);
    window.addEventListener('filterByServiceChanged', handleServiceFilterChanged);
    return () => {
      window.removeEventListener('scanCompleted', handleScanComplete);
      window.removeEventListener('filterByServiceChanged', handleServiceFilterChanged);
    };
  }, []);

  // Compute filtered and paginated results
  const processedData = useMemo(() => {
    if (!scanData || !scanData.vulnerabilities) return { items: [], totalPages: 0 };

    let filtered = scanData.vulnerabilities;

    // Apply Service Filter (from Navbar)
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(v => {
        const match = v.resource.match(/^([^(]+)/);
        const sName = match ? match[1].trim() : 'Other';
        return sName === serviceFilter;
      });
    }

    // Apply Severity Filter
    if (severityFilter !== 'All') {
      filtered = filtered.filter(v => v.severity === severityFilter);
    }

    // Apply Search Filter (searches resource name, ID, or issue description)
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.resource.toLowerCase().includes(lowerTerm) ||
        v.id.toLowerCase().includes(lowerTerm) ||
        v.issue.toLowerCase().includes(lowerTerm)
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
  }, [scanData, searchTerm, severityFilter, serviceFilter, currentPage]);

  // Handle page change ensuring boundaries
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= processedData.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return '#ef4444'; // Red
      case 'High': return '#f97316'; // Orange
      case 'Medium': return '#eab308'; // Yellow
      case 'Low': return '#3b82f6'; // Blue
      default: return 'var(--color-text)';
    }
  };

  const handleDownloadReport = async () => {
    if (!scanData) return;
    setReportMenuOpen(false);
    setReportStatus('downloading');
    try {
      const token = localStorage.getItem('auditscope_token');
      const res = await fetch('https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/reports/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scanData })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AuditScope_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setReportStatus(null);
    } catch (err) {
      console.error('Download error:', err);
      setReportStatus('error');
      setTimeout(() => setReportStatus(null), 4000);
    }
  };

  const handleEmailReport = async () => {
    if (!scanData || !emailInput) return;
    setReportStatus('sending');
    try {
      const token = localStorage.getItem('auditscope_token');
      const res = await fetch('https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/reports/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scanData, recipientEmail: emailInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReportStatus('sent');
      setTimeout(() => {
        setReportStatus(null);
        setEmailModalOpen(false);
        setEmailInput('');
      }, 2000);
    } catch (err) {
      console.error('Email error:', err);
      setReportStatus('error');
      setTimeout(() => setReportStatus(null), 4000);
    }
  };

  return (
    <DashboardLayout>
      <div style={{ paddingBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--spacing-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {scanData ? `${scanData.provider.toUpperCase()} Infrastructure Overview` : 'Overview'}
              {scanData?.isHistory && (
                <span style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--color-text-muted)', fontWeight: 400 }}>Historical</span>
              )}
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              {scanData ? (scanData.isHistory ? 'Historical security audit results.' : 'Latest security audit results.') : 'Select a Cloud Provider and click "Scan" to begin.'}
            </p>
          </div>
          {scanData && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setReportMenuOpen(!reportMenuOpen)}
                disabled={reportStatus === 'downloading' || reportStatus === 'sending'}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (reportStatus === 'downloading' || reportStatus === 'sending') ? 'wait' : 'pointer',
                  background: reportStatus === 'sent' ? 'var(--color-success)' : reportStatus === 'error' ? 'var(--color-danger)' : 'var(--color-primary)',
                  color: '#000',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em'
                }}
              >
                {reportStatus === 'downloading' ? '⏳ Downloading...' :
                  reportStatus === 'sending' ? '⏳ Sending Email...' :
                    reportStatus === 'sent' ? '✅ Success' :
                      reportStatus === 'error' ? '❌ Failed' :
                        <>📄 Report <span style={{ fontSize: '10px', marginLeft: '2px' }}>▼</span></>}
              </button>

              {reportMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  minWidth: '180px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                  zIndex: 100,
                  overflow: 'hidden'
                }}>
                  <button
                    onClick={handleDownloadReport}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid #2d3148', color: 'var(--color-text)', textAlign: 'left', cursor: 'pointer', fontSize: 'var(--font-size-sm)', display: 'flex', gap: '8px', alignItems: 'center' }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <span>⬇️</span> Download PDF
                  </button>
                  <button
                    onClick={() => { setReportMenuOpen(false); setEmailModalOpen(true); }}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid #2d3148', color: 'var(--color-text)', textAlign: 'left', cursor: 'pointer', fontSize: 'var(--font-size-sm)', display: 'flex', gap: '8px', alignItems: 'center' }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <span>📧</span> Send via Email
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {scanData ? (
          <>
            {/* Metrics overview */}
            <Section style={{ padding: 0, marginBottom: 'var(--spacing-6)' }} darker={false}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,2fr)', gap: 'var(--spacing-3)' }}>
                <Card style={{ padding: 'var(--spacing-4)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}>
                  <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-2)', fontWeight: 700 }}>Safety Score</h3>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: scanData.score > 80 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {scanData.score}%
                  </div>
                </Card>
                <Card style={{ padding: 'var(--spacing-4)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}>
                  <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-2)', fontWeight: 700 }}>Vulnerabilities</h3>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: scanData.vulnerabilities.length > 0 ? '#f43f5e' : 'var(--color-text)' }}>
                    {scanData.vulnerabilities.length}
                  </div>
                </Card>
                <Card style={{ padding: 'var(--spacing-4)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}>
                  <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-2)', fontWeight: 700 }}>Resources</h3>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)' }}>
                    {scanData.scanned}
                  </div>
                </Card>
                <Card style={{ padding: 'var(--spacing-3)', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--color-bg-secondary)' }}>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', height: '42px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Search resources, IDs..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: 'rgba(0,0,0,0.25)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          padding: '0 12px 0 32px',
                          color: 'var(--color-text)',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '14px' }}>🔍</span>
                    </div>
                    <select
                      value={severityFilter}
                      onChange={(e) => { setSeverityFilter(e.target.value); setCurrentPage(1); }}
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.25)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        padding: '0 12px',
                        color: 'var(--color-text)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        outline: 'none',
                        minWidth: '160px'
                      }}
                    >
                      <optgroup label="Filter Based on Severity">
                        <option value="All" style={{ background: '#1a1d2e', color: '#fff' }}>All Severities</option>
                        <option value="Critical" style={{ background: '#1a1d2e', color: '#fff' }}>Critical</option>
                        <option value="High" style={{ background: '#1a1d2e', color: '#fff' }}>High</option>
                        <option value="Medium" style={{ background: '#1a1d2e', color: '#fff' }}>Medium</option>
                        <option value="Low" style={{ background: '#1a1d2e', color: '#fff' }}>Low</option>
                      </optgroup>
                    </select>
                  </div>
                </Card>
              </div>
            </Section>

            {/* Data Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
                <h2 style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>Vulnerability Findings <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({processedData.totalItems})</span></h2>

                {/* Pagination Controls */}
                {processedData.totalPages > 1 && (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: 'var(--font-size-sm)' }}>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      style={{ padding: '2px 8px', background: 'var(--color-background-light)', border: '1px solid var(--color-border)', borderRadius: '4px', color: currentPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Prev
                    </button>
                    <span style={{ margin: '0 8px', color: 'var(--color-text-muted)' }}>
                      Page {currentPage} of {processedData.totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === processedData.totalPages}
                      style={{ padding: '2px 8px', background: 'var(--color-background-light)', border: '1px solid var(--color-border)', borderRadius: '4px', color: currentPage === processedData.totalPages ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === processedData.totalPages ? 'not-allowed' : 'pointer' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {processedData.items.length > 0 ? (
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '10%' }}>ID</th>
                          <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '10%' }}>Severity</th>
                          <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '20%' }}>Resource</th>
                          <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '30%' }}>Issue Description</th>
                          <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '30%' }}>Recommendation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedData.items.map((vuln, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                              {vuln.id}
                            </td>
                            <td style={{ padding: 'var(--spacing-2) var(--spacing-3)' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                backgroundColor: `${getSeverityColor(vuln.severity)}20`,
                                color: getSeverityColor(vuln.severity),
                                fontWeight: 600,
                                fontSize: '10px',
                                textTransform: 'uppercase'
                              }}>
                                {vuln.severity}
                              </span>
                            </td>
                            <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-text)' }}>
                              {vuln.resource}
                            </td>
                            <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-text-muted)' }}>
                              {vuln.issue}
                            </td>
                            <td style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-primary)', opacity: 0.9 }}>
                              {vuln.remediation || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-background-light)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)' }}>
                  No vulnerabilities match the current filters.
                </div>
              )}
            </div>
          </>
        ) : (
          <Section style={{ padding: 0 }} darker={false}>
            <Card style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-4)' }}>
              <div style={{ fontSize: '3rem', opacity: 0.5 }}>☁️</div>
              <h3 style={{ color: 'var(--color-text)' }}>No active scans</h3>
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '400px', fontSize: 'var(--font-size-sm)' }}>
                Select "GCP" from the Choose Provider dropdown in the navigation bar and hit the Scan button to run a comprehensive multi-service audit.
              </p>
            </Card>
          </Section>
        )}
      </div>

      {/* Email Report Modal */}
      {emailModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#1a1d2e', padding: 'var(--spacing-6)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px', border: '1px solid #2d3148', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-2)' }}>Email Report</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-4)' }}>Enter the recipient email address to receive the full PDF report.</p>
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="recipient@example.com"
              style={{ width: '100%', padding: '10px 14px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 'var(--radius-md)', color: '#fff', marginBottom: 'var(--spacing-4)' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)' }}>
              <button
                onClick={() => setEmailModalOpen(false)}
                disabled={reportStatus === 'sending'}
                style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #334155', color: '#cbd5e1', borderRadius: 'var(--radius-md)', cursor: reportStatus === 'sending' ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleEmailReport}
                disabled={!emailInput || reportStatus === 'sending'}
                style={{ padding: '8px 16px', backgroundColor: '#06b6d4', border: 'none', color: '#fff', borderRadius: 'var(--radius-md)', cursor: (!emailInput || reportStatus === 'sending') ? 'not-allowed' : 'pointer', opacity: (!emailInput || reportStatus === 'sending') ? 0.6 : 1, display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                {reportStatus === 'sending' ? '⏳ Sending...' : '📧 Send Email'}
              </button>
            </div>
            {reportStatus === 'error' && (
              <p style={{ color: '#ef4444', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-3)', textAlign: 'center' }}>Failed to send email. Check backend logs or SMTP config.</p>
            )}
            {reportStatus === 'sent' && (
              <p style={{ color: '#22c55e', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-3)', textAlign: 'center' }}>Email sent successfully!</p>
            )}
          </div>
        </div>
      )}

      <ScheduleModal 
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        projectId={scanData?.dbProjectId}
        projectName={scanData?.provider?.toUpperCase() || 'Cloud'}
      />
    </DashboardLayout>
  );
};

export default DashboardPage;
