import React, { useState, useEffect, useMemo } from 'react';

import Section from '../../components/Section/Section';
import Card from '../../components/Card/Card';
import ScheduleModal from '../../components/ScheduleModal/ScheduleModal';

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

const DashboardPage = () => {
  const [scanData, setScanData] = useState(null);
  const [reportStatus, setReportStatus] = useState(null); // null | 'downloading' | 'sending' | 'sent' | 'error'
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState('email'); // 'email' | 'download'
  const [emailInput, setEmailInput] = useState('');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedEmailServices, setSelectedEmailServices] = useState(['ALL']);

  // Filtering and Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const servicesPerPage = 2;

  useEffect(() => {
    // Check if we came from ScanHistory with a specific scan object
    const historicalScan = localStorage.getItem('last_viewed_scan');
    const latestScan = localStorage.getItem('latest_scan_result');
    
    if (historicalScan) {
      console.log('Dashboard loading historical scan data');
      const scan = JSON.parse(historicalScan);
      setScanData(scan);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('scanCompleted', { detail: scan }));
      }, 50);
      
      localStorage.removeItem('last_viewed_scan');
    } else if (latestScan) {
      console.log('Dashboard loading latest background scan data');
      const scan = JSON.parse(latestScan);
      setScanData(scan);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('scanCompleted', { detail: scan }));
      }, 50);
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

    const handleScanStarted = () => {
      setScanData(null);
    };

    window.addEventListener('scanCompleted', handleScanComplete);
    window.addEventListener('filterByServiceChanged', handleServiceFilterChanged);
    window.addEventListener('scanStarted', handleScanStarted);
    return () => {
      window.removeEventListener('scanCompleted', handleScanComplete);
      window.removeEventListener('filterByServiceChanged', handleServiceFilterChanged);
      window.removeEventListener('scanStarted', handleScanStarted);
    };
  }, []);

  // Compute filtered and paginated results grouped by service
  const processedData = useMemo(() => {
    if (!scanData || !scanData.vulnerabilities) return { paginatedServices: [], totalPages: 0, totalItems: 0, filteredAllItems: [] };

    let filtered = scanData.vulnerabilities;

    // Apply Service Filter (from Navbar)
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(v => {
        return getServiceName(v.resource) === serviceFilter;
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

    // Group by Service
    const groups = {};
    filtered.forEach(v => {
      const sName = getServiceName(v.resource);
      if (!groups[sName]) groups[sName] = [];
      groups[sName].push(v);
    });

    const groupedServices = Object.keys(groups).sort().map(sName => ({
      name: sName,
      items: groups[sName]
    }));

    // Calculate Pagination on Services
    const totalPages = Math.ceil(groupedServices.length / servicesPerPage);
    const startIndex = (currentPage - 1) * servicesPerPage;
    const paginatedServices = groupedServices.slice(startIndex, startIndex + servicesPerPage);

    return {
      totalItems: filtered.length,
      filteredAllItems: filtered,
      paginatedServices,
      totalPages
    };
  }, [scanData, searchTerm, severityFilter, serviceFilter, currentPage]);

  const allServices = useMemo(() => {
    if (!scanData || !scanData.vulnerabilities) return [];
    const services = new Set();
    scanData.vulnerabilities.forEach(v => {
      services.add(getServiceName(v.resource));
    });
    return Array.from(services).sort();
  }, [scanData]);

  const handleServiceCheckboxChange = (service) => {
    if (service === 'ALL') {
       setSelectedEmailServices(['ALL']);
       return;
    }
    
    let newSelected = selectedEmailServices.filter(s => s !== 'ALL');
    
    if (selectedEmailServices.includes('ALL')) {
      newSelected = [service];
    } else {
      if (newSelected.includes(service)) {
         newSelected = newSelected.filter(s => s !== service);
      } else {
         newSelected.push(service);
      }
    }
    
    if (newSelected.length === 0 || newSelected.length === allServices.length) {
       newSelected = ['ALL'];
    }
    
    setSelectedEmailServices(newSelected);
  };

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
    setExportModalOpen(false);
    setReportStatus('downloading');
    try {
      let payloadData = JSON.parse(JSON.stringify(scanData));
      if (!selectedEmailServices.includes('ALL')) {
        payloadData.vulnerabilities = payloadData.vulnerabilities.filter(v => 
          selectedEmailServices.includes(getServiceName(v.resource))
        );
        payloadData.scanned = new Set(payloadData.vulnerabilities.map(v => v.resource)).size;
      }

      const token = localStorage.getItem('auditscope_token');
      const res = await fetch('https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/reports/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scanData: payloadData, selectedServices: selectedEmailServices })
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
      let payloadData = JSON.parse(JSON.stringify(scanData));
      if (!selectedEmailServices.includes('ALL')) {
        payloadData.vulnerabilities = payloadData.vulnerabilities.filter(v => 
          selectedEmailServices.includes(getServiceName(v.resource))
        );
        payloadData.scanned = new Set(payloadData.vulnerabilities.map(v => v.resource)).size;
      }

      const token = localStorage.getItem('auditscope_token');
      const res = await fetch('https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/reports/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scanData: payloadData, recipientEmail: emailInput, selectedServices: selectedEmailServices })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReportStatus('sent');
      setTimeout(() => {
        setReportStatus(null);
        setExportModalOpen(false);
        setEmailInput('');
      }, 2000);
    } catch (err) {
      console.error('Email error:', err);
      setReportStatus('error');
      setTimeout(() => setReportStatus(null), 4000);
    }
  };

  return (
    <>
      <div style={{ paddingBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--spacing-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {scanData ? `${scanData.provider.toUpperCase()} Infrastructure Overview` : 'Overview'}
              {scanData?.isHistory && (
                <span style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '10px', color: 'var(--color-text-muted)', fontWeight: 400 }}>Historical</span>
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
                    onClick={() => { setReportMenuOpen(false); setExportType('download'); setExportModalOpen(true); }}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid #2d3148', color: 'var(--color-text)', textAlign: 'left', cursor: 'pointer', fontSize: 'var(--font-size-sm)', display: 'flex', gap: '8px', alignItems: 'center' }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <span>⬇️</span> Download PDF
                  </button>
                  <button
                    onClick={() => { setReportMenuOpen(false); setExportType('email'); setExportModalOpen(true); }}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid #2d3148', color: 'var(--color-text)', textAlign: 'left', cursor: 'pointer', fontSize: 'var(--font-size-sm)', display: 'flex', gap: '8px', alignItems: 'center' }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.05)'}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,2fr)', gap: 'var(--spacing-3)' }}>
                <Card style={{ padding: 'var(--spacing-4)', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-2)', fontWeight: 700 }}>Vulnerabilities</h3>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: processedData.totalItems > 0 ? '#f43f5e' : 'var(--color-text)' }}>
                    {processedData.totalItems}
                  </div>
                </Card>
                <Card style={{ padding: 'var(--spacing-4)', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-2)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Resources
                    <div style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={(e) => e.currentTarget.lastChild.style.display = 'block'} onMouseLeave={(e) => e.currentTarget.lastChild.style.display = 'none'}>
                      <span style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', border: '1px solid var(--color-text-muted)', fontSize: '9px', fontWeight: 'bold' }}>?</span>
                      <div style={{ display: 'none', position: 'absolute', top: '100%', left: '0', marginTop: '8px', width: '220px', padding: '8px 12px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '11px', textTransform: 'none', letterSpacing: 'normal', zIndex: 100, boxShadow: 'var(--shadow-lg)' }}>
                        <strong>What is a Resource?</strong><br/>
                        A resource is any distinct infrastructure component evaluated during the scan.<br/><br/>
                        <strong>How is it counted?</strong><br/>
                        One count equals one individual entity.<br/><br/>
                        <strong>Example:</strong><br/>
                        3 Compute VMs + 2 Storage Buckets + 1 Network VPC = 6 counted Resources.
                      </div>
                    </div>
                  </h3>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)' }}>
                    {scanData?.scanned !== undefined ? scanData.scanned : new Set(processedData.filteredAllItems.map(v => v.resource)).size}
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
                          backgroundColor: 'var(--color-bg-secondary)',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0 12px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Filter by Severity:</span>
                      <select
                        value={severityFilter}
                        onChange={(e) => { setSeverityFilter(e.target.value); setCurrentPage(1); }}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'var(--color-text)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          outline: 'none',
                          padding: '8px 0',
                          minWidth: '110px'
                        }}
                      >
                        <option value="All" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}>All Severities</option>
                        <option value="Critical" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}>Critical</option>
                        <option value="High" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}>High</option>
                        <option value="Medium" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}>Medium</option>
                        <option value="Low" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}>Low</option>
                      </select>
                    </div>
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

              {processedData.paginatedServices.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
                  {processedData.paginatedServices.map((serviceGroup, gIdx) => (
                    <div key={gIdx}>
                      <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-3)', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ backgroundColor: 'var(--color-primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Service</span>
                        {serviceGroup.name}
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 'auto' }}>
                          {serviceGroup.items.length} items
                        </span>
                      </h3>
                      <Card style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '10%' }}>ID</th>
                                <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '10%' }}>Severity</th>
                                <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '20%' }}>Resource</th>
                                <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '30%' }}>Issue Description</th>
                                <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '30%' }}>Recommendation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {serviceGroup.items.map((vuln, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
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
                    </div>
                  ))}
                </div>
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

      {/* Export Report Modal */}
      {exportModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--color-bg-secondary)', padding: 'var(--spacing-6)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-2)' }}>
              {exportType === 'email' ? 'Email Report' : 'Download PDF Report'}
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-3)' }}>
              {exportType === 'email' ? 'Select services and enter the recipient email address to receive the PDF report.' : 'Select services to include in your downloaded PDF report.'}
            </p>
            
            <div style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', marginBottom: 'var(--spacing-2)', fontWeight: 600 }}>Include Services:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', padding: '8px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedEmailServices.includes('ALL')}
                    onChange={() => handleServiceCheckboxChange('ALL')}
                    style={{ cursor: 'pointer' }}
                  />
                  ALL
                </label>
                {allServices.map(service => (
                  <label key={service} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedEmailServices.includes('ALL') || selectedEmailServices.includes(service)}
                      onChange={() => handleServiceCheckboxChange(service)}
                      style={{ cursor: 'pointer' }}
                    />
                    {service}
                  </label>
                ))}
              </div>
            </div>

            {exportType === 'email' && (
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="recipient@example.com"
                style={{ width: '100%', padding: '10px 14px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', marginBottom: 'var(--spacing-4)' }}
                autoFocus
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)' }}>
              <button
                onClick={() => setExportModalOpen(false)}
                disabled={reportStatus === 'sending' || reportStatus === 'downloading'}
                style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', cursor: (reportStatus === 'sending' || reportStatus === 'downloading') ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              {exportType === 'email' ? (
                <button
                  onClick={handleEmailReport}
                  disabled={!emailInput || reportStatus === 'sending'}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: 'var(--radius-md)', cursor: (!emailInput || reportStatus === 'sending') ? 'not-allowed' : 'pointer', opacity: (!emailInput || reportStatus === 'sending') ? 0.6 : 1, display: 'flex', gap: '8px', alignItems: 'center' }}
                >
                  {reportStatus === 'sending' ? '⏳ Sending...' : '📧 Send Email'}
                </button>
              ) : (
                <button
                  onClick={handleDownloadReport}
                  disabled={reportStatus === 'downloading'}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: 'var(--radius-md)', cursor: reportStatus === 'downloading' ? 'not-allowed' : 'pointer', opacity: reportStatus === 'downloading' ? 0.6 : 1, display: 'flex', gap: '8px', alignItems: 'center' }}
                >
                  {reportStatus === 'downloading' ? '⏳ Downloading...' : '⬇️ Download'}
                </button>
              )}
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
    </>
  );
};

export default DashboardPage;
