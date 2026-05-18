import React, { useState, useEffect, useMemo } from 'react';

import Section from '../../components/Section/Section';
import Card from '../../components/Card/Card';
import ScheduleModal from '../../components/ScheduleModal/ScheduleModal';

const getServiceName = (resource) => {
  const match = resource.match(/^([^(]+)/);
  let sName = match ? match[1].trim() : 'Other';
  const lowerName = sName.toLowerCase();

  let mapped = sName;
  if (lowerName.includes('compute') || lowerName.includes('vm')) mapped = 'Compute';
  else if (lowerName.includes('iam') || lowerName.includes('service account')) mapped = 'IAM';
  else if (lowerName.includes('storage') || lowerName.includes('bucket')) mapped = 'Storage';
  else if (lowerName.includes('sql') || lowerName.includes('database') || lowerName.includes('rds')) mapped = 'Database';
  else if (lowerName.includes('network') || lowerName.includes('vpc') || lowerName.includes('firewall') || lowerName.includes('dns') || lowerName.includes('subnet')) mapped = 'Networking';
  else if (lowerName.includes('kubernetes') || lowerName.includes('gke') || lowerName.includes('eks')) mapped = 'Kubernetes';
  else if (lowerName.includes('kms') || lowerName.includes('key')) mapped = 'KMS';
  else if (lowerName.includes('func') || lowerName.includes('lambda') || lowerName.includes('serverless') || lowerName.includes('cloudrun')) mapped = 'Serverless';
  else if (lowerName.includes('load balancer') || lowerName.includes('backend service') || lowerName.includes('lb')) mapped = 'Load Balancers';
  else if (lowerName.includes('bigquery') || lowerName.includes('bq') || lowerName.includes('dataset') || lowerName.includes('table')) mapped = 'BigQuery';
  else if (lowerName.includes('dataproc')) mapped = 'Dataproc';

  console.log(`[Dashboard] Mapping resource "${resource}" -> "${mapped}"`);
  return mapped;
};

const getCheckpointName = (id) => {
  if (!id) return 'General Check';
  const parts = id.split('-');
  const checkType = parts[2] ? parts[2].toUpperCase() : 'GENERAL';

  const mapping = {
    'PUBLIC': 'Check Public Access',
    'EXTERNAL': 'Check External Access',
    'ENCRYPTION': 'Check Encryption',
    'ROTATION': 'Check Key Rotation',
    'ADMIN': 'Check Admin Access',
    'SOD': 'Check Separation of Duties',
    'TOKEN': 'Check SA Tokens',
    'KEY': 'Check SA Keys',
    'SSL': 'Check SSL Policy',
    'IP': 'Check IP Config',
    'LOG': 'Check Logging',
    'LBLOG': 'Check LB Logging',
    'MONITOR': 'Check Monitoring',
    'FIREWALL': 'Check Firewall Rules',
    'VERSION': 'Check Software Version',
    'SA': 'Check Service Accounts',
    'GKE': 'Check Kubernetes',
    'FLOW': 'Check VPC Flow Logs',
    'ENDPOINT': 'Check API Endpoint',
    'ABAC': 'Check Legacy ABAC',
    'WORKLOAD': 'Check Workload Identity',
    'SHIELDED': 'Check Shielded Nodes',
    'BINARY': 'Check Binary Auth',
    'RDS': 'Check RDS Public',
    'EKS': 'Check EKS Public',
    'SERVERLESS': 'Check Serverless',
    'DATASET': 'Check BigQuery Dataset'
  };

  return mapping[checkType] || `Check: ${checkType.charAt(0).toUpperCase() + checkType.slice(1).toLowerCase()}`;
};

const DashboardPage = ({ scanDataProp = null, isHistoryView = false }) => {
  const API_BASE = window.location.hostname.includes('run.app') ? 'https://security-audit-accelerator-backend-196053730058.asia-south1.run.app' : 'http://localhost:5000';

  const [scanData, setScanData] = useState(null);
  const [reportStatus, setReportStatus] = useState(null); // null | 'downloading' | 'sending' | 'sent' | 'error'
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState('email'); // 'email' | 'download'
  const [emailInput, setEmailInput] = useState('');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedEmailServices, setSelectedEmailServices] = useState(['ALL']);
  const [includePdf, setIncludePdf] = useState(true);
  const [includeExcel, setIncludeExcel] = useState(false);

  // Filtering and Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Secured'
  const [currentPage, setCurrentPage] = useState(1);
  const servicesPerPage = 2;

  // Sync scanDataProp → local state (for Scan History reuse)
  useEffect(() => {
    if (scanDataProp) {
      setScanData(scanDataProp);
      setSearchTerm('');
      setSeverityFilter('All');
      setServiceFilter('all');
      setStatusFilter('All');
      setCurrentPage(1);
    }
  }, [scanDataProp]);

  useEffect(() => {
    // Skip localStorage loading when data is injected via prop
    if (scanDataProp) return;

    // Priority 1: came from ScanHistory page with a specific scan to view
    const historicalScan = sessionStorage.getItem('history_scan_view');

    if (historicalScan) {
      console.log('Dashboard loading historical scan from ScanHistory click');
      const scan = JSON.parse(historicalScan);
      setScanData(scan);
      // NOTE: Do NOT save to last_viewed_scan — this is a history view, not an active scan.
      // Saving it would cause the navbar & other pages to treat it as the current active scan.
      sessionStorage.removeItem('history_scan_view'); // clean up the handoff
    } else {
      // Priority 2: Load the last viewed scan (persists across navigation)
      const lastViewed = localStorage.getItem('last_viewed_scan');
      // Priority 3: Fallback to the latest scan result
      const latestScan = localStorage.getItem('latest_scan_result');

      if (lastViewed) {
        console.log('Dashboard loading last viewed scan');
        const scan = JSON.parse(lastViewed);
        setScanData(scan);
      } else if (latestScan) {
        console.log('Dashboard loading latest scan result');
        const scan = JSON.parse(latestScan);
        setScanData(scan);
      }
    }
  }, [scanDataProp]);

  useEffect(() => {
    // Skip event listeners when data is injected via prop (history view)
    if (scanDataProp) return;

    const handleScanComplete = (e) => {
      console.log('Dashboard received new scan data:', e.detail);
      setScanData(e.detail);
      // Save it as the active view so navigation doesn't kill it
      localStorage.setItem('last_viewed_scan', JSON.stringify(e.detail));

      // Reset filters on new scan
      setSearchTerm('');
      setSeverityFilter('All');
      setServiceFilter('all');
      setStatusFilter('All');
      setCurrentPage(1);
    };

    const handleScanStarted = () => {
      setScanData(null);
    };

    window.addEventListener('scanCompleted', handleScanComplete);
    window.addEventListener('scanStarted', handleScanStarted);
    return () => {
      window.removeEventListener('scanCompleted', handleScanComplete);
      window.removeEventListener('scanStarted', handleScanStarted);
    };
  }, [scanDataProp]);
  // New: Compute Scan Coverage for Dashboard Overview
  const dashboardCoverage = useMemo(() => {
    if (!scanData) return { percent: 100, completed: 0, total: 0, skipped: [] };
    const total = scanData.totalChecks || 77;
    let skippedArr = [];
    if (scanData.skippedChecks) {
      try {
        skippedArr = typeof scanData.skippedChecks === 'string'
          ? JSON.parse(scanData.skippedChecks)
          : (Array.isArray(scanData.skippedChecks) ? scanData.skippedChecks : []);
      } catch (e) { skippedArr = []; }
    }
    const completed = total - skippedArr.length;
    return {
      percent: Math.round((completed / total) * 100),
      completed,
      total,
      skipped: skippedArr
    };
  }, [scanData]);
  // New: Listen for provider selection changes for empty state icon
  const [activeProvider, setActiveProvider] = useState(localStorage.getItem('auditscope_selected_provider') || 'gcp');

  useEffect(() => {
    const handleStorageChange = () => {
      setActiveProvider(localStorage.getItem('auditscope_selected_provider') || 'gcp');
    };
    window.addEventListener('storage', handleStorageChange);
    // Also poll slightly if local storage isn't triggering (same tab issue)
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Compute filtered and paginated results grouped by service
  const processedData = useMemo(() => {
    if (!scanData || !scanData.vulnerabilities || !Array.isArray(scanData.vulnerabilities)) return { paginatedServices: [], totalPages: 0, totalItems: 0, filteredAllItems: [] };

    let filtered = [...scanData.vulnerabilities];

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

    const groupedServices = Object.keys(groups).sort().map(sName => {
      // Further group items within each service by Checkpoint
      const checkpointGroups = {};
      groups[sName].forEach(v => {
        const cpName = getCheckpointName(v.id);
        if (!checkpointGroups[cpName]) checkpointGroups[cpName] = [];
        checkpointGroups[cpName].push(v);
      });

      return {
        name: sName,
        totalItems: groups[sName].length,
        checkpoints: Object.keys(checkpointGroups).sort().map(cpName => ({
          name: cpName,
          items: checkpointGroups[cpName]
        }))
      };
    });

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
    if (!scanData) return [];
    const services = new Set();
    if (scanData.vulnerabilities && Array.isArray(scanData.vulnerabilities)) {
      scanData.vulnerabilities.forEach(v => {
        services.add(getServiceName(v.resource));
      });
    }
    if (scanData.passedResources && Array.isArray(scanData.passedResources)) {
      scanData.passedResources.forEach(r => {
        services.add(r.service || 'Unknown Service');
      });
    }
    return Array.from(services).sort();
  }, [scanData]);

  // Secured resources
  const securedStats = useMemo(() => {
    if (!scanData) return { count: 0, confirmedCount: 0, total: 0, pct: 100, passedItems: [] };
    const total = scanData.scanned || 0;
    const vulnResources = new Set((scanData.vulnerabilities || []).map(v => v.resource));
    const vulnCount = vulnResources.size;

    // Mathematically correct secured count: Total − Vulnerable = secured
    // This ensures: vulnCount + securedCount = total (no missing resources)
    const securedCount = Math.max(0, total - vulnCount);

    const passedItems = Array.isArray(scanData.passedResources) ? scanData.passedResources : [];
    // Confirmed count = what the backend explicitly logged as passed (shown in table)
    const confirmedCount = passedItems.length;

    // Group passed items by service
    const passedByService = {};
    passedItems.forEach(item => {
      const svc = item.service || 'Unknown Service';
      if (!passedByService[svc]) passedByService[svc] = [];
      passedByService[svc].push(item);
    });

    const passedServicesArr = Object.keys(passedByService).sort().map(svc => ({
      name: svc,
      items: passedByService[svc]
    }));

    return {
      count: securedCount,         // Card number (mathematically correct)
      confirmedCount,              // Table row count (backend-confirmed)
      total,
      pct: total > 0 ? Math.round((securedCount / total) * 100) : 100,
      vulnCount,
      passedServicesArr
    };
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
      const res = await fetch(`${API_BASE}/api/reports/download`, {
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
      a.download = `CA_AuditScope_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
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
      const res = await fetch(`${API_BASE}/api/reports/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scanData: payloadData, recipientEmail: emailInput, selectedServices: selectedEmailServices, sendPdf: includePdf, sendExcel: includeExcel })
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

  const handleDownloadExcel = async () => {
    if (!scanData) return;
    setReportMenuOpen(false);
    setReportStatus('downloading');
    try {
      const token = localStorage.getItem('auditscope_token');
      // For Excel, we use the scan record ID if available, or pass the current data
      // If scanData.id is from DB, use it, otherwise use the scanId if it's history
      const scanId = scanData.id || scanData.dbScanId;

      const res = await fetch(`${API_BASE}/api/reports/export-excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scanId: scanId,
          scanData: !scanId ? scanData : null // Send raw data only if ID is missing
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to export Excel.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CA_AuditScope_Report_${scanData.provider.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setReportStatus(null);
    } catch (err) {
      console.error('Excel export error:', err);
      setReportStatus('error');
      setTimeout(() => setReportStatus(null), 4000);
    }
  };

  return (
    <>
      <div style={{ paddingBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--spacing-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {scanData && (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {scanData.provider === 'aws' ? (
                    <img src="/assets/aws-logo.svg" alt="AWS" width="32" height="32" />
                  ) : scanData.provider === 'azure' ? (
                    <img src="/assets/azure-logo.svg" alt="Azure" width="28" height="28" />
                  ) : (
                    <img src="/assets/gcp-logo.svg" alt="GCP" width="22" height="22" />
                  )}
                </span>
              )}
              {scanData ? (
                <>
                  {scanData.provider.toUpperCase()} Infrastructure Overview
                  {/* ── Score % inline next to title ── */}
                  {(scanData.score !== undefined && scanData.score !== null) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: '6px', fontSize: '13px', fontWeight: 400 }}>
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '12px', letterSpacing: '0.02em' }}>Scan Score:</span>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '15px',
                        color: scanData.score > 80 ? '#22c55e' : scanData.score > 50 ? '#eab308' : '#ef4444',
                        padding: '1px 9px',
                        borderRadius: '7px',
                        background: scanData.score > 80 ? 'rgba(34,197,94,0.11)' : scanData.score > 50 ? 'rgba(234,179,8,0.11)' : 'rgba(239,68,68,0.11)',
                        border: `1px solid ${scanData.score > 80 ? 'rgba(34,197,94,0.28)' : scanData.score > 50 ? 'rgba(234,179,8,0.28)' : 'rgba(239,68,68,0.28)'}`,
                        letterSpacing: '-0.01em',
                      }}>
                        {scanData.score}%
                      </span>
                      {/* ? tooltip explaining score */}
                      <div
                        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
                        onMouseEnter={(e) => { const t = e.currentTarget.querySelector('[data-score-tip]'); if (t) { t.style.opacity = '1'; t.style.visibility = 'visible'; } }}
                        onMouseLeave={(e) => { const t = e.currentTarget.querySelector('[data-score-tip]'); if (t) { t.style.opacity = '0'; t.style.visibility = 'hidden'; } }}
                      >
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '16px', height: '16px', borderRadius: '50%',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'rgba(100,116,139,0.1)',
                          color: 'var(--color-text-muted)',
                          fontSize: '9px', fontWeight: 700, flexShrink: 0,
                        }}>?</span>
                        <div data-score-tip style={{
                          opacity: 0, visibility: 'hidden',
                          transition: 'all 0.2s ease',
                          position: 'absolute',
                          top: '100%', left: '50%',
                          transform: 'translateX(-50%)',
                          marginTop: '10px',
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '10px',
                          padding: '12px 14px',
                          width: '250px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                          zIndex: 1000,
                          pointerEvents: 'none',
                          textAlign: 'left',
                          fontSize: '12px',
                        }}>
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
                    </span>
                  )}
                </>
              ) : 'Overview'}
              {scanData?.isHistory && (
                <span style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '10px', color: 'var(--color-text-muted)', fontWeight: 400 }}>Historical</span>
              )}
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              {scanData ? (scanData.isHistory ? 'Historical security audit results.' : 'Latest security audit results.') : 'No active scan — hit the Scan button to get started.'}
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
                  color: '#fff',
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
                    onClick={handleDownloadExcel}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid #2d3148', color: 'var(--color-text)', textAlign: 'left', cursor: 'pointer', fontSize: 'var(--font-size-sm)', display: 'flex', gap: '8px', alignItems: 'center' }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <span>📊</span> Download Excel
                  </button>
                  <button
                    onClick={() => { setReportMenuOpen(false); setExportType('email'); setExportModalOpen(true); }}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: 'var(--color-text)', textAlign: 'left', cursor: 'pointer', fontSize: 'var(--font-size-sm)', display: 'flex', gap: '8px', alignItems: 'center' }}
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
            {/* Premium Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 'var(--spacing-6)',
              marginBottom: 'var(--spacing-8)'
            }}>
              <div
                onClick={() => { setStatusFilter('All'); setCurrentPage(1); }}
                style={{
                  background: statusFilter === 'All'
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.05) 100%)'
                    : 'var(--color-bg-secondary)',
                  padding: 'var(--spacing-6)',
                  borderRadius: '16px',
                  border: statusFilter === 'All' ? '1.5px solid #ef4444' : '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-md)',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Total Vulnerabilities
                  {statusFilter === 'All' && <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: '4px', fontWeight: 700 }}>ACTIVE</span>}
                </h3>
                <div style={{ fontSize: '36px', fontWeight: 800, color: '#ef4444', letterSpacing: '-0.02em' }}>{processedData.totalItems}</div>
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Critical Findings: <span style={{ color: '#ef4444', fontWeight: 600 }}>{(scanData?.vulnerabilities || []).filter(f => f.severity === 'Critical').length}</span>
                </div>
              </div>

              <div style={{
                background: statusFilter === 'AllResources'
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.05) 100%)'
                  : 'var(--color-bg-secondary)',
                padding: 'var(--spacing-6)',
                borderRadius: '16px',
                border: statusFilter === 'AllResources' ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-md)',
                position: 'relative',
                overflow: 'visible',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
                onClick={() => { setStatusFilter(s => s === 'AllResources' ? 'All' : 'AllResources'); setCurrentPage(1); }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Total Resources Audited
                  <div style={{ position: 'relative', display: 'inline-block', cursor: 'help' }}
                    onMouseEnter={(e) => {
                      const tooltip = e.currentTarget.querySelector('div[data-tooltip="resources"]');
                      if (tooltip) tooltip.style.opacity = '1';
                      if (tooltip) tooltip.style.visibility = 'visible';
                      if (tooltip) tooltip.style.transform = 'translate(-50%, 8px)';
                    }}
                    onMouseLeave={(e) => {
                      const tooltip = e.currentTarget.querySelector('div[data-tooltip="resources"]');
                      if (tooltip) tooltip.style.opacity = '0';
                      if (tooltip) tooltip.style.visibility = 'hidden';
                      if (tooltip) tooltip.style.transform = 'translate(-50%, 0)';
                    }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'rgba(100, 116, 139, 0.1)',
                      color: 'var(--color-text-muted)',
                      fontSize: '10px',
                      fontWeight: '700'
                    }}>?</span>
                    <div data-tooltip="resources" style={{
                      opacity: '0',
                      visibility: 'hidden',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translate(-50%, 0)',
                      backgroundColor: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      padding: '16px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      letterSpacing: 'normal',
                      textTransform: 'none',
                      boxShadow: 'var(--shadow-lg)',
                      width: 'max-content',
                      maxWidth: '280px',
                      border: '1px solid var(--color-border)',
                      zIndex: 1000,
                      pointerEvents: 'none'
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--color-primary)', fontSize: '13px' }}>What are Resources?</div>
                      <div style={{ marginBottom: '12px', lineHeight: '1.5', color: 'var(--color-text)' }}>
                        A resource is a unique cloud entity evaluated during the audit, such as a VM instance, Storage bucket, or IAM role.
                      </div>
                      <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--color-primary)', fontSize: '13px' }}>How is it calculated?</div>
                      <div style={{ lineHeight: '1.5', color: 'var(--color-text)' }}>
                        It's the count of <strong>unique</strong> resources evaluated.<br /><br />
                        <span style={{ opacity: 0.85 }}><strong>Example:</strong> If 3 separate vulnerabilities are detected in a single "Backend-VM", it adds up to 3 Total Vulnerabilities, but only <strong>1 Resource Audited</strong>.</span>
                      </div>
                      {/* Tooltip Arrow Layer 1 (Border) */}
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        marginLeft: '-6px',
                        borderWidth: '0 6px 6px 6px',
                        borderStyle: 'solid',
                        borderColor: 'transparent transparent var(--color-border) transparent'
                      }}></div>
                      {/* Tooltip Arrow Layer 2 (Background) */}
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% - 1px)',
                        left: '50%',
                        marginLeft: '-5px',
                        borderWidth: '0 5px 5px 5px',
                        borderStyle: 'solid',
                        borderColor: 'transparent transparent var(--color-bg) transparent'
                      }}></div>
                    </div>
                  </div>
                </h3>
                <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                  {(() => {
                    const scanned = scanData?.scanned !== undefined
                      ? scanData.scanned
                      : new Set(processedData.filteredAllItems.map(v => v.resource)).size;
                    return (
                      <>{scanned}<span style={{ fontSize: '18px', color: 'var(--color-text-muted)', fontWeight: 400 }}> / {scanned}</span></>
                    );
                  })()}
                </div>
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Audit Quality: <span style={{ color: dashboardCoverage.percent > 80 ? 'var(--color-primary)' : '#eab308', fontWeight: 600 }}>{dashboardCoverage.percent}%</span>
                  <span style={{ marginLeft: '8px', opacity: 0.8 }}>({dashboardCoverage.completed.toLocaleString()}/{dashboardCoverage.total.toLocaleString()} Validations)</span>
                </div>
                {dashboardCoverage.skipped.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {dashboardCoverage.skipped.slice(0, 3).map((s, i) => (
                      <span key={i} title={s.reason} style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                        {s.service} Skipped
                      </span>
                    ))}
                    {dashboardCoverage.skipped.length > 3 && <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>+{dashboardCoverage.skipped.length - 3} more</span>}
                  </div>
                )}
              </div>

              {/* ── Vulnerable Resources Card ── */}
              <div
                onClick={() => { setStatusFilter(s => s === 'VulnResources' ? 'All' : 'VulnResources'); setCurrentPage(1); }}
                style={{
                  background: statusFilter === 'VulnResources'
                    ? 'linear-gradient(135deg, rgba(249,115,22,0.10) 0%, rgba(249,115,22,0.04) 100%)'
                    : 'var(--color-bg-secondary)',
                  padding: 'var(--spacing-6)',
                  borderRadius: '16px',
                  border: statusFilter === 'VulnResources' ? '1.5px solid #f97316' : '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-md)',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Vulnerable Resources
                  {statusFilter === 'VulnResources' && <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '4px', fontWeight: 700 }}>ACTIVE</span>}
                  <div style={{ position: 'relative', display: 'inline-block', cursor: 'help' }}
                    onMouseEnter={(e) => {
                      const tooltip = e.currentTarget.querySelector('div[data-tooltip="vuln-resources"]');
                      if (tooltip) tooltip.style.opacity = '1';
                      if (tooltip) tooltip.style.visibility = 'visible';
                      if (tooltip) tooltip.style.transform = 'translate(-50%, 8px)';
                    }}
                    onMouseLeave={(e) => {
                      const tooltip = e.currentTarget.querySelector('div[data-tooltip="vuln-resources"]');
                      if (tooltip) tooltip.style.opacity = '0';
                      if (tooltip) tooltip.style.visibility = 'hidden';
                      if (tooltip) tooltip.style.transform = 'translate(-50%, 0px)';
                    }}
                  >
                    <span style={{ fontSize: '10px', background: 'var(--color-border)', color: 'var(--color-text)', borderRadius: '50%', width: '14px', height: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>?</span>
                    <div data-tooltip="vuln-resources" style={{
                      position: 'absolute', top: '100%', left: '50%', transform: 'translate(-50%, 0)', marginTop: '8px',
                      background: 'var(--color-bg)', color: 'var(--color-text-muted)', padding: '12px', borderRadius: '8px',
                      fontSize: '11px', width: '220px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                      border: '1px solid var(--color-border)', pointerEvents: 'none', zIndex: 100, textTransform: 'none',
                      letterSpacing: 'normal', fontWeight: 400, opacity: 0, visibility: 'hidden', transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                      <div style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: '4px' }}>Unique Resources</div>
                      The number of distinct resources that have at least one vulnerability finding.
                    </div>
                  </div>
                </h3>
                <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                  {securedStats.vulnCount}<span style={{ fontSize: '18px', color: 'var(--color-text-muted)', fontWeight: 400 }}> / {securedStats.total}</span>
                </div>
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>{((securedStats.vulnCount / (securedStats.total || 1)) * 100).toFixed(0)}%</span> of total audited resources
                </div>
              </div>

              {/* ── Secured Resources Card ── */}
              {(() => {
                const { count, total, pct, vulnCount } = securedStats;
                return (
                  <div
                    onClick={() => { setStatusFilter(s => s === 'Secured' ? 'All' : 'Secured'); setCurrentPage(1); }}
                    style={{
                      background: statusFilter === 'Secured'
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(16,185,129,0.10) 100%)'
                        : 'var(--color-bg-secondary)',
                      padding: 'var(--spacing-6)',
                      borderRadius: '16px',
                      border: statusFilter === 'Secured' ? '1.5px solid #22c55e' : '1px solid var(--color-border)',
                      boxShadow: 'var(--shadow-md)',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                  >
                    <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Secured Resources
                      {statusFilter === 'Secured' && <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(34,197,94,0.2)', color: '#22c55e', borderRadius: '4px', fontWeight: 700 }}>ACTIVE</span>}
                    </h3>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: '#22c55e', letterSpacing: '-0.02em' }}>
                      {count}<span style={{ fontSize: '18px', color: 'var(--color-text-muted)', fontWeight: 400 }}> / {total}</span>
                    </div>
                    <div style={{ marginTop: '12px', height: '4px', borderRadius: '99px', background: 'var(--color-border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: '99px' }} />
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>{pct}% secured</span>
                      <span>{vulnCount} vulnerable</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Premium Sticky Filter Bar */}
            <div style={{
              position: 'sticky',
              top: 'calc(-1 * var(--spacing-8))',
              zIndex: 900,
              margin: '0 calc(-1 * var(--spacing-8))',
              padding: 'var(--spacing-4) var(--spacing-8)',
              backgroundColor: 'var(--color-bg)',
              opacity: 0.95,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(0,0,0,0.05)',
              display: 'flex',
              gap: 'var(--spacing-4)',
              alignItems: 'center',
              boxShadow: '0 4px 20px -10px rgba(0,0,0,0.1)',
              marginBottom: 'var(--spacing-6)'
            }}>
              <div style={{ flex: 1.5, position: 'relative' }}>
                <input
                  type="text"
                  placeholder={statusFilter === 'Secured' ? 'Search secured resources...' : statusFilter === 'AllResources' ? 'Search all resources...' : statusFilter === 'VulnResources' ? 'Search vulnerable resources...' : 'Search vulnerabilities...'}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  style={{
                    width: '100%',
                    height: '42px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '10px',
                    padding: '0 15px 0 40px',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(0,0,0,0.1)'}
                />
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', opacity: 0.5 }}>{statusFilter === 'Secured' ? '🛡️' : '🔍'}</span>
              </div>

              <div style={{ flex: 1, position: 'relative' }}>
                <select
                  value={serviceFilter}
                  onChange={(e) => { setServiceFilter(e.target.value); setCurrentPage(1); }}
                  style={{
                    width: '100%',
                    height: '42px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '10px',
                    padding: '0 12px 0 35px',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <option value="all">All Services</option>
                  {statusFilter === 'Secured' ? (
                    securedStats.passedServicesArr.map(s => <option key={s.name} value={s.name}>{s.name}</option>)
                  ) : (
                    allServices.map(s => <option key={s} value={s}>{s}</option>)
                  )}
                </select>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', opacity: 0.6 }}>🛠️</span>
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3, fontSize: '10px' }}>▼</span>
              </div>

              <div style={{ flex: 1, position: 'relative' }}>
                <select
                  value={severityFilter}
                  onChange={(e) => { setSeverityFilter(e.target.value); setCurrentPage(1); }}
                  disabled={statusFilter === 'Secured'}
                  style={{
                    width: '100%',
                    height: '42px',
                    backgroundColor: statusFilter === 'Secured' ? 'rgba(0,0,0,0.05)' : 'var(--color-bg-secondary)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '10px',
                    padding: '0 12px 0 35px',
                    color: statusFilter === 'Secured' ? 'var(--color-text-muted)' : 'var(--color-text)',
                    fontSize: '14px',
                    cursor: statusFilter === 'Secured' ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    appearance: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    opacity: statusFilter === 'Secured' ? 0.6 : 1
                  }}
                >
                  <option value="All">All Severities</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', opacity: 0.6 }}>🛡️</span>
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: '10px' }}>▼</span>
              </div>

              {/* Status toggle: Vulnerabilities ↔ Secured */}
              <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-secondary)', borderRadius: '10px', padding: '4px', border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
                <button
                  onClick={() => { setStatusFilter('All'); setCurrentPage(1); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: statusFilter === 'All' ? 'var(--color-primary)' : 'transparent',
                    color: statusFilter === 'All' ? '#fff' : 'var(--color-text-muted)',
                  }}
                >⚠️ Vulnerable</button>
                <button
                  onClick={() => { setStatusFilter('Secured'); setCurrentPage(1); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: statusFilter === 'Secured' ? '#22c55e' : 'transparent',
                    color: statusFilter === 'Secured' ? '#fff' : 'var(--color-text-muted)',
                  }}
                >✅ Secured</button>
              </div>
            </div>

            {/* Data Table — panel switch */}
            {statusFilter === 'VulnResources' ? (
              /* ── Unique Vulnerable Resources view ── */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
                  <h2 style={{ fontSize: 'var(--font-size-base)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#f97316' }}>⚠️</span> Vulnerable Resources
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({securedStats.vulnCount} / {securedStats.total})</span>
                  </h2>
                </div>
                <div style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.08) 0%,rgba(249,115,22,0.03) 100%)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  These {securedStats.vulnCount} resources each have at least one vulnerability finding. Click <strong style={{ color: 'var(--color-text)' }}>Total Vulnerabilities</strong> to see all {(scanData?.vulnerabilities || []).length} individual findings.
                </div>
                <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)' }}>
                      {['#', 'Resource', 'Service', 'Vulnerabilities', 'Highest Severity'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {Array.from(new Set((scanData?.vulnerabilities || []).map(v => v.resource))).filter(r => !searchTerm || r?.toLowerCase().includes(searchTerm.toLowerCase())).map((resource, idx) => {
                        const resFindings = (scanData?.vulnerabilities || []).filter(v => v.resource === resource);
                        const sevOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
                        const top = resFindings.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))[0];
                        const sevColor = top?.severity === 'Critical' ? '#dc2626' : top?.severity === 'High' ? '#ea580c' : top?.severity === 'Medium' ? '#ca8a04' : '#2563eb';
                        const svc = resource?.split('(')[0]?.trim() || '—';
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                            <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', width: '40px' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--color-text)', fontWeight: 500, wordBreak: 'break-all', maxWidth: '260px' }}>{resource}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)' }}>{svc}</td>
                            <td style={{ padding: '10px 14px', color: '#ef4444', fontWeight: 700 }}>{resFindings.length}</td>
                            <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: '4px', background: `${sevColor}18`, color: sevColor, fontWeight: 700, fontSize: '11px' }}>{top?.severity || '—'}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : statusFilter === 'AllResources' ? (
              /* ── All Resources view (Vulnerable + Secured) ── */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>All Resources Audited</h2>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: 'var(--font-size-base)' }}>({securedStats.total} / {securedStats.total})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#f97316', fontWeight: 700, fontSize: '13px' }}>⚠️ Vulnerable Resources</span>
                    <span style={{ fontWeight: 800, fontSize: '20px', color: '#f97316' }}>{securedStats.vulnCount}</span>
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '13px' }}>✅ Secured Resources</span>
                    <span style={{ fontWeight: 800, fontSize: '20px', color: '#22c55e' }}>{securedStats.count}</span>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                  Click <strong style={{ color: 'var(--color-text)' }}>⚠️ Vulnerable Resources</strong> or <strong style={{ color: 'var(--color-text)' }}>✅ Secured Resources</strong> card for a detailed breakdown.
                </p>
                <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)' }}>
                      {['#', 'Resource', 'Status', 'Findings'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {(() => {
                        const vulnSet = new Set((scanData?.vulnerabilities || []).map(v => v.resource));
                        const allRes = [
                          ...Array.from(vulnSet).map(r => ({ name: r, status: 'Vulnerable', count: (scanData?.vulnerabilities || []).filter(v => v.resource === r).length })),
                          ...(securedStats.passedServicesArr || []).flatMap(s => s.items.map(i => ({ name: i.name || i.resource || i, status: 'Secured', count: 0 })))
                        ].filter(r => !searchTerm || r.name?.toLowerCase().includes(searchTerm.toLowerCase()));
                        return allRes.map((r, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                            <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', width: '40px' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--color-text)', fontWeight: 500, wordBreak: 'break-all', maxWidth: '320px' }}>{r.name}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', background: r.status === 'Vulnerable' ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)', color: r.status === 'Vulnerable' ? '#f97316' : '#22c55e', fontWeight: 700, fontSize: '11px' }}>{r.status}</span>
                            </td>
                            <td style={{ padding: '10px 14px', color: r.count > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{r.count > 0 ? r.count : '—'}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : statusFilter === 'All' ? (
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
                            {serviceGroup.totalItems} items
                          </span>
                        </h3>
                        <Card style={{ padding: 0, overflow: 'hidden', border: 'none', background: 'transparent' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                            {serviceGroup.checkpoints.map((checkpoint, cpIdx) => (
                              <div key={cpIdx} style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ display: 'flex' }}>
                                    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                                  </span> {checkpoint.name}
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: 'transparent', borderBottom: '1px solid var(--color-border)' }}>
                                        <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '40px', textAlign: 'center' }}>#</th>
                                        <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '12%' }}>ID</th>
                                        <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '10%' }}>Severity</th>
                                        <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '20%' }}>Resource</th>
                                        <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '28%' }}>Issue Description</th>
                                        <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '30%' }}>Recommendation</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {checkpoint.items.map((vuln, idx) => (
                                        <tr key={idx} style={{ borderBottom: idx === checkpoint.items.length - 1 ? 'none' : '1px solid var(--color-border)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                          <td style={{ padding: 'var(--spacing-3)', color: 'var(--color-text-muted)', textAlign: 'center', fontWeight: 500 }}>
                                            {idx + 1}
                                          </td>
                                          <td style={{ padding: 'var(--spacing-3)', fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: 500 }}>
                                            {vuln.id}
                                          </td>
                                          <td style={{ padding: 'var(--spacing-3)' }}>
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '2px 6px',
                                              borderRadius: '3px',
                                              backgroundColor: `${getSeverityColor(vuln.severity)}20`,
                                              color: getSeverityColor(vuln.severity),
                                              fontWeight: 700,
                                              fontSize: '10px',
                                              textTransform: 'uppercase'
                                            }}>
                                              {vuln.severity}
                                            </span>
                                          </td>
                                          <td style={{ padding: 'var(--spacing-3)', color: 'var(--color-text)', fontWeight: 500 }}>
                                            {vuln.resource}
                                          </td>
                                          <td style={{ padding: 'var(--spacing-3)', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                                            {vuln.issue}
                                          </td>
                                          <td style={{ padding: 'var(--spacing-3)', color: 'var(--color-primary)', opacity: 0.9, lineHeight: '1.4' }}>
                                            {vuln.remediation || '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
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
            ) : (
              /* ── Secured Resources Panel ── */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
                  <h2 style={{ fontSize: 'var(--font-size-base)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#22c55e' }}>✅</span> Secured Resources
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({securedStats.count} / {securedStats.total})</span>
                  </h2>
                  <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600, background: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(34,197,94,0.25)' }}>
                    {securedStats.pct}% of infrastructure secured
                  </span>
                </div>

                {/* Summary banner */}
                <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(16,185,129,0.05) 100%)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '14px', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ fontSize: '48px', lineHeight: 1 }}>🛡️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#22c55e', letterSpacing: '-0.02em' }}>
                      {securedStats.count} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)' }}>out of {securedStats.total} resources had no vulnerability findings</span>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      {securedStats.vulnCount} resource{securedStats.vulnCount !== 1 ? 's' : ''} had at least one finding and appear in the <strong>⚠️ Vulnerable</strong> view.
                      {securedStats.confirmedCount < securedStats.count && (
                        <span style={{ display: 'block', marginTop: '6px', padding: '6px 10px', background: 'rgba(234,179,8,0.08)', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.2)', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                          ℹ️ <strong style={{ color: 'var(--color-text)' }}>{securedStats.confirmedCount}</strong> explicitly confirmed safe resources are listed below.
                          The remaining <strong style={{ color: 'var(--color-text)' }}>{securedStats.count - securedStats.confirmedCount}</strong> had no vulnerabilities found but were not individually logged by the scanner.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Secured Resources List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(() => {
                    if (securedStats.count === 0) {
                      return (
                        <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-background-light)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)' }}>
                          No secured resources found. All scanned resources have vulnerabilities.
                        </div>
                      );
                    }

                    let filteredServices = securedStats.passedServicesArr || [];

                    // Apply Service Filter
                    if (serviceFilter !== 'all') {
                      filteredServices = filteredServices.filter(s => s.name === serviceFilter);
                    }

                    // Apply Search Filter
                    if (searchTerm) {
                      const lowerTerm = searchTerm.toLowerCase();
                      filteredServices = filteredServices.map(s => {
                        const matchedItems = s.items.filter(item =>
                          (item.name || '').toLowerCase().includes(lowerTerm) ||
                          (item.service || '').toLowerCase().includes(lowerTerm)
                        );
                        return { ...s, items: matchedItems };
                      }).filter(s => s.items.length > 0 || s.name.toLowerCase().includes(lowerTerm));
                    }

                    if (filteredServices.length === 0) {
                      return (
                        <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-background-light)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)' }}>
                          No secured resources match the current filters.
                        </div>
                      );
                    }

                    const totalSecuredPages = Math.ceil(filteredServices.length / servicesPerPage);
                    const startIndex = (currentPage - 1) * servicesPerPage;
                    const paginatedFilteredServices = filteredServices.slice(startIndex, startIndex + servicesPerPage);

                    return (
                      <>
                        {/* Secured Pagination Controls */}
                        {totalSecuredPages > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
                            <button
                              onClick={() => handlePageChange(currentPage - 1)}
                              disabled={currentPage === 1}
                              style={{ padding: '2px 8px', background: 'var(--color-background-light)', border: '1px solid var(--color-border)', borderRadius: '4px', color: currentPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                            >
                              Prev
                            </button>
                            <span style={{ margin: '0 8px', color: 'var(--color-text-muted)' }}>
                              Page {currentPage} of {totalSecuredPages}
                            </span>
                            <button
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={currentPage === totalSecuredPages || totalSecuredPages === 1}
                              style={{ padding: '2px 8px', background: 'var(--color-background-light)', border: '1px solid var(--color-border)', borderRadius: '4px', color: (currentPage === totalSecuredPages || totalSecuredPages === 1) ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: (currentPage === totalSecuredPages || totalSecuredPages === 1) ? 'not-allowed' : 'pointer' }}
                            >
                              Next
                            </button>
                          </div>
                        )}

                        {paginatedFilteredServices.map((svc, sIdx) => (
                          <Card key={sIdx} style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(34,197,94,0.3)' }}>
                            <div style={{
                              background: 'linear-gradient(90deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.05) 100%)',
                              padding: '16px 20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderBottom: '1px solid rgba(34,197,94,0.2)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '20px' }}>🛡️</span>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>
                                  {svc.name}
                                </h3>
                              </div>
                              <span style={{
                                fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 600,
                                background: 'rgba(34,197,94,0.15)',
                                color: '#15803d',
                                border: '1px solid rgba(34,197,94,0.3)'
                              }}>
                                {svc.items.length} Secured Resource{svc.items.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            <div style={{ padding: '0', overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
                                <thead>
                                  <tr style={{ backgroundColor: 'transparent', borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', width: '60px', textAlign: 'center' }}>#</th>
                                    <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Resource Name</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {svc.items.map((item, iIdx) => (
                                    <tr key={iIdx} style={{ borderBottom: iIdx === svc.items.length - 1 ? 'none' : '1px solid var(--color-border)', backgroundColor: iIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                      <td style={{ padding: 'var(--spacing-3)', color: 'var(--color-text-muted)', textAlign: 'center', fontWeight: 500 }}>
                                        {iIdx + 1}
                                      </td>
                                      <td style={{ padding: 'var(--spacing-3)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                        <span style={{ color: '#22c55e', fontSize: '14px' }}>✓</span>
                                        {item.name || 'Unknown Resource'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </Card>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        ) : (
          <Section style={{ padding: 0 }} darker={false}>
            <Card style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-4)' }}>
              <div style={{ display: 'flex', gap: '24px', opacity: 0.5, marginBottom: '24px', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', alignItems: 'center' }}>
                <img src="/assets/gcp-logo.svg" alt="GCP" width="50" height="50" />
                <span style={{ fontSize: '24px', color: 'var(--color-border)' }}>|</span>
                <img src="/assets/aws-logo.svg" alt="AWS" width="50" height="50" />
                <span style={{ fontSize: '24px', color: 'var(--color-border)' }}>|</span>
                <img src="/assets/azure-logo.svg" alt="Azure" width="45" height="45" />
              </div>
              <h3 style={{ color: 'var(--color-text)' }}>No active scan right now</h3>
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '400px', fontSize: 'var(--font-size-sm)' }}>
                Choose your cloud provider (AWS, GCP, or Azure), enter your credentials, and we'll run a full multi-service security audit for you.
              </p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('openScannerModal'))}
                style={{
                  marginTop: '16px',
                  padding: '12px 24px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  transition: 'transform 0.2s, background-color 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
              >
                Scan Now
              </button>
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '360px', fontSize: '12px', opacity: 0.7, marginTop: '12px' }}>
                Results will appear here instantly once the scan completes.
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
              <div style={{ marginBottom: 'var(--spacing-4)' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', marginBottom: 'var(--spacing-2)', fontWeight: 600 }}>Formats to Send:</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includePdf}
                      onChange={(e) => setIncludePdf(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    PDF Report
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeExcel}
                      onChange={(e) => setIncludeExcel(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    Excel Report
                  </label>
                </div>
              </div>
            )}

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
                  disabled={!emailInput || (!includePdf && !includeExcel) || reportStatus === 'sending'}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: 'var(--radius-md)', cursor: (!emailInput || (!includePdf && !includeExcel) || reportStatus === 'sending') ? 'not-allowed' : 'pointer', opacity: (!emailInput || (!includePdf && !includeExcel) || reportStatus === 'sending') ? 0.6 : 1, display: 'flex', gap: '8px', alignItems: 'center' }}
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
